from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

_ISO_COUNTRY_CODES = frozenset(
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL "
    "BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW "
    "CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF "
    "GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ "
    "IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV "
    "LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE "
    "NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS "
    "RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH "
    "TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT "
    "ZA ZM ZW".split()
)


def _country_code(value: str) -> str:
    normalized = value.strip().upper()
    if normalized not in _ISO_COUNTRY_CODES:
        raise ValueError("must be an ISO 3166-1 alpha-2 country code")
    return normalized


CountryCode = Annotated[str, AfterValidator(_country_code)]
StudyLevel = Literal[
    "secondary", "undergraduate", "postgraduate", "doctoral", "vocational", "other"
]


def _normalize_items(items: list[str], *, maximum: int) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in items:
        clean = item.strip()
        if not clean or len(clean) > maximum:
            raise ValueError(f"items must contain between 1 and {maximum} characters")
        key = clean.casefold()
        if key in seen:
            raise ValueError("duplicate items are not allowed")
        seen.add(key)
        normalized.append(clean)
    return normalized


class ProfileFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: str = Field(min_length=1, max_length=200)
    country: CountryCode
    study_level: StudyLevel
    field_of_study: str | None = Field(default=None, max_length=200)
    gpa: float | None = Field(default=None, ge=0)
    gpa_scale: float | None = Field(default=None, gt=0, le=100)
    nationality_country: CountryCode | None = None
    residence_country: CountryCode | None = None
    date_of_birth: date | None = None
    interests: list[str] = Field(default_factory=list, max_length=50)
    target_countries: list[CountryCode] = Field(default_factory=list, max_length=50)
    goals: str | None = Field(default=None, max_length=4000)
    requires_financial_aid: bool | None = None
    willing_to_relocate: bool | None = None

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, value: date | None) -> date | None:
        if value is not None and (value > date.today() or value < date(1900, 1, 1)):
            raise ValueError("must be a valid date in the past")
        return value

    @field_validator("interests")
    @classmethod
    def normalize_interests(cls, value: list[str]) -> list[str]:
        return _normalize_items(value, maximum=100)

    @field_validator("target_countries")
    @classmethod
    def unique_target_countries(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("duplicate countries are not allowed")
        return value

    @model_validator(mode="after")
    def validate_gpa_scale(self) -> "ProfileFields":
        if (self.gpa is None) != (self.gpa_scale is None):
            raise ValueError("gpa and gpa_scale must be provided together")
        if self.gpa is not None and self.gpa_scale is not None and self.gpa > self.gpa_scale:
            raise ValueError("gpa cannot exceed gpa_scale")
        return self


class ProfileCreate(ProfileFields):
    pass


class ProfileUpdate(BaseModel):
    """Partial profile mutation; omitted and explicit null fields remain distinct."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    country: CountryCode | None = None
    study_level: StudyLevel | None = None
    field_of_study: str | None = Field(default=None, max_length=200)
    gpa: float | None = Field(default=None, ge=0)
    gpa_scale: float | None = Field(default=None, gt=0, le=100)
    nationality_country: CountryCode | None = None
    residence_country: CountryCode | None = None
    date_of_birth: date | None = None
    interests: list[str] | None = Field(default=None, max_length=50)
    target_countries: list[CountryCode] | None = Field(default=None, max_length=50)
    goals: str | None = Field(default=None, max_length=4000)
    requires_financial_aid: bool | None = None
    willing_to_relocate: bool | None = None

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, value: date | None) -> date | None:
        return ProfileFields.validate_date_of_birth(value)

    @field_validator("interests")
    @classmethod
    def normalize_interests(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _normalize_items(value, maximum=100)

    @field_validator("target_countries")
    @classmethod
    def unique_target_countries(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and len(value) != len(set(value)):
            raise ValueError("duplicate countries are not allowed")
        return value

    def changes(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


class ProfileCompleteness(BaseModel):
    version: str
    percent: int = Field(ge=0, le=100)
    required_completed: int = Field(ge=0)
    required_total: int = Field(ge=0)
    recommended_completed: int = Field(ge=0)
    recommended_total: int = Field(ge=0)
    missing_required: list[str]
    missing_recommended: list[str]


class ProfileResponse(ProfileFields):
    id: UUID
    data_version: int = Field(ge=1)
    completeness: ProfileCompleteness
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class DocumentType(StrEnum):
    TRANSCRIPT = "transcript"
    CV = "cv"
    RECOMMENDATION_LETTER = "recommendation_letter"
    PERSONAL_STATEMENT = "personal_statement"
    IDENTITY_DOCUMENT = "identity_document"
    FINANCIAL_DOCUMENT = "financial_document"
    OTHER = "other"


class DocumentStatus(StrEnum):
    UPLOADED = "uploaded"
    SCANNING = "scanning"
    READY = "ready"
    REJECTED = "rejected"
    DELETED = "deleted"


class DocumentRename(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    display_name: str = Field(min_length=1, max_length=200)


class DocumentResponse(BaseModel):
    id: UUID
    document_type: DocumentType
    display_name: str
    original_filename: str
    mime_type: str
    size_bytes: int = Field(gt=0)
    checksum_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    status: DocumentStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="ignore")


class DocumentPage(BaseModel):
    items: list[DocumentResponse]
    total_bytes: int = Field(ge=0)


class SignedDocumentUrlResponse(BaseModel):
    url: str
    expires_at: datetime


class DocumentUploadPolicy(BaseModel):
    allowed_mime_types: list[str]
    allowed_extensions: list[str]
    maximum_size_bytes: int
    maximum_document_count: int
    total_quota_bytes: int
