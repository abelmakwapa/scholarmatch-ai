"""Application tracking domain models."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal
from uuid import UUID


@dataclass(frozen=True, slots=True)
class ChecklistItem:
    """A single checklist item for an application."""

    id: str
    description: str
    completed: bool
    required: bool
    notes: str | None = None


@dataclass(frozen=True, slots=True)
class StatusHistoryEntry:
    """An entry in the application status history."""

    status: Literal[
        "saved",
        "preparing",
        "ready",
        "submitted",
        "interview",
        "awarded",
        "unsuccessful",
        "withdrawn",
    ]
    actor_id: UUID
    timestamp: datetime
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class PrivateNote:
    """A private note on an application."""

    id: str
    content: str
    author_id: UUID
    created_at: datetime
    updated_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class ApplicationWrite:
    """Write model for application operations."""

    profile_id: UUID
    scholarship_id: UUID
    status: Literal[
        "saved",
        "preparing",
        "ready",
        "submitted",
        "interview",
        "awarded",
        "unsuccessful",
        "withdrawn",
    ] = "saved"
    notes: str | None = None
    checklist: list[ChecklistItem] = field(default_factory=list)
    deadline_at: datetime | None = None
    deadline_timezone: str | None = None


@dataclass(frozen=True, slots=True)
class ApplicationUpdate:
    """Update model for application fields."""

    status: Literal[
        "saved",
        "preparing",
        "ready",
        "submitted",
        "interview",
        "awarded",
        "unsuccessful",
        "withdrawn",
    ] | None = None
    notes: str | None = None
    checklist: list[ChecklistItem] | None = None
    deadline_at: datetime | None = None
    deadline_timezone: str | None = None


@dataclass(frozen=True, slots=True)
class StatusTransitionRequest:
    """Request to transition application status."""

    application_id: UUID
    profile_id: UUID
    from_status: Literal[
        "saved",
        "preparing",
        "ready",
        "submitted",
        "interview",
        "awarded",
        "unsuccessful",
        "withdrawn",
    ]
    to_status: Literal[
        "saved",
        "preparing",
        "ready",
        "submitted",
        "interview",
        "awarded",
        "unsuccessful",
        "withdrawn",
    ]
    actor_id: UUID
    reason: str | None = None
    idempotency_key: str | None = None


# Valid state transitions: (from_status, to_status)
ALLOWED_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        # From saved
        ("saved", "preparing"),
        ("saved", "withdrawn"),
        # From preparing
        ("preparing", "saved"),
        ("preparing", "ready"),
        ("preparing", "withdrawn"),
        # From ready
        ("ready", "preparing"),
        ("ready", "submitted"),
        ("ready", "withdrawn"),
        # From submitted
        ("submitted", "interview"),
        ("submitted", "unsuccessful"),
        ("submitted", "withdrawn"),
        # From interview
        ("interview", "awarded"),
        ("interview", "unsuccessful"),
        ("interview", "withdrawn"),
        # From awarded
        ("awarded", "withdrawn"),
        # From unsuccessful
        ("unsuccessful", "withdrawn"),
        # Withdrawn is terminal except for reopening to saved
        ("withdrawn", "saved"),
    }
)


def is_valid_transition(from_status: str, to_status: str) -> bool:
    """Check if a status transition is allowed."""
    return (from_status, to_status) in ALLOWED_TRANSITIONS


@dataclass(frozen=True, slots=True)
class NotificationPreferenceWrite:
    """Write model for notification preferences."""

    profile_id: UUID
    deadline_reminders_enabled: bool
    product_updates_enabled: bool
    reminder_days: list[int]
    timezone: str
    quiet_hours_start: int | None = None  # Hour in 24h format
    quiet_hours_end: int | None = None


@dataclass(frozen=True, slots=True)
class NotificationDeliveryRecord:
    """Record of a notification delivery attempt."""

    id: UUID
    recipient_profile_id: UUID
    channel: Literal["email", "push", "sms"]
    template_name: str
    subject: str | None
    body_hash: str
    scheduled_at: datetime
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    bounced_at: datetime | None = None
    status: Literal["pending", "sent", "delivered", "bounced", "failed"] = "pending"
    error_code: str | None = None
    retry_count: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class EmailProviderSendRequest:
    """Request to send email via provider."""

    to_email: str
    subject: str
    body_html: str
    body_text: str | None = None
    from_email: str | None = None
    reply_to: str | None = None
    headers: dict[str, str] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class EmailProviderSendResult:
    """Result from email provider."""

    message_id: str
    status: Literal["sent", "queued", "failed"]
    error_code: str | None = None
    error_message: str | None = None
