"""
Scholarship models for ScholarMatch.
"""
from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime

class ScholarshipStatus(Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    ACTIVE = "active"
    ARCHIVED = "archived"
    REJECTED = "rejected"
    EXPIRED = "expired"

class Scholarship:
    def __init__(
        self,
        id: int,
        title: str = "",
        description: str = "",
        status: ScholarshipStatus = ScholarshipStatus.DRAFT,
        deadline: Optional[datetime] = None,
        amount: Optional[float] = None,
        eligibility_criteria: Optional[Dict] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None
    ):
        self.id = id
        self.title = title
        self.description = description
        self.status = status
        self.deadline = deadline
        self.amount = amount
        self.eligibility_criteria = eligibility_criteria or {}
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
