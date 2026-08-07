"""
User models for ScholarMatch.
"""
from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime

class UserRole(Enum):
    USER = 1
    MODERATOR = 2
    ADMIN = 3

class User:
    def __init__(
        self,
        id: int,
        role: Optional[UserRole] = None,
        email: str = "",
        hashed_password: str = "",
        profile_data: Optional[Dict] = None,
        status: str = "active",
        deletion_requested_at: Optional[datetime] = None,
        deleted_at: Optional[datetime] = None
    ):
        self.id = id
        self.role = role
        self.email = email
        self.hashed_password = hashed_password
        self.profile_data = profile_data or {}
        self.status = status
        self.deletion_requested_at = deletion_requested_at
        self.deleted_at = deleted_at
