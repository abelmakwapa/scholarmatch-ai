"""
Audit log models for ScholarMatch.
Append-only audit trail for admin actions and sensitive operations.
"""
from typing import Optional, Dict, Any
from datetime import datetime

class AuditLog:
    def __init__(
        self,
        actor_id: int,
        action: str,
        target_id: Any,
        details: Optional[Dict] = None,
        timestamp: Optional[datetime] = None
    ):
        self.actor_id = actor_id
        self.action = action
        self.target_id = target_id
        self.details = details or {}
        self.timestamp = timestamp or datetime.utcnow()
