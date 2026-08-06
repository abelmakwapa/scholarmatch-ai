from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID


class ApplicationRole(StrEnum):
    USER = "user"
    ADMIN = "admin"


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: UUID
    role: ApplicationRole

    def database_claims(self) -> dict[str, object]:
        return {
            "sub": str(self.id),
            "role": "authenticated",
            "app_metadata": {"role": self.role.value},
        }
