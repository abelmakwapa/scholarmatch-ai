from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date

class ScholarshipBase(BaseModel):
    title: str
    provider: str
    amount: Optional[float] = None
    eligibility_criteria: Optional[str] = None
    requirements: Optional[List[str]] = None
    deadline: Optional[date] = None
    description: Optional[str] = None

class ScholarshipCreate(ScholarshipBase):
    pass

class ScholarshipResponse(ScholarshipBase):
    id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}