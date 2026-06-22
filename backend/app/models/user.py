from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional


class UserCreate(BaseModel):
    # NOTE: `isSystemUser` is intentionally NOT a field here. It is a privilege
    # flag that must never be settable via the API — it can only be changed
    # directly in the database. `extra="forbid"` makes any attempt to send it
    # (or any other unknown field) a 422 error rather than a silent no-op, so a
    # client can't grant itself system privileges.
    model_config = ConfigDict(extra="forbid")
    name: str
    email: EmailStr
    profile_url: str = "http://localhost:8000/api/v1/images/6a395e75258a7b5fc0962ff8"


class UserUpdate(BaseModel):
    # Same rule for updates: unknown fields (including isSystemUser) are rejected.
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
