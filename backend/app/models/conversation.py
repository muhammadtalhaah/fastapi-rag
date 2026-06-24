from datetime import datetime

from pydantic import BaseModel, Field

from models.query import SourceChunk


class ConversationSummary(BaseModel):
    """Lightweight row for the history list — no message bodies."""
    id: str
    title: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ConversationMessage(BaseModel):
    role: str  # "user" | "assistant"
    text: str
    # Only assistant turns carry sources; default empty for user turns.
    sources: list[SourceChunk] = []
    created_at: datetime | None = None


class ConversationDetail(BaseModel):
    """Full transcript for reopening a conversation."""
    id: str
    title: str
    messages: list[ConversationMessage]
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ConversationUpdate(BaseModel):
    """Editable fields for a user-managed conversation."""
    title: str = Field(min_length=1, max_length=80)
