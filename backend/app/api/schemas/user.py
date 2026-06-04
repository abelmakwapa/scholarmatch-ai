from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class ProfileBase(BaseModel):
    full_name: str
    email: EmailStr
    gpa: Optional[float] = Field(None, ge=0.0, le=4.0)
    major: Optional[str] = None
    interests: Optional[List[str]] = None
    bio: Optional[str] = None

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    gpa: Optional[float] = Field(None, ge=0.0, le=4.0)
    major: Optional[str] = None
    interests: Optional[List[str]] = None
    bio: Optional[str] = None

class ProfileResponse(ProfileBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}