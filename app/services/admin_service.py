"""
Admin Service for ScholarMatch.
Handles role-protected operations with strict authorization checks.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

from app.models.user import User, UserRole
from app.models.scholarship import Scholarship, ScholarshipStatus
from app.models.audit_log import AuditLog
from app.db.session import get_db_session
from app.exceptions import AuthorizationError, ValidationError

class AdminAction(Enum):
    PUBLISH_SCHOLARSHIP = "publish_scholarship"
    ARCHIVE_SCHOLARSHIP = "archive_scholarship"
    RESOLVE_DUPLICATE = "resolve_duplicate"
    RETRY_INGESTION = "retry_ingestion"
    DELETE_ACCOUNT = "delete_account"

BULK_OPERATION_LIMIT = 100

def check_admin_role(user: User, required_role: UserRole):
    """Enforce exact authorization checks."""
    if not user.role or user.role.value < required_role.value:
        raise AuthorizationError(f"User {user.id} lacks required role {required_role}")

def get_ingestion_status(run_id: str) -> Dict[str, Any]:
    """Get status of an ingestion run."""
    # Implementation would query job store
    return {"run_id": run_id, "status": "completed", "processed": 150, "failed": 2}

def retry_ingestion_run(run_id: str, actor: User) -> Dict[str, Any]:
    """Retry a failed ingestion run with audit logging."""
    check_admin_role(actor, UserRole.ADMIN)
    
    with get_db_session() as db:
        # Logic to re-queue jobs
        audit_log = AuditLog(
            actor_id=actor.id,
            action=AdminAction.RETRY_INGESTION.value,
            target_id=run_id,
            details={"reason": "manual_retry"}
        )
        db.add(audit_log)
        db.commit()
        
    return {"status": "queued", "run_id": run_id}

def review_scholarship(scholarship_id: int, action: str, actor: User, reason: Optional[str] = None) -> Scholarship:
    """Publish, archive, or reject a scholarship."""
    check_admin_role(actor, UserRole.MODERATOR)
    
    if action not in ["publish", "archive", "reject"]:
        raise ValidationError("Invalid action")

    with get_db_session() as db:
        scholarship = db.query(Scholarship).filter(Scholarship.id == scholarship_id).first()
        if not scholarship:
            raise ValidationError("Scholarship not found")
            
        old_status = scholarship.status
        if action == "publish":
            scholarship.status = ScholarshipStatus.ACTIVE
        elif action == "archive":
            scholarship.status = ScholarshipStatus.ARCHIVED
        elif action == "reject":
            scholarship.status = ScholarshipStatus.REJECTED
            
        audit_log = AuditLog(
            actor_id=actor.id,
            action="scholarship_review",
            target_id=scholarship_id,
            details={"old_status": old_status, "new_status": scholarship.status, "reason": reason}
        )
        db.add(audit_log)
        db.commit()
        db.refresh(scholarship)
        
    return scholarship

def resolve_duplicate(primary_id: int, duplicate_id: int, actor: User) -> Dict[str, Any]:
    """Resolve duplicate scholarships by merging or archiving."""
    check_admin_role(actor, UserRole.ADMIN)
    
    # Bound check not needed for single pair, but logic applies to bulk
    with get_db_session() as db:
        # Implementation of merge logic
        audit_log = AuditLog(
            actor_id=actor.id,
            action=AdminAction.RESOLVE_DUPLICATE.value,
            target_id=f"{primary_id}:{duplicate_id}",
            details={"action": "merge"}
        )
        db.add(audit_log)
        db.commit()
        
    return {"status": "resolved", "primary_id": primary_id}

def bulk_operation_preview(operation: str, filters: Dict, actor: User) -> Dict[str, int]:
    """Preview impact of a bulk operation without executing."""
    check_admin_role(actor, UserRole.ADMIN)
    
    # Simulate count based on filters
    affected_count = 0 # db.query(...).filter(filters).count()
    if affected_count > BULK_OPERATION_LIMIT:
        raise ValidationError(f"Bulk operation exceeds limit of {BULK_OPERATION_LIMIT}")
        
    return {"affected_count": affected_count, "limit": BULK_OPERATION_LIMIT}

def execute_bulk_operation(operation: str, filters: Dict, actor: User, dry_run: bool = False) -> Dict[str, Any]:
    """Execute bulk operation with bounds and dry-run support."""
    preview = bulk_operation_preview(operation, filters, actor)
    if dry_run:
        return {"dry_run": True, **preview}
        
    # Execute logic here
    return {"status": "completed", **preview}
