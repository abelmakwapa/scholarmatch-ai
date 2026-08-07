"""
Notification jobs for ScholarMatch.
Handles deadline reminders and transactional emails.
"""
from typing import Optional, List, Dict, Any

def cancel_pending_notifications(user_id: int) -> int:
    """Cancel all pending notifications for a user. Returns count cancelled."""
    # Implementation would query job queue and cancel
    return 0

async def send_deadline_reminder(
    user_id: int,
    application_id: int,
    scholarship_title: str,
    deadline: str,
    days_until: int
) -> Dict[str, Any]:
    """Send deadline reminder email."""
    # Would use email provider adapter
    return {"status": "sent", "user_id": user_id}

async def send_transactional_email(
    recipient: str,
    template: str,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """Send transactional email using provider adapter."""
    # Would call email provider
    return {"status": "queued", "recipient": recipient}

def deduplicate_reminders(reminders: List[Dict]) -> List[Dict]:
    """Remove duplicate reminders based on user+application+type."""
    seen = set()
    unique = []
    for r in reminders:
        key = (r.get("user_id"), r.get("application_id"), r.get("type"))
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique
