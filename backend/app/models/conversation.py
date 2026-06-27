from datetime import datetime
from typing import Union

from pydantic import BaseModel, Field

from models.query import SourceChunk, WebSource

# Web sources have a "type": "web" discriminator field; RAG sources do not have
# "type" in the stored dict (legacy data). Pydantic tries WebSource first (it
# requires "url"), then falls back to SourceChunk.
AnySource = Union[WebSource, SourceChunk]


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
    sources: list[AnySource] = []
    # Display name of the model that generated this assistant turn. Absent on
    # user turns and on messages stored before this field existed (older
    # conversations stay valid; the client falls back gracefully).
    model_name: str | None = None
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


class SearchSnippet(BaseModel):
    """One matching message within a conversation, with enough context to show a
    preview and to navigate straight to it.

    `message_index` is the 0-based position of the matched message in the
    conversation's `messages` array — stable across reloads (client message ids
    are not), so the frontend uses it to scroll to and highlight the message.
    """
    role: str  # "user" | "assistant"
    snippet: str
    message_index: int


class ConversationSearchResult(BaseModel):
    """A conversation that matched the query, with the best matching snippets."""
    id: str
    title: str
    updated_at: datetime | None = None
    # Whether the query matched the conversation title itself.
    title_match: bool = False
    # Up to a few representative message snippets (empty if only the title matched).
    snippets: list[SearchSnippet] = []


class ConversationSearchResponse(BaseModel):
    """Paginated search results, most relevant first."""
    results: list[ConversationSearchResult]
    total: int
    limit: int
    offset: int
    has_more: bool
