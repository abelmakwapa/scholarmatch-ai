import asyncio
import hashlib
import json
import re
from collections.abc import AsyncIterator, Mapping
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Protocol, cast
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import UUID

from pydantic import TypeAdapter, ValidationError

from app.auth.models import CurrentUser
from app.core.errors import ApiError
from app.db.principal import DatabasePrincipal, ServicePurpose
from app.db.protocols import Database
from app.repositories.models import (
    AuditEventWrite,
    IngestionRunWrite,
    NormalizedSourceWrite,
    RawSourceRecordWrite,
    RequirementWrite,
    ScholarshipWrite,
)
from app.schemas.scholarship import (
    IngestionRunCreate,
    IngestionRunResponse,
    RequirementField,
    RequirementOperator,
)
from app.schemas.user import CountryCode
from app.services.work_queue import WorkQueue

_COUNTRY = TypeAdapter(CountryCode)
_TRACKING_PARAMETERS = frozenset({"fbclid", "gclid", "ref", "source"})
_STUDY_LEVELS = {
    "secondary": "secondary",
    "bachelor": "undergraduate",
    "bachelors": "undergraduate",
    "undergraduate": "undergraduate",
    "master": "postgraduate",
    "masters": "postgraduate",
    "postgraduate": "postgraduate",
    "phd": "doctoral",
    "doctoral": "doctoral",
    "vocational": "vocational",
    "other": "other",
}
_REQUIREMENT_FIELDS = {
    "study_level",
    "field_of_study",
    "destination",
    "nationality",
    "residency",
    "gpa",
    "experience",
    "document",
    "other",
}
_REQUIREMENT_OPERATORS = {
    "equals",
    "not_equals",
    "in",
    "not_in",
    "gte",
    "lte",
    "contains",
    "exists",
}


class SourceFetchError(RuntimeError):
    pass


class SourceParseError(RuntimeError):
    pass


class NormalizationError(ValueError):
    def __init__(self, code: str, summary: str) -> None:
        super().__init__(code)
        self.code = code
        self.summary = summary


@dataclass(frozen=True, slots=True)
class FetchPolicy:
    timeout_seconds: float = 10
    max_retries: int = 2
    user_agent: str = "ScholarMatchBot/1.0 (+https://scholarmatch.example/ingestion-policy)"


@dataclass(frozen=True, slots=True)
class RawSourceRecord:
    source_record_id: str
    source_url: str
    payload: Mapping[str, Any]
    fetched_at: datetime


class SourceAdapter(Protocol):
    name: str
    version: str
    source_version: str
    trusted: bool
    permission_granted: bool
    robots_allowed: bool
    terms_checked_at: datetime
    fetch_policy: FetchPolicy

    def fetch(self, *, start_at: int) -> AsyncIterator[RawSourceRecord]: ...


_FIXTURE_BASELINE: tuple[dict[str, Any], ...] = (
    {
        "id": "fixture-001",
        "source_url": "https://fixtures.example/scholarships/global-science",
        "provider": {
            "name": "Global Science Foundation",
            "website_url": "https://fixtures.example",
        },
        "title": "Global Science Scholarship",
        "description": "Funding for undergraduate science students.",
        "amount": "10000.00",
        "currency": "USD",
        "funding_type": "partial",
        "deadline": "2027-05-31",
        "study_levels": ["bachelor"],
        "fields_of_study": ["Science"],
        "destination_countries": ["US"],
        "requirements": [
            {
                "constraint_type": "hard",
                "field": "study_level",
                "operator": "in",
                "value": ["undergraduate"],
                "summary": "Open to undergraduate applicants.",
            }
        ],
    },
    {
        "id": "fixture-002",
        "source_url": "https://fixtures.example/scholarships/research-fellowship",
        "provider": {"name": "Research Trust", "website_url": "https://fixtures.example"},
        "title": "Research Fellowship",
        "amount": "25000",
        "currency": "USD",
        "funding_type": "research",
        "deadline": "2027-09-15",
        "study_levels": ["phd"],
        "fields_of_study": ["Engineering"],
        "destination_countries": ["GB"],
        "requirements": [],
    },
)


class FixtureSourceAdapter:
    name = "fixture"
    version = "1.0.0"
    trusted = False
    permission_granted = True
    robots_allowed = True
    fetch_policy = FetchPolicy(timeout_seconds=2, max_retries=1)

    def __init__(self, fixture_name: str = "baseline") -> None:
        self.fixture_name = fixture_name
        self.source_version = fixture_name
        self.terms_checked_at = datetime(2026, 8, 1, tzinfo=UTC)

    async def fetch(self, *, start_at: int) -> AsyncIterator[RawSourceRecord]:
        records = [dict(record) for record in _FIXTURE_BASELINE]
        if self.fixture_name == "changed":
            records[0]["amount"] = "12000.00"
            records[0]["deadline"] = "2027-06-30"
        for position, payload in enumerate(records):
            if position < start_at:
                continue
            yield RawSourceRecord(
                source_record_id=str(payload["id"]),
                source_url=str(payload["source_url"]),
                payload=payload,
                fetched_at=datetime(2026, 8, 6, 12, position, tzinfo=UTC),
            )
            if self.fixture_name == "partial" and position == start_at:
                raise SourceFetchError("fixture fetch interrupted")


def canonicalize_source_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise NormalizationError("INVALID_SOURCE_URL", "Source URL must be an absolute HTTPS URL.")
    query = [
        (key, item)
        for key, item in parse_qsl(parsed.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in _TRACKING_PARAMETERS
    ]
    path = parsed.path.rstrip("/") or "/"
    return urlunsplit(("https", parsed.hostname.lower(), path, urlencode(sorted(query)), ""))


def _string(value: object, field: str, maximum: int) -> str:
    if not isinstance(value, str):
        raise NormalizationError("PARSE_ERROR", f"{field} must be text.")
    clean = " ".join(value.split())
    if not clean or len(clean) > maximum:
        raise NormalizationError("PARSE_ERROR", f"{field} is blank or too long.")
    return clean


def _optional_string(value: object, field: str, maximum: int) -> str | None:
    if value is None:
        return None
    return _string(value, field, maximum)


def _list_of_strings(value: object, field: str, maximum: int = 100) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > maximum:
        raise NormalizationError("PARSE_ERROR", f"{field} must be a bounded array.")
    normalized = [_string(item, field, 300) for item in value]
    return list(dict.fromkeys(normalized))


def normalize_source_record(
    adapter: SourceAdapter, record: RawSourceRecord
) -> NormalizedSourceWrite:
    payload = record.payload
    try:
        provider = payload["provider"]
        if not isinstance(provider, Mapping):
            raise NormalizationError("PARSE_ERROR", "provider must be an object.")
        provider_name = _string(provider.get("name"), "provider.name", 300)
        provider_website = provider.get("website_url")
        provider_url = canonicalize_source_url(str(provider_website)) if provider_website else None
        title = _string(payload.get("title"), "title", 300)
        canonical_url = canonicalize_source_url(record.source_url)
        deadline_value = payload.get("deadline")
        try:
            deadline = date.fromisoformat(str(deadline_value)) if deadline_value else None
        except ValueError:
            raise NormalizationError(
                "INVALID_DEADLINE", "Deadline must be a valid ISO calendar date."
            ) from None
        amount_value = payload.get("amount")
        try:
            amount = Decimal(str(amount_value)) if amount_value is not None else None
        except InvalidOperation:
            raise NormalizationError("INVALID_AMOUNT", "Amount must be a decimal number.") from None
        if amount is not None and amount < 0:
            raise NormalizationError("INVALID_AMOUNT", "Amount must not be negative.")
        currency_value = payload.get("currency")
        currency = str(currency_value).upper() if currency_value is not None else None
        if (amount is None) != (currency is None) or (
            currency is not None and not re.fullmatch(r"[A-Z]{3}", currency)
        ):
            raise NormalizationError(
                "INVALID_CURRENCY", "Amount and a three-letter currency must be provided together."
            )
        raw_levels = _list_of_strings(payload.get("study_levels"), "study_levels", 10)
        try:
            study_levels = list(
                dict.fromkeys(_STUDY_LEVELS[level.casefold()] for level in raw_levels)
            )
        except KeyError:
            raise NormalizationError(
                "INVALID_STUDY_LEVEL", "Study level is not recognized."
            ) from None
        try:
            destination_countries = [
                _COUNTRY.validate_python(item)
                for item in _list_of_strings(
                    payload.get("destination_countries"), "destination_countries", 50
                )
            ]
        except ValidationError:
            raise NormalizationError(
                "INVALID_COUNTRY", "Destination country code is not recognized."
            ) from None
        funding_type = str(payload.get("funding_type", "other")).lower()
        if funding_type not in {"full", "partial", "tuition", "stipend", "research", "other"}:
            raise NormalizationError("INVALID_FUNDING_TYPE", "Funding type is not recognized.")
        requirements_payload = payload.get("requirements", [])
        if not isinstance(requirements_payload, list) or len(requirements_payload) > 100:
            raise NormalizationError("PARSE_ERROR", "requirements must be a bounded array.")
        requirements: list[RequirementWrite] = []
        for position, requirement in enumerate(requirements_payload):
            if not isinstance(requirement, Mapping):
                raise NormalizationError("PARSE_ERROR", "requirement must be an object.")
            constraint_type = str(requirement.get("constraint_type", "hard"))
            field = str(requirement.get("field", "other"))
            operator = str(requirement.get("operator", "exists"))
            if constraint_type not in {"hard", "soft"}:
                raise NormalizationError(
                    "INVALID_REQUIREMENT", "Requirement constraint type is not recognized."
                )
            if field not in _REQUIREMENT_FIELDS or operator not in _REQUIREMENT_OPERATORS:
                raise NormalizationError(
                    "INVALID_REQUIREMENT", "Requirement field or operator is not recognized."
                )
            requirements.append(
                RequirementWrite(
                    constraint_type=cast(Any, constraint_type),
                    field=cast(RequirementField, field),
                    operator=cast(RequirementOperator, operator),
                    value=requirement.get("value"),
                    source_evidence={
                        "source_url": canonical_url,
                        "summary": _string(requirement.get("summary"), "requirement.summary", 2000),
                    },
                    position=position,
                )
            )
    except KeyError as exc:
        raise NormalizationError("PARSE_ERROR", "A required source field is missing.") from exc

    scholarship = ScholarshipWrite(
        provider_name=provider_name,
        provider_website_url=provider_url,
        title=title,
        description=_optional_string(payload.get("description"), "description", 20000),
        amount=amount,
        currency=currency,
        funding_type=funding_type,
        funding_summary=_optional_string(payload.get("funding_summary"), "funding_summary", 2000),
        study_levels=study_levels,
        fields_of_study=_list_of_strings(payload.get("fields_of_study"), "fields_of_study"),
        destination_countries=destination_countries,
        nationality_requirements=_list_of_strings(
            payload.get("nationality_requirements"), "nationality_requirements"
        ),
        residency_requirements=_list_of_strings(
            payload.get("residency_requirements"), "residency_requirements"
        ),
        required_documents=_list_of_strings(
            payload.get("required_documents"), "required_documents"
        ),
        deadline=deadline,
        deadline_at=None,
        deadline_timezone=None,
        eligibility_summary=_optional_string(
            payload.get("eligibility_summary"), "eligibility_summary", 4000
        ),
        source_url=canonical_url,
        application_url=(
            canonicalize_source_url(str(payload["application_url"]))
            if payload.get("application_url")
            else None
        ),
        reviewer_notes=None,
    )
    fingerprint_payload = {
        "provider": provider_name.casefold(),
        "provider_website": provider_url,
        "title": title.casefold(),
        "deadline": deadline.isoformat() if deadline else None,
        "amount": str(amount) if amount is not None else None,
        "currency": currency,
        "study_levels": study_levels,
        "fields": scholarship.fields_of_study,
        "requirements": [asdict(item) for item in requirements],
    }
    fingerprint = hashlib.sha256(
        json.dumps(fingerprint_payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return NormalizedSourceWrite(
        scholarship=ScholarshipWrite(**{**asdict(scholarship), "source_fingerprint": fingerprint}),
        requirements=requirements,
        source=adapter.name,
        source_record_id=record.source_record_id,
        source_version=adapter.source_version,
        canonical_url=canonical_url,
        fingerprint=fingerprint,
        trusted=adapter.trusted,
    )


class IngestionAdminService:
    def __init__(self, database: Database, queue: WorkQueue) -> None:
        self._database = database
        self._queue = queue

    async def create(
        self,
        user: CurrentUser,
        request: IngestionRunCreate,
        *,
        idempotency_key: str,
    ) -> IngestionRunResponse:
        adapter = FixtureSourceAdapter(request.fixture_name)
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            row = await uow.ingestion.create(
                IngestionRunWrite(
                    source=adapter.name,
                    source_url=None,
                    dry_run=request.dry_run,
                    created_by=user.id,
                    adapter_version=adapter.version,
                    source_version=adapter.source_version,
                    idempotency_key=idempotency_key,
                    batch_size=request.batch_size,
                )
            )
            run_id = UUID(str(row["id"]))
            await uow.audit.append(
                AuditEventWrite(
                    actor_id=user.id,
                    action="ingestion.queued",
                    target_type="ingestion_run",
                    target_id=run_id,
                    target_name=adapter.name,
                    summary="Queued deterministic fixture ingestion.",
                    metadata={"adapter_version": adapter.version},
                )
            )
            try:
                await self._queue.enqueue_ingestion_run(
                    run_id, idempotency_key=f"ingestion-run:{run_id}"
                )
            except Exception:
                raise ApiError(
                    status_code=503,
                    code="INGESTION_QUEUE_UNAVAILABLE",
                    message="The ingestion run could not be queued safely. Retry later.",
                ) from None
        return IngestionRunResponse.model_validate(row)

    async def get(self, user: CurrentUser, run_id: UUID) -> IngestionRunResponse:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            row = await uow.ingestion.get(run_id)
        if row is None:
            raise ApiError(
                status_code=404, code="INGESTION_RUN_NOT_FOUND", message="Run not found."
            )
        return IngestionRunResponse.model_validate(row)

    async def list(self, user: CurrentUser, *, limit: int) -> list[IngestionRunResponse]:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            rows = await uow.ingestion.list_recent(limit=limit)
        return [IngestionRunResponse.model_validate(row) for row in rows]

    async def retry(
        self, user: CurrentUser, run_id: UUID, *, idempotency_key: str
    ) -> IngestionRunResponse:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            original = await uow.ingestion.get(run_id)
            if original is None:
                raise ApiError(
                    status_code=404,
                    code="INGESTION_RUN_NOT_FOUND",
                    message="Run not found.",
                )
            if original["status"] not in {"failed", "dead_lettered", "cancelled"}:
                raise ApiError(
                    status_code=409,
                    code="INGESTION_RETRY_NOT_ALLOWED",
                    message="Only terminal unsuccessful runs can be retried.",
                )
            row = await uow.ingestion.create(
                IngestionRunWrite(
                    source=str(original["source"]),
                    source_url=original.get("source_url"),
                    dry_run=bool(original["dry_run"]),
                    created_by=user.id,
                    adapter_version=str(original["adapter_version"]),
                    source_version=original.get("source_version"),
                    idempotency_key=idempotency_key,
                    batch_size=int(original["batch_size"]),
                    original_run_id=run_id,
                )
            )
            retry_id = UUID(str(row["id"]))
            await self._queue.enqueue_ingestion_run(
                retry_id, idempotency_key=f"ingestion-run:{retry_id}"
            )
        return IngestionRunResponse.model_validate(row)


class IngestionOrchestrator:
    def __init__(self, database: Database) -> None:
        self._database = database
        self._principal = DatabasePrincipal.for_service(
            ServicePurpose.INGESTION_WORKER,
            authorization_reason="execute approved ingestion adapter",
        )

    async def run_fixture_batch(self, run_id: UUID) -> IngestionRunResponse:
        async with self._database.unit_of_work(self._principal) as uow:
            run = await uow.ingestion.get(run_id)
        if run is None:
            raise ApiError(
                status_code=404,
                code="INGESTION_RUN_NOT_FOUND",
                message="Run not found.",
            )
        source_version = str(run.get("source_version") or "")
        if run.get("source") != "fixture" or source_version not in {
            "baseline",
            "changed",
            "partial",
        }:
            raise ApiError(
                status_code=409,
                code="INGESTION_ADAPTER_UNAVAILABLE",
                message="No approved adapter is available for this run.",
            )
        return await self.run_batch(run_id, FixtureSourceAdapter(source_version))

    async def run_batch(self, run_id: UUID, adapter: SourceAdapter) -> IngestionRunResponse:
        self._check_source_permission(adapter)
        async with self._database.unit_of_work(self._principal) as uow:
            run = await uow.ingestion.claim(run_id)
        if run is None:
            raise ApiError(
                status_code=409,
                code="INGESTION_RUN_NOT_CLAIMABLE",
                message="The run is already active or has finished.",
            )
        if (
            run.get("source") != adapter.name
            or run.get("adapter_version") != adapter.version
            or run.get("source_version") != adapter.source_version
        ):
            async with self._database.unit_of_work(self._principal) as uow:
                failed = await uow.ingestion.advance(
                    run_id,
                    resume_cursor=int(run["resume_cursor"]),
                    counters={str(key): int(value) for key, value in dict(run["counters"]).items()},
                    status="failed",
                    safe_errors=[
                        {
                            "code": "ADAPTER_VERSION_MISMATCH",
                            "summary": "The queued adapter version is not available.",
                            "count": 1,
                        }
                    ],
                )
            return IngestionRunResponse.model_validate(failed)
        counters = {str(key): int(value) for key, value in dict(run["counters"]).items()}
        for key in ("fetched", "created", "updated", "unchanged", "duplicates", "rejected"):
            counters.setdefault(key, 0)
        start_at = int(run["resume_cursor"])
        batch_size = int(run["batch_size"])
        records, fetch_error = await self._fetch_with_retries(adapter, start_at, batch_size + 1)
        process_records = records[:batch_size]
        for offset, record in enumerate(process_records):
            position = start_at + offset
            try:
                raw_write = self._raw_write(adapter, record)
            except NormalizationError as exc:
                async with self._database.unit_of_work(self._principal) as uow:
                    await uow.ingestion.reject(
                        run_id,
                        None,
                        reason_code=exc.code,
                        safe_summary=exc.summary,
                    )
                counters["rejected"] += 1
                continue
            raw_id: UUID | None = None
            try:
                async with self._database.unit_of_work(self._principal) as uow:
                    raw = await uow.ingestion.store_raw(
                        run_id, position, position // batch_size, raw_write
                    )
                    raw_id = UUID(str(raw["id"]))
                counters["fetched"] += 1
                try:
                    normalized = normalize_source_record(adapter, record)
                except NormalizationError as exc:
                    async with self._database.unit_of_work(self._principal) as uow:
                        await uow.ingestion.reject(
                            run_id,
                            raw_id,
                            reason_code=exc.code,
                            safe_summary=exc.summary,
                        )
                    counters["rejected"] += 1
                else:
                    async with self._database.unit_of_work(self._principal) as uow:
                        outcome = await uow.ingestion.apply_normalized(
                            run_id,
                            raw_id,
                            normalized,
                            dry_run=bool(run["dry_run"]),
                        )
                    counters[outcome if outcome != "duplicate" else "duplicates"] += 1
            except Exception:
                item_dead_lettered = False
                if raw_id is not None:
                    async with self._database.unit_of_work(self._principal) as uow:
                        item_dead_lettered = await uow.ingestion.fail_item(
                            run_id,
                            raw_id,
                            safe_error_code="PROCESSING_FAILED",
                            safe_error_summary="The record could not be processed safely.",
                        )
                status = (
                    "dead_lettered"
                    if item_dead_lettered or int(run["attempt_count"]) >= 3
                    else "partial"
                )
                async with self._database.unit_of_work(self._principal) as uow:
                    failed = await uow.ingestion.advance(
                        run_id,
                        resume_cursor=position,
                        counters=counters,
                        status=status,
                        safe_errors=[
                            {
                                "code": "PROCESSING_FAILED",
                                "summary": "A source record could not be processed safely.",
                                "count": 1,
                            }
                        ],
                    )
                return IngestionRunResponse.model_validate(failed)

        resume_cursor = start_at + len(process_records)
        safe_errors: list[dict[str, Any]] | None = None
        if fetch_error is not None:
            attempts = int(run["attempt_count"])
            status = "dead_lettered" if attempts >= 3 and not process_records else "partial"
            safe_errors = [
                {
                    "code": (
                        "SOURCE_PARSE_FAILED"
                        if isinstance(fetch_error, SourceParseError)
                        else "SOURCE_FETCH_FAILED"
                    ),
                    "summary": (
                        "The approved source adapter returned an unreadable batch."
                        if isinstance(fetch_error, SourceParseError)
                        else "The approved source adapter could not complete its batch."
                    ),
                    "count": 1,
                }
            ]
        elif len(records) > batch_size:
            status = "partial"
        else:
            status = "completed"
        async with self._database.unit_of_work(self._principal) as uow:
            finished = await uow.ingestion.advance(
                run_id,
                resume_cursor=resume_cursor,
                counters=counters,
                status=status,
                safe_errors=safe_errors,
            )
        return IngestionRunResponse.model_validate(finished)

    @staticmethod
    def _check_source_permission(adapter: SourceAdapter) -> None:
        if not adapter.permission_granted or not adapter.robots_allowed:
            raise ApiError(
                status_code=403,
                code="SOURCE_NOT_APPROVED",
                message="The source is not approved for ingestion.",
            )
        policy = adapter.fetch_policy
        if (
            policy.timeout_seconds <= 0
            or policy.timeout_seconds > 60
            or policy.max_retries < 0
            or policy.max_retries > 5
            or not policy.user_agent.startswith("ScholarMatchBot/")
        ):
            raise ApiError(
                status_code=500,
                code="INVALID_ADAPTER_POLICY",
                message="The source adapter policy is invalid.",
            )

    @staticmethod
    async def _fetch_with_retries(
        adapter: SourceAdapter, start_at: int, maximum: int
    ) -> tuple[list[RawSourceRecord], Exception | None]:
        last_error: Exception | None = None
        for _ in range(adapter.fetch_policy.max_retries + 1):
            records: list[RawSourceRecord] = []
            try:
                async with asyncio.timeout(adapter.fetch_policy.timeout_seconds):
                    async for record in adapter.fetch(start_at=start_at):
                        records.append(record)
                        if len(records) >= maximum:
                            break
                return records, None
            except (SourceFetchError, TimeoutError) as exc:
                last_error = exc
                continue
            except Exception as exc:
                return records, SourceParseError(type(exc).__name__)
        return records, last_error

    @staticmethod
    def _raw_write(adapter: SourceAdapter, record: RawSourceRecord) -> RawSourceRecordWrite:
        payload = dict(record.payload)
        digest = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
        ).hexdigest()
        return RawSourceRecordWrite(
            source=adapter.name,
            source_record_id=record.source_record_id,
            source_url=canonicalize_source_url(record.source_url),
            source_version=adapter.source_version,
            content_sha256=digest,
            payload=payload,
            fetched_at=record.fetched_at,
            terms_checked_at=adapter.terms_checked_at,
            robots_allowed=adapter.robots_allowed,
        )
