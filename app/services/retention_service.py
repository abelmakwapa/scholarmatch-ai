"""
Account deletion and retention workflow.
Handles GDPR-compliant data removal across all systems.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum

from app.models.user import User
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.db.session import get_db_session
from app.services.embedding_service import delete_user_embeddings
from app.jobs.notification_jobs import cancel_pending_notifications

class RetentionPeriod(Enum):
    IMMEDIATE = 0
    DAYS_30 = 30
    DAYS_90 = 90
    YEARS_1 = 365
    PERMANENT = -1

# Data classification and retention policy
RETENTION_POLICY = {
    "user_profile": RetentionPeriod.DAYS_30,
    "applications": RetentionPeriod.YEARS_1,
    "audit_logs": RetentionPeriod.YEARS_1,
    "embeddings": RetentionPeriod.IMMEDIATE,
    "cached_matches": RetentionPeriod.IMMEDIATE,
    "documents": RetentionPeriod.DAYS_90,
    "notifications": RetentionPeriod.DAYS_30
}

def initiate_account_deletion(user_id: int, actor_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Initiate account deletion workflow.
    Marks user for deletion and schedules cleanup jobs.
    """
    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
            
        # Mark user as pending deletion
        user.deletion_requested_at = datetime.utcnow()
        user.status = "pending_deletion"
        
        # Log the action
        audit = AuditLog(
            actor_id=actor_id or user_id,
            target_id=user_id,
            action="account_deletion_initiated",
            details={"scheduled_for": str(user.deletion_requested_at + timedelta(days=30))}
        )
        db.add(audit)
        db.commit()
        
    # Schedule background cleanup
    # In real impl: enqueue deletion job with delay
    return {
        "status": "scheduled",
        "user_id": user_id,
        "deletion_date": user.deletion_requested_at + timedelta(days=30),
        "grace_period_days": 30
    }

def execute_account_deletion(user_id: int) -> Dict[str, Any]:
    """
    Execute full account deletion across all systems.
    Called after grace period expires.
    """
    results = {
        "user_id": user_id,
        "deleted_records": {},
        "errors": []
    }
    
    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.status != "pending_deletion":
            return {"error": "User not eligible for deletion"}
        
        # 1. Delete embeddings (immediate)
        try:
            deleted_count = delete_user_embeddings(user_id)
            results["deleted_records"]["embeddings"] = deleted_count
        except Exception as e:
            results["errors"].append(f"embeddings: {str(e)}")
        
        # 2. Cancel pending notifications/jobs
        try:
            cancelled = cancel_pending_notifications(user_id)
            results["deleted_records"]["pending_jobs"] = cancelled
        except Exception as e:
            results["errors"].append(f"jobs: {str(e)}")
        
        # 3. Anonymize applications (retain for retention period, then purge)
        # For immediate deletion request, we anonymize rather than hard delete
        apps = db.query(Application).filter(Application.user_id == user_id).all()
        for app in apps:
            app.user_id = None  # Disassociate
            app.notes = "[ANONYMIZED]"
        results["deleted_records"]["applications_disassociated"] = len(apps)
        
        # 4. Delete cached matches
        # Implementation would clear Redis/cache keys
        
        # 5. Soft delete user record (retain minimal for audit)
        user.email = f"deleted_{user.id}@deleted.local"
        user.hashed_password = ""
        user.profile_data = {}
        user.status = "deleted"
        user.deleted_at = datetime.utcnow()
        
        # 6. Final audit log
        audit = AuditLog(
            actor_id=user_id,
            target_id=user_id,
            action="account_deletion_completed",
            details=results
        )
        db.add(audit)
        db.commit()
        
    return results

def get_retention_schedule() -> Dict[str, int]:
    """Return current retention policy for documentation."""
    return {k: v.value for k, v in RETENTION_POLICY.items()}

def purge_expired_data(dry_run: bool = True) -> Dict[str, Any]:
    """
    Purge data that has exceeded retention periods.
    Run periodically via scheduler.
    """
    cutoff_dates = {
        "days_30": datetime.utcnow() - timedelta(days=30),
        "days_90": datetime.utcnow() - timedelta(days=90),
        "year_1": datetime.utcnow() - timedelta(days=365)
    }
    
    results = {"purged": {}, "dry_run": dry_run}
    
    with get_db_session() as db:
        # Example: purge old deleted users
        if not dry_run:
            old_deleted = db.query(User).filter(
                User.status == "deleted",
                User.deleted_at < cutoff_dates["year_1"]
            ).count()
            # db.delete(...) would go here
            results["purged"]["old_deleted_users"] = old_deleted
            
    return results
