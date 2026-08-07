"""
Custom exceptions for ScholarMatch.
"""

class AuthorizationError(Exception):
    """Raised when user lacks required permissions."""
    pass

class ValidationError(Exception):
    """Raised when input validation fails."""
    pass

class NotFoundError(Exception):
    """Raised when a requested resource is not found."""
    pass

class RateLimitExceeded(Exception):
    """Raised when rate limit is exceeded."""
    pass

class SSRFAttemptError(Exception):
    """Raised when SSRF attack is detected."""
    pass

class IdempotencyConflictError(Exception):
    """Raised when idempotent request conflicts with previous execution."""
    pass
