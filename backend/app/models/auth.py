"""Pydantic request/response models for the auth flow."""
from pydantic import BaseModel, EmailStr, Field

from config import settings


class RegisterRequest(BaseModel):
    """Account creation payload. This is the password-bearing path (distinct
    from the open `UserCreate` CRUD path which has no password)."""

    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    # Enforce password policy at the edge. max_length caps input before it ever
    # reaches bcrypt's 72-byte limit so users are never silently truncated.
    password: str = Field(
        min_length=settings.password_min_length,
        max_length=settings.password_max_length,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=settings.password_max_length)


class AuthUserResponse(BaseModel):
    """User payload returned on register/login/me. Never includes the hash."""

    id: str
    name: str
    email: str
    profile_url: str | None = None
    # Editable profile fields, surfaced here so the SPA has them on load (the
    # account menu / settings panel render them without a second request).
    nickname: str = ""
    work: str = ""
    instructions: str = ""


class LoginResponse(BaseModel):
    """Login/refresh response. The CSRF token is also set as a readable cookie;
    it is returned in the body so SPA clients can capture it without parsing
    cookies, then echo it back in the X-CSRF-Token header."""

    user: AuthUserResponse
    csrf_token: str


class MessageResponse(BaseModel):
    message: str
