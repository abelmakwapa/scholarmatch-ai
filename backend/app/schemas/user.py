from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    country: str = Field(min_length=2, max_length=2)
    study_level: Literal["undergraduate", "postgraduate", "doctoral", "other"]
    field_of_study: str | None = Field(default=None, max_length=200)
    gpa: float | None = Field(None, ge=0.0, le=4.0)
    interests: list[str] = Field(max_length=50)
    goals: str | None = Field(default=None, max_length=4000)


class ProfileCreate(ProfileBase):
    pass


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    country: str | None = Field(default=None, min_length=2, max_length=2)
    study_level: Literal["undergraduate", "postgraduate", "doctoral", "other"] | None = None
    field_of_study: str | None = Field(default=None, max_length=200)
    gpa: float | None = Field(None, ge=0.0, le=4.0)
    interests: list[str] | None = Field(default=None, max_length=50)
    goals: str | None = Field(default=None, max_length=4000)


class ProfileResponse(ProfileBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
