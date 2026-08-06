from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID


@dataclass(frozen=True, slots=True)
class RequirementWrite:
    constraint_type: Literal["hard", "soft"]
    field: Literal[
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
    operator: Literal["equals", "not_equals", "in", "not_in", "gte", "lte", "contains", "exists"]
    value: Any
    source_evidence: dict[str, Any]
    position: int
    reviewer_notes: str | None = None


@dataclass(frozen=True, slots=True)
class ApplicationWrite:
    profile_id: UUID
    scholarship_id: UUID
    status: Literal[
        "saved",
        "preparing",
        "ready",
        "submitted",
        "interview",
        "awarded",
        "unsuccessful",
        "withdrawn",
    ] = "saved"
    notes: str | None = None


@dataclass(frozen=True, slots=True)
class MatchWrite:
    profile_id: UUID
    scholarship_id: UUID
    total_score: float
    confidence: float
    score_breakdown: list[dict[str, Any]]
    requirement_evidence: list[dict[str, Any]]
    deterministic_explanation: dict[str, Any]
    ai_explanation: dict[str, Any] | None
    explanation_status: Literal["pending", "ready", "unavailable"]
    algorithm_version: str
    embedding_version: str | None
    profile_data_version: int
    scholarship_data_version: int
    stale_reasons: list[str]
    calculated_at: datetime


@dataclass(frozen=True, slots=True)
class IngestionRunWrite:
    source: str
    source_url: str | None
    dry_run: bool
    created_by: UUID
    original_run_id: UUID | None = None


@dataclass(frozen=True, slots=True)
class AuditEventWrite:
    actor_id: UUID
    action: str
    target_type: Literal["scholarship", "ingestion_run", "duplicate_group", "verification"]
    target_id: UUID
    target_name: str
    summary: str
    metadata: dict[str, Any]


@dataclass(frozen=True, slots=True)
class ProfileWrite:
    full_name: str
    country: str
    study_level: str
    field_of_study: str | None
    gpa: float | None
    gpa_scale: float | None
    nationality_country: str | None
    residence_country: str | None
    date_of_birth: date | None
    interests: list[str]
    target_countries: list[str]
    goals: str | None
    requires_financial_aid: bool | None
    willing_to_relocate: bool | None
    data_version: int


@dataclass(frozen=True, slots=True)
class DocumentWrite:
    id: UUID
    profile_id: UUID
    storage_bucket: str
    storage_object_path: str
    document_type: str
    display_name: str
    original_filename: str
    mime_type: str
    size_bytes: int
    checksum_sha256: str
