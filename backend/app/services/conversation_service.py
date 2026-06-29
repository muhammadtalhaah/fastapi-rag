"""
Durable, per-user conversation history (MongoDB-backed).

This is distinct from the two existing session layers:
  - `session_service`      — in-memory LLM *context* (rolling summary + recent
                             window) used to build the prompt. Ephemeral.
  - `auth_session_service` — auth/login sessions (cookies). Unrelated.

A *conversation* here is the durable transcript a logged-in user can reopen
later: an ordered list of turns (user question + assistant answer + the source
chunks that grounded that answer), with a title and timestamps.

Design notes (consistent with the rest of the codebase):
  - Synchronous PyMongo, `db: Database` first arg.
  - No FastAPI types — unit-testable with mongomock.
  - The stored `_id` (ObjectId) is the conversation id; we expose it as a string.
  - Only authenticated users get persistence; guest turns never reach here.
"""
import re
import time
import logging
import asyncio
from typing import AsyncIterator
from datetime import datetime, timezone

from bson import ObjectId
from openai import AzureOpenAI
from bson.errors import InvalidId
from pymongo.database import Database
from pymongo.errors import OperationFailure
from pymongo import DESCENDING, ReturnDocument

from config import AZURE_API_KEY, AZURE_BASE_URL

logger = logging.getLogger(__name__)

# A conversation title is capped for the sidebar and written in a background-safe,
# best-effort way; if title generation fails we fall back to a short derived title.
_TITLE_MAX_LEN = 80
_TITLE_FALLBACK_MAX_LEN = 60

_TITLE_PROMPT = (
    "Write a short conversation title for a document-question-answering thread. "
    "Use 3 to 8 words, plain text only, no quotes, no markdown, and make it read "
    "like a concise topic label rather than repeating the user's question verbatim."
)

azure_client = AzureOpenAI(
    api_key=AZURE_API_KEY,
    azure_endpoint=AZURE_BASE_URL,
    api_version="2025-04-01-preview",
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _oid(conversation_id: str) -> ObjectId | None:
    try:
        return ObjectId(conversation_id)
    except (InvalidId, TypeError):
        return None


def _derive_title(question: str) -> str:
    title = " ".join((question or "").strip().split())
    if not title:
        return "New conversation"
    return title[:_TITLE_FALLBACK_MAX_LEN] + ("…" if len(title) > _TITLE_FALLBACK_MAX_LEN else "")


def _normalize_generated_title(title: str, fallback_question: str) -> str:
    cleaned = " ".join((title or "").replace("\n", " ").strip().strip('"\'').split())
    if not cleaned:
        return _derive_title(fallback_question)
    return cleaned[:_TITLE_MAX_LEN] + ("…" if len(cleaned) > _TITLE_MAX_LEN else "")


def generate_title(question: str, answer: str = "") -> str:
    """Best-effort LLM title generation for sidebar history."""
    user_content = (
        f"User question:\n{question.strip() or '(empty)'}\n\n"
        f"Assistant answer:\n{(answer or '').strip()[:600]}"
    )
    try:
        resp = azure_client.chat.completions.create(
            model="gpt-5.4",
            messages=[
                {"role": "system", "content": _TITLE_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_completion_tokens=32,
        )
        content = resp.choices[0].message.content or ""
        return _normalize_generated_title(content, question)
    except Exception:
        logger.warning("[conversation] title generation failed", exc_info=True)
        return _derive_title(question)


async def stream_generated_title(question: str, answer_seed: str = "") -> AsyncIterator[str]:
    """Yield progressively longer title fragments for a typewriter-style UI."""
    title = await asyncio.to_thread(generate_title, question, answer_seed)
    for index in range(1, len(title) + 1):
        yield title[:index]


def create_conversation(db: Database, user_id: str, first_question: str) -> str:
    """Start a new conversation for a user. Returns the conversation id (str)."""
    now = _now()
    result = db.conversations.insert_one({
        "user_id": user_id,
        "title": generate_title(first_question),
        "messages": [],
        "created_at": now,
        "updated_at": now,
    })
    logger.info("[conversation] created %s for user=%s", result.inserted_id, user_id)
    return str(result.inserted_id)


def append_turn(
    db: Database,
    conversation_id: str,
    user_id: str,
    question: str,
    answer: str,
    sources: list[dict],
    model_name: str | None = None,
) -> None:
    """Append a completed exchange (question + answer + sources) to a user's
    conversation. Scoped by user_id so one user can't write to another's thread.

    ``model_name`` is the display name of the model that generated ``answer``;
    stored on the assistant turn so reopened conversations can show which model
    produced each response. Optional for backward compatibility.
    """
    oid = _oid(conversation_id)
    if not oid:
        return
    now = _now()
    assistant_turn = {
        "role": "assistant",
        "text": answer or "",
        "sources": sources or [],
        "created_at": now,
    }
    if model_name:
        assistant_turn["model_name"] = model_name
    turn = [
        {"role": "user", "text": question, "created_at": now},
        assistant_turn,
    ]
    db.conversations.update_one(
        {"_id": oid, "user_id": user_id},
        {"$push": {"messages": {"$each": turn}}, "$set": {"updated_at": now}},
    )


def rename_conversation(db: Database, conversation_id: str, user_id: str, title: str) -> dict | None:
    """Update a conversation title and return the lightweight sidebar row."""
    oid = _oid(conversation_id)
    if not oid:
        return None
    updated = db.conversations.find_one_and_update(
        {"_id": oid, "user_id": user_id},
        {"$set": {"title": _normalize_generated_title(title, "") or "Untitled", "updated_at": _now()}},
        projection={"title": 1, "created_at": 1, "updated_at": 1},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        return None
    return {
        "id": str(updated["_id"]),
        "title": updated.get("title") or "Untitled",
        "created_at": updated.get("created_at"),
        "updated_at": updated.get("updated_at"),
    }


def list_conversations(db: Database, user_id: str, limit: int = 100) -> list[dict]:
    """Return a user's conversations, newest first, WITHOUT the message bodies
    (just id/title/timestamps) so the sidebar list stays light."""
    cursor = (
        db.conversations.find(
            {"user_id": user_id},
            {"title": 1, "created_at": 1, "updated_at": 1},
        )
        .sort("updated_at", DESCENDING)
        .limit(limit)
    )
    return [
        {
            "id": str(doc["_id"]),
            "title": doc.get("title") or "Untitled",
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        }
        for doc in cursor
    ]


def get_conversation(db: Database, conversation_id: str, user_id: str) -> dict | None:
    """Return a single conversation with its full transcript, or None if it
    doesn't exist or doesn't belong to this user."""
    oid = _oid(conversation_id)
    if not oid:
        return None
    t0 = time.perf_counter()
    doc = db.conversations.find_one({"_id": oid, "user_id": user_id})
    logger.info("[conversation] find_one took %.3fs", time.perf_counter() - t0)
    if not doc:
        return None
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title") or "Untitled",
        "messages": doc.get("messages", []),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def delete_conversation(db: Database, conversation_id: str, user_id: str) -> bool:
    """Delete a conversation owned by the user. Returns True if one was removed."""
    oid = _oid(conversation_id)
    if not oid:
        return False
    result = db.conversations.delete_one({"_id": oid, "user_id": user_id})
    return result.deleted_count == 1


# --- search ------------------------------------------------------------------
# How many message snippets to return per conversation, and how much text to show
# around the match. Kept small so the modal list stays scannable and the payload
# light.
_MAX_SNIPPETS_PER_CONVO = 3
_SNIPPET_RADIUS = 60


def _make_snippet(text: str, match_start: int, match_end: int) -> str:
    """A short window of `text` centered on [match_start, match_end), with ellipses
    where it's been truncated. The actual highlighting happens client-side."""
    text = text or ""
    start = max(0, match_start - _SNIPPET_RADIUS)
    end = min(len(text), match_end + _SNIPPET_RADIUS)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "… " + snippet
    if end < len(text):
        snippet = snippet + " …"
    return snippet


def _extract_snippets(messages: list[dict], pattern: "re.Pattern[str]") -> list[dict]:
    """Find messages whose text matches `pattern` and build a navigable snippet for
    each (capped at _MAX_SNIPPETS_PER_CONVO). `message_index` is the position in the
    stored messages array, which the frontend uses to scroll to the message."""
    snippets: list[dict] = []
    for index, message in enumerate(messages or []):
        if len(snippets) >= _MAX_SNIPPETS_PER_CONVO:
            break
        text = message.get("text") or ""
        match = pattern.search(text)
        if not match:
            continue
        snippets.append({
            "role": message.get("role") or "assistant",
            "snippet": _make_snippet(text, match.start(), match.end()),
            "message_index": index,
        })
    return snippets


def _query_pattern(query: str) -> "re.Pattern[str]":
    """Case-insensitive regex matching any whitespace-separated term in the query.
    Used both for the mongomock fallback filter and for snippet extraction so the
    highlighted text matches what the user typed."""
    terms = [re.escape(term) for term in (query or "").split() if term]
    if not terms:
        # Matches nothing — callers guard against empty queries, but be safe.
        return re.compile(r"(?!x)x")
    return re.compile("|".join(terms), re.IGNORECASE)


def _matching_conversations(db: Database, user_id: str, query: str) -> list[dict]:
    """All of the user's conversations matching `query`, ordered by relevance.

    Uses MongoDB's `$text` index (fast, relevance-scored) when available; falls
    back to a per-user regex scan when the deployment/driver lacks `$text`
    (e.g. mongomock in tests). Either way the result is the user's matching
    conversation documents with their full `messages` for snippet extraction.
    """
    base = {"user_id": user_id}
    try:
        cursor = db.conversations.find(
            {**base, "$text": {"$search": query}},
            {"score": {"$meta": "textScore"}, "title": 1, "messages": 1,
             "created_at": 1, "updated_at": 1},
        ).sort([("score", {"$meta": "textScore"})])
        return list(cursor)
    except (OperationFailure, NotImplementedError, TypeError):
        # No usable `$text` index for this deployment/driver (real MongoDB without
        # the text index, or mongomock — which doesn't implement `$text` or
        # textScore sorting). Scan the user's conversations and filter in Python,
        # newest-first so relevance ties resolve to recency.
        return _regex_scan(db, base, query)


def _regex_scan(db: Database, base: dict, query: str) -> list[dict]:
    """Fallback search: load the user's conversations and keep those whose title
    or any message text matches the query, newest-first."""
    pattern = _query_pattern(query)
    docs = db.conversations.find(base).sort("updated_at", DESCENDING)
    matched = []
    for doc in docs:
        title = doc.get("title") or ""
        if pattern.search(title) or any(
            pattern.search(m.get("text") or "") for m in doc.get("messages", [])
        ):
            matched.append(doc)
    return matched


def search_conversations(
    db: Database,
    user_id: str,
    query: str,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    """Search a user's conversation titles and message bodies for `query`.

    Returns a paginated, relevance-ordered result set. Each result carries the
    matching message snippets (with their array index) needed to navigate to and
    highlight the exact message in the transcript. A blank query returns nothing.
    """
    query = (query or "").strip()
    if not query:
        return {"results": [], "total": 0, "limit": limit, "offset": offset, "has_more": False}

    pattern = _query_pattern(query)
    matched = _matching_conversations(db, user_id, query)

    results = []
    for doc in matched:
        title = doc.get("title") or "Untitled"
        snippets = _extract_snippets(doc.get("messages", []), pattern)
        title_match = bool(pattern.search(title))
        # A doc surfaced by $text might match only on a stemmed/stop-word token our
        # simple regex doesn't; keep it if either the title or any message matched.
        if not title_match and not snippets:
            continue
        results.append({
            "id": str(doc["_id"]),
            "title": title,
            "updated_at": doc.get("updated_at"),
            "title_match": title_match,
            "snippets": snippets,
        })

    total = len(results)
    page = results[offset:offset + limit]
    return {
        "results": page,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }


def owns_conversation(db: Database, conversation_id: str, user_id: str) -> bool:
    """Cheap ownership check used by the WS flow before appending turns."""
    oid = _oid(conversation_id)
    if not oid:
        return False
    return db.conversations.count_documents({"_id": oid, "user_id": user_id}, limit=1) == 1
