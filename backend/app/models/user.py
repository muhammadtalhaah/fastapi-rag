from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Literal, Optional


# Work-role options mirror the frontend WORK_OPTIONS (settingsData.js) so a client
# can't persist a role the UI can't render back. "" is allowed for "unset".
Work = Literal["", "engineering", "research", "design", "product", "operations", "education", "other"]


# Appearance/UX preferences. The allowed values mirror the frontend option sets
# (settingsData.js) so a client can never persist a value the UI can't render —
# anything outside these literals is a 422 rather than a silent bad write.
Theme = Literal["system", "light", "dark"]
Accent = Literal["brass", "retrieval", "danger", "ink"]
ChatFont = Literal["serif", "sans", "mono"]
Language = Literal["en", "ur", "ar", "fr", "de"]

# Defaults applied when a user has no stored settings yet (e.g. accounts created
# before this feature, or a brand-new user). "system" lets the client follow the
# OS theme until the user makes an explicit choice.
DEFAULT_SETTINGS = {
    "theme": "system",
    "accent": "brass",
    "chat_font": "serif",
    "language": "en",
}


class UserSettings(BaseModel):
    """The full, resolved settings object returned to the client."""

    theme: Theme = "system"
    accent: Accent = "brass"
    chat_font: ChatFont = "serif"
    language: Language = "en"


class UserSettingsUpdate(BaseModel):
    # Partial update: every field optional, unknown fields rejected (same guard
    # as the other user models). Only the keys the client sends are written.
    model_config = ConfigDict(extra="forbid")

    theme: Optional[Theme] = None
    accent: Optional[Accent] = None
    chat_font: Optional[ChatFont] = None
    language: Optional[Language] = None


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


# --- Profile (the editable Account-settings fields) --------------------------
# These live as top-level fields on the user document (alongside profile_url),
# separate from the appearance `settings` sub-doc. nickname/work/instructions
# also feed the chat system prompt so answers can address the user by name and
# honor their standing instructions.
class UserProfile(BaseModel):
    """The full, resolved profile returned to the client."""

    id: str
    name: str
    email: str
    profile_url: Optional[str] = None
    nickname: str = ""
    work: Work = ""
    instructions: str = ""


class UserProfileUpdate(BaseModel):
    # Partial update: only the keys the client sends are written. Unknown fields
    # rejected (same guard as the other models) so a client can't smuggle e.g.
    # isSystemUser or email through the profile route.
    model_config = ConfigDict(extra="forbid")

    # Mirrors the create-user bound (auth.py) so a rename can't set an empty or
    # oversized display name.
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    nickname: Optional[str] = Field(default=None, max_length=60)
    work: Optional[Work] = None
    # Bounded so a single user can't blow the system-prompt token budget.
    instructions: Optional[str] = Field(default=None, max_length=2000)
