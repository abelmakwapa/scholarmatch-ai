from collections.abc import Mapping
from typing import Any

from pydantic import ValidationError

from app.auth.models import CurrentUser
from app.core.errors import ApiError
from app.db.principal import DatabasePrincipal
from app.db.protocols import Database
from app.repositories.models import ProfileWrite
from app.schemas.user import ProfileCompleteness, ProfileFields, ProfileResponse, ProfileUpdate
from app.services.work_queue import WorkQueue

COMPLETENESS_VERSION = "2026-08-06"
_REQUIRED_FIELDS = ("full_name", "country", "study_level")
_RECOMMENDED_FIELDS = (
    "field_of_study",
    "gpa",
    "nationality_country",
    "residence_country",
    "date_of_birth",
    "interests",
    "target_countries",
    "goals",
    "requires_financial_aid",
    "willing_to_relocate",
    "institution_name",
    "experience_months",
)
_MATCHING_FIELDS = frozenset(
    {
        "country",
        "study_level",
        "field_of_study",
        "gpa",
        "gpa_scale",
        "nationality_country",
        "residence_country",
        "date_of_birth",
        "interests",
        "target_countries",
        "goals",
        "requires_financial_aid",
        "willing_to_relocate",
        "institution_name",
        "experience_months",
    }
)


def _is_known(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str | list):
        return bool(value)
    return True


def calculate_completeness(profile: Mapping[str, object]) -> ProfileCompleteness:
    missing_required = [name for name in _REQUIRED_FIELDS if not _is_known(profile.get(name))]
    missing_recommended = [name for name in _RECOMMENDED_FIELDS if not _is_known(profile.get(name))]
    required_complete = len(_REQUIRED_FIELDS) - len(missing_required)
    recommended_complete = len(_RECOMMENDED_FIELDS) - len(missing_recommended)
    total = len(_REQUIRED_FIELDS) + len(_RECOMMENDED_FIELDS)
    completed = required_complete + recommended_complete
    return ProfileCompleteness(
        version=COMPLETENESS_VERSION,
        percent=round(completed * 100 / total),
        required_completed=required_complete,
        required_total=len(_REQUIRED_FIELDS),
        recommended_completed=recommended_complete,
        recommended_total=len(_RECOMMENDED_FIELDS),
        missing_required=missing_required,
        missing_recommended=missing_recommended,
    )


def _response(row: Mapping[str, Any]) -> ProfileResponse:
    payload = dict(row)
    payload["completeness"] = calculate_completeness(payload)
    return ProfileResponse.model_validate(payload)


class ProfileService:
    def __init__(self, database: Database, queue: WorkQueue) -> None:
        self._database = database
        self._queue = queue

    async def get(self, user: CurrentUser) -> ProfileResponse:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            row = await uow.profiles.get(user.id)
        if row is None:
            raise ApiError(status_code=404, code="PROFILE_NOT_FOUND", message="Profile not found.")
        return _response(row)

    async def update(self, user: CurrentUser, patch: ProfileUpdate) -> ProfileResponse:
        changes = patch.changes()
        if not changes:
            raise ApiError(
                status_code=422,
                code="EMPTY_PROFILE_UPDATE",
                message="At least one profile field must be provided.",
            )

        matching_changed = False
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            existing = await uow.profiles.get(user.id)
            merged = {
                name: existing[name]
                for name in ProfileFields.model_fields
                if existing is not None and name in existing
            }
            merged.update(changes)
            for required in _REQUIRED_FIELDS:
                if not _is_known(merged.get(required)):
                    raise ApiError(
                        status_code=422,
                        code="INCOMPLETE_PROFILE",
                        message="A new profile requires full_name, country, and study_level.",
                    )
            try:
                validated = ProfileFields.model_validate(merged)
            except ValidationError:
                raise ApiError(
                    status_code=422,
                    code="INVALID_PROFILE_STATE",
                    message="The combined profile fields are invalid.",
                ) from None

            if existing is None:
                matching_changed = True
                data_version = 1
            else:
                matching_changed = any(
                    name in _MATCHING_FIELDS and existing.get(name) != value
                    for name, value in changes.items()
                )
                data_version = int(existing["data_version"]) + (1 if matching_changed else 0)

            row = await uow.profiles.upsert(
                user.id,
                ProfileWrite(
                    **validated.model_dump(),
                    data_version=data_version,
                ),
            )
            if matching_changed:
                try:
                    await self._queue.enqueue_rematch(
                        user.id,
                        data_version,
                        idempotency_key=f"profile-rematch:{user.id}:{data_version}",
                    )
                except Exception:
                    raise ApiError(
                        status_code=503,
                        code="REMATCH_QUEUE_UNAVAILABLE",
                        message="The profile update could not be queued safely. Retry later.",
                    ) from None
        return _response(row)
