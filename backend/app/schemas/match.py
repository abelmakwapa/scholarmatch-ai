from datetime import date, datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RuleStrength(StrEnum):
    HARD = "hard"
    SOFT = "soft"


class RuleField(StrEnum):
    COUNTRY = "country"
    DESTINATION = "destination"
    NATIONALITY = "nationality"
    RESIDENCY = "residency"
    STUDY_LEVEL = "study_level"
    FIELD_OF_STUDY = "field_of_study"
    GPA = "gpa"
    AGE = "age"
    DATE_OF_BIRTH = "date_of_birth"
    INSTITUTION = "institution"
    EXPERIENCE = "experience"
    EXPERIENCE_MONTHS = "experience_months"
    DOCUMENT = "document"
    DEADLINE = "deadline"
    OTHER = "other"


class RuleOperator(StrEnum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    IN = "in"
    NOT_IN = "not_in"
    GTE = "gte"
    LTE = "lte"
    CONTAINS = "contains"
    EXISTS = "exists"


class RuleOutcome(StrEnum):
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    UNKNOWN = "unknown"


class RuleSource(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(default="normalized_catalog", min_length=1, max_length=200)
    source_url: str | None = None
    summary: str | None = Field(default=None, max_length=2000)


class GPATarget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: float = Field(ge=0, le=100)
    scale: float = Field(gt=0, le=100)

    @model_validator(mode="after")
    def score_within_scale(self) -> "GPATarget":
        if self.score > self.scale:
            raise ValueError("GPA score must not exceed its scale")
        return self


class NormalizedRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    field: RuleField
    operator: RuleOperator
    value: Any
    strength: RuleStrength
    source: RuleSource
    version: int = Field(ge=1)

    @model_validator(mode="after")
    def validate_field_operator_value(self) -> "NormalizedRule":
        string_fields = {
            RuleField.COUNTRY,
            RuleField.DESTINATION,
            RuleField.NATIONALITY,
            RuleField.RESIDENCY,
            RuleField.STUDY_LEVEL,
            RuleField.FIELD_OF_STUDY,
            RuleField.INSTITUTION,
            RuleField.DOCUMENT,
        }
        if self.operator is RuleOperator.EXISTS:
            if self.value is not True:
                raise ValueError("exists rules must use true")
            return self
        if self.field is RuleField.GPA:
            if self.operator not in {
                RuleOperator.EQUALS,
                RuleOperator.GTE,
                RuleOperator.LTE,
            }:
                raise ValueError("GPA supports equals, gte, and lte")
            GPATarget.model_validate(self.value)
            return self
        if self.field in {RuleField.AGE, RuleField.EXPERIENCE, RuleField.EXPERIENCE_MONTHS}:
            if self.operator not in {
                RuleOperator.EQUALS,
                RuleOperator.GTE,
                RuleOperator.LTE,
                RuleOperator.IN,
            }:
                raise ValueError("numeric rules support equals, gte, lte, and in")
            values = self.value if isinstance(self.value, list) else [self.value]
            if not values or any(not isinstance(item, int) or item < 0 for item in values):
                raise ValueError("numeric rule values must be non-negative integers")
            return self
        if self.field is RuleField.DATE_OF_BIRTH:
            if self.operator not in {
                RuleOperator.EQUALS,
                RuleOperator.GTE,
                RuleOperator.LTE,
            }:
                raise ValueError("date rules support equals, gte, and lte")
            if isinstance(self.value, date):
                return self
            date.fromisoformat(str(self.value))
            return self
        if self.field in string_fields:
            if self.operator not in {
                RuleOperator.EQUALS,
                RuleOperator.NOT_EQUALS,
                RuleOperator.IN,
                RuleOperator.NOT_IN,
                RuleOperator.CONTAINS,
            }:
                raise ValueError("text rules use equality, membership, or contains")
            values = self.value if isinstance(self.value, list) else [self.value]
            if not values or any(not isinstance(item, str) or not item.strip() for item in values):
                raise ValueError("text rule values must be non-empty strings")
            return self
        raise ValueError("the rule field is not supported by the deterministic MVP")


class RuleResult(BaseModel):
    rule_id: UUID | None
    field: RuleField
    operator: RuleOperator
    strength: RuleStrength
    outcome: RuleOutcome
    reason_code: str
    message: str
    missing_profile_fields: list[str] = Field(default_factory=list)
    source: RuleSource
    rule_version: int = Field(ge=1)


class EligibilityResult(BaseModel):
    outcome: RuleOutcome
    hard_rule_results: list[RuleResult]
    soft_rule_results: list[RuleResult]
    reasons: list[str]
    missing_profile_fields: list[str]


class ScoreComponent(BaseModel):
    name: Literal[
        "academic_fit",
        "eligibility_fit",
        "interests_goals",
        "experience",
        "readiness_timing",
    ]
    formula_version: str = Field(min_length=1, max_length=100)
    score: float = Field(ge=0, le=1)
    weight: float = Field(ge=0, le=1)
    weighted_score: float = Field(ge=0, le=1)
    evidence: list[str]


class ScoringWeights(BaseModel):
    model_config = ConfigDict(extra="forbid")

    academic_fit: float = Field(default=0.30, ge=0, le=1)
    eligibility_fit: float = Field(default=0.30, ge=0, le=1)
    interests_goals: float = Field(default=0.15, ge=0, le=1)
    experience: float = Field(default=0.10, ge=0, le=1)
    readiness_timing: float = Field(default=0.15, ge=0, le=1)

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "ScoringWeights":
        total = sum(self.model_dump().values())
        if abs(total - 1.0) > 1e-9:
            raise ValueError("matching weights must sum to 1.0")
        return self


class DeterministicMatchResult(BaseModel):
    scholarship_id: UUID
    eligibility: EligibilityResult
    components: list[ScoreComponent]
    total_score: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    algorithm_version: str


class MatchScholarshipSummary(BaseModel):
    id: UUID
    title: str
    provider: str
    deadline: date | None
    funding_type: str


class MatchListItem(BaseModel):
    id: UUID
    scholarship: MatchScholarshipSummary
    rank_score: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    eligibility: RuleOutcome
    missing_profile_fields: list[str]
    algorithm_version: str
    profile_data_version: int
    scholarship_data_version: int
    calculated_at: datetime


class MatchPage(BaseModel):
    data: list[MatchListItem]
    next_cursor: str | None
    has_more: bool
    limit: int


class MatchDetail(MatchListItem):
    rule_results: list[RuleResult]
    score_breakdown: list[ScoreComponent]
    reasons: list[str]


class RecalculationResponse(BaseModel):
    mode: Literal["existing", "immediate", "accepted"]
    job_id: UUID | None = None
    candidate_count: int = Field(ge=0)
    calculated_count: int = Field(ge=0)
    reused_count: int = Field(ge=0)
    excluded_count: int = Field(ge=0)
    profile_data_version: int = Field(ge=1)
    algorithm_version: str
