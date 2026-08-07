"""
Application models for ScholarMatch.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class ApplicationStatus(Enum):
    SAVED = "saved"
    PREPARING = "preparing"
    READY = "ready"
    SUBMITTED = "submitted"
    INTERVIEW = "interview"
    AWARDED = "awarded"
    UNSUCCESSFUL = "unsuccessful"
    WITHDRAWN = "withdrawn"

# State machine: allowed transitions
ALLOWED_TRANSITIONS = {
    ApplicationStatus.SAVED: {ApplicationStatus.PREPARING, ApplicationStatus.WITHDRAWN},
    ApplicationStatus.PREPARING: {ApplicationStatus.READY, ApplicationStatus.SAVED, ApplicationStatus.WITHDRAWN},
    ApplicationStatus.READY: {ApplicationStatus.SUBMITTED, ApplicationStatus.PREPARING, ApplicationStatus.WITHDRAWN},
    ApplicationStatus.SUBMITTED: {ApplicationStatus.INTERVIEW, ApplicationStatus.UNSUCCESSFUL, ApplicationStatus.WITHDRAWN},
    ApplicationStatus.INTERVIEW: {ApplicationStatus.AWARDED, ApplicationStatus.UNSUCCESSFUL, ApplicationStatus.WITHDRAWN},
    ApplicationStatus.AWARDED: set(),  # Terminal state
    ApplicationStatus.UNSUCCESSFUL: {ApplicationStatus.WITHDRAWN},
    ApplicationStatus.WITHDRAWN: set()  # Terminal state
}

class Application:
    def __init__(
        self,
        id: int,
        user_id: Optional[int],
        scholarship_id: int,
        status: ApplicationStatus = ApplicationStatus.SAVED,
        checklist_items: Optional[List[Dict]] = None,
        notes: str = "",
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None
    ):
        self.id = id
        self.user_id = user_id
        self.scholarship_id = scholarship_id
        self.status = status
        self.checklist_items = checklist_items or []
        self.notes = notes
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()

class ApplicationStatusHistory:
    def __init__(
        self,
        application_id: int,
        old_status: ApplicationStatus,
        new_status: ApplicationStatus,
        actor_id: int,
        timestamp: Optional[datetime] = None
    ):
        self.application_id = application_id
        self.old_status = old_status
        self.new_status = new_status
        self.actor_id = actor_id
        self.timestamp = timestamp or datetime.utcnow()

def is_valid_transition(current: ApplicationStatus, target: ApplicationStatus) -> bool:
    """Check if a state transition is allowed."""
    return target in ALLOWED_TRANSITIONS.get(current, set())
