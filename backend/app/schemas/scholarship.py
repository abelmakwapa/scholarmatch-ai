from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any, Literal
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.user import CountryCode


class FundingType(StrEnum):
    FULL = "full"
    PARTIAL = "partial"
    TUITION = "tuition"
    STIPEND = "stipend"
    RESEARCH = "research"
    OTHER = "other"


class ScholarshipStatus(StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"
    EXPIRED = "expired"
    ARCHIVED = "archived"


class ScholarshipSort(StrEnum):
    DEADLINE_ASC = "deadline_asc"
    RECENTLY_PUBLISHED = "recently_published"
    AMOUNT_DESC = "amount_desc"
    TITLE_ASC = "title_asc"


StudyLevel = Literal[
    "secondary", "undergraduate", "postgraduate", "doctoral", "vocational", "other"
]
RequirementField = Literal[
    "study_level",
    "field_of_study",
    "destination",
    "nationality",
    "residency",
    "gpa",
    "experience",
    "document",
    "other",
]
RequirementOperator = Literal[
    "equals", "not_equals", "in", "not_in", "gte", "lte", "contains", "exists"
]


def _https_url(value: str | None) -> str | None:
    if value is None:
        return None
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("must be an absolute HTTPS URL without credentials")
    return value


def _normalized_items(values: list[str], *, maximum_length: int = 300) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = value.strip()
        if not clean or len(clean) > maximum_length:
            raise ValueError("array items are blank or too long")
        key = clean.casefold()
        if key in seen:
            raise ValueError("duplicate array items are not allowed")
        seen.add(key)
        normalized.append(clean)
    return normalized


class ProviderResponse(BaseModel):
    id: UUID
    name: str
    website_url: str | None


class RequirementResponse(BaseModel):
    id: UUID
    constraint_type: Literal["hard", "soft"]
    field: RequirementField
    operator: RequirementOperator
    value: Any
    source_evidence: dict[str, Any]
    position: int
    version: int


class ScholarshipProvenance(BaseModel):
    source: str
    source_record_id: str
    source_url: str
    source_version: str
    first_seen_at: datetime
    last_seen_at: datetime
    trusted: bool


class ScholarshipResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "30000000-0000-0000-0000-000000000001",
                    "provider": {
                        "id": "20000000-0000-0000-0000-000000000001",
                        "name": "Global Science Foundation",
                        "website_url": "https://fixtures.example/",
                    },
                    "title": "Global Science Scholarship",
                    "amount": "10000.00",
                    "currency": "USD",
                    "funding_type": "partial",
                    "study_levels": ["undergraduate"],
                    "fields_of_study": ["Science"],
                    "destination_countries": ["US"],
                    "source_url": "https://fixtures.example/scholarships/global-science",
                    "verified_at": "2026-08-06T12:00:00Z",
                    "data_version": 1,
                }
            ]
        }
    )

    id: UUID
    provider: ProviderResponse
    title: str
    description: str | None
    amount: Decimal | None
    currency: str | None
    funding_type: FundingType
    funding_summary: str | None
    study_levels: list[StudyLevel]
    fields_of_study: list[str]
    destination_countries: list[CountryCode]
    nationality_requirements: list[str]
    residency_requirements: list[str]
    required_documents: list[str]
    deadline: date | None
    deadline_at: datetime | None
    deadline_timezone: str | None
    eligibility_summary: str | None
    source_url: str
    application_url: str | None
    verified_at: datetime | None
    published_at: datetime | None
    data_version: int
    requirements: list[RequirementResponse] = Field(default_factory=list)
    provenance: list[ScholarshipProvenance] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ScholarshipPage(BaseModel):
    data: list[ScholarshipResponse]
    next_cursor: str | None
    has_more: bool
    limit: int


class CatalogFilters(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    query: str | None = Field(default=None, min_length=1, max_length=200)
    study_level: StudyLevel | None = None
    field_of_study: str | None = Field(default=None, min_length=1, max_length=200)
    destination: CountryCode | None = None
    nationality: CountryCode | None = None
    residency: CountryCode | None = None
    funding_type: FundingType | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    deadline_from: date | None = None
    deadline_to: date | None = None
    verified: bool | None = None
    sort: ScholarshipSort = ScholarshipSort.DEADLINE_ASC

    @model_validator(mode="after")
    def validate_range_and_sort(self) -> "CatalogFilters":
        if self.deadline_from and self.deadline_to and self.deadline_from > self.deadline_to:
            raise ValueError("deadline_from must not be after deadline_to")
        if self.sort is ScholarshipSort.AMOUNT_DESC and self.currency is None:
            raise ValueError("currency is required for amount sorting")
        return self


class RequirementWriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    constraint_type: Literal["hard", "soft"]
    field: RequirementField
    operator: RequirementOperator
    value: str | int | float | bool | list[str]
    source_evidence: dict[str, Any] = Field(default_factory=dict)
    reviewer_notes: str | None = Field(default=None, max_length=3000)
    position: int = Field(ge=0, le=999)


class AdminScholarshipWrite(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        json_schema_extra={
            "examples": [
                {
                    "provider_name": "Global Science Foundation",
                    "provider_website_url": "https://fixtures.example/",
                    "title": "Global Science Scholarship",
                    "amount": "10000.00",
                    "currency": "USD",
                    "funding_type": "partial",
                    "study_levels": ["undergraduate"],
                    "destination_countries": ["US"],
                    "deadline": "2027-05-31",
                    "source_url": "https://fixtures.example/scholarships/global-science",
                    "requirements": [
                        {
                            "constraint_type": "hard",
                            "field": "study_level",
                            "operator": "in",
                            "value": ["undergraduate"],
                            "position": 0,
                        }
                    ],
                }
            ]
        },
    )

    provider_name: str = Field(min_length=1, max_length=300)
    provider_website_url: str | None = None
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=20000)
    amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    funding_type: FundingType = FundingType.OTHER
    funding_summary: str | None = Field(default=None, max_length=2000)
    study_levels: list[StudyLevel] = Field(default_factory=list, max_length=10)
    fields_of_study: list[str] = Field(default_factory=list, max_length=100)
    destination_countries: list[CountryCode] = Field(default_factory=list, max_length=50)
    nationality_requirements: list[str] = Field(default_factory=list, max_length=100)
    residency_requirements: list[str] = Field(default_factory=list, max_length=100)
    required_documents: list[str] = Field(default_factory=list, max_length=100)
    deadline: date | None = None
    deadline_at: datetime | None = None
    deadline_timezone: str | None = Field(default=None, max_length=100)
    eligibility_summary: str | None = Field(default=None, max_length=4000)
    source_url: str
    application_url: str | None = None
    reviewer_notes: str | None = Field(default=None, max_length=5000)
    requirements: list[RequirementWriteRequest] = Field(default_factory=list, max_length=100)

    @field_validator("provider_website_url", "source_url", "application_url")
    @classmethod
    def validate_urls(cls, value: str | None) -> str | None:
        return _https_url(value)

    @field_validator(
        "fields_of_study",
        "nationality_requirements",
        "residency_requirements",
        "required_documents",
    )
    @classmethod
    def normalize_arrays(cls, value: list[str]) -> list[str]:
        return _normalized_items(value)

    @model_validator(mode="after")
    def validate_amount_and_deadline(self) -> "AdminScholarshipWrite":
        if (self.amount is None) != (self.currency is None):
            raise ValueError("amount and currency must be provided together")
        if self.deadline_at is not None and self.deadline is None:
            raise ValueError("deadline is required when deadline_at is provided")
        return self


class AdminScholarshipPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    expected_data_version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=20000)
    amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    funding_type: FundingType | None = None
    funding_summary: str | None = Field(default=None, max_length=2000)
    study_levels: list[StudyLevel] | None = Field(default=None, max_length=10)
    fields_of_study: list[str] | None = Field(default=None, max_length=100)
    destination_countries: list[CountryCode] | None = Field(default=None, max_length=50)
    nationality_requirements: list[str] | None = Field(default=None, max_length=100)
    residency_requirements: list[str] | None = Field(default=None, max_length=100)
    required_documents: list[str] | None = Field(default=None, max_length=100)
    deadline: date | None = None
    deadline_at: datetime | None = None
    deadline_timezone: str | None = Field(default=None, max_length=100)
    eligibility_summary: str | None = Field(default=None, max_length=4000)
    application_url: str | None = None
    reviewer_notes: str | None = Field(default=None, max_length=5000)

    @field_validator("application_url")
    @classmethod
    def validate_application_url(cls, value: str | None) -> str | None:
        return _https_url(value)

    @field_validator(
        "fields_of_study",
        "nationality_requirements",
        "residency_requirements",
        "required_documents",
    )
    @classmethod
    def normalize_optional_arrays(cls, value: list[str] | None) -> list[str] | None:
        return _normalized_items(value) if value is not None else None

    def changes(self) -> dict[str, Any]:
        values = self.model_dump(exclude_unset=True)
        values.pop("expected_data_version", None)
        return values


class LifecycleTransition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["submit_for_review", "review", "publish", "unpublish", "expire", "archive"]
    expected_data_version: int = Field(ge=1)
    reviewer_notes: str | None = Field(default=None, max_length=3000)

    @model_validator(mode="after")
    def require_review_notes(self) -> "LifecycleTransition":
        if self.action == "review" and not self.reviewer_notes:
            raise ValueError("reviewer_notes are required when recording a review")
        return self


class AdminScholarshipResponse(ScholarshipResponse):
    status: ScholarshipStatus
    reviewer_notes: str | None
    allowed_transitions: list[str]


class IngestionRunCreate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "source": "fixture",
                    "fixture_name": "baseline",
                    "dry_run": False,
                    "batch_size": 100,
                }
            ]
        },
    )

    source: Literal["fixture"] = "fixture"
    fixture_name: Literal["baseline", "changed", "partial"] = "baseline"
    dry_run: bool = False
    batch_size: int = Field(default=100, ge=1, le=500)


class IngestionRunResponse(BaseModel):
    id: UUID
    source: str
    adapter_version: str
    source_version: str | None
    dry_run: bool
    status: Literal[
        "queued", "running", "partial", "completed", "failed", "dead_lettered", "cancelled"
    ]
    counters: dict[str, int]
    safe_errors: list[dict[str, Any]]
    original_run_id: UUID | None
    batch_size: int
    resume_cursor: int
    attempt_count: int
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScholarshipCreate(BaseModel):
    """Compatibility input for the original scaffold boundary tests."""

    title: str = Field(min_length=1, max_length=300)
    provider: str = Field(min_length=1, max_length=300)
    description: str | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    deadline: date | None = None
    eligibility_summary: str | None = None
    application_url: str | None = None
    status: Literal["published", "closed"]
