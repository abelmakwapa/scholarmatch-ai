from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ScholarshipBase(BaseModel):
    title: str
    provider: str
    description: str | None = None
    amount: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    deadline: date | None = None
    eligibility_summary: str | None = None
    application_url: str | None = None
    status: Literal["published", "closed"]


class ScholarshipCreate(ScholarshipBase):
    pass


class ScholarshipResponse(ScholarshipBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
