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
import logging
from datetime import datetime, timezone
import asyncio
from typing import AsyncIterator

from bson import ObjectId
from bson.errors import InvalidId
from openai import AzureOpenAI
from pymongo import DESCENDING, ReturnDocument
from pymongo.database import Database

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
) -> None:
    """Append a completed exchange (question + answer + sources) to a user's
    conversation. Scoped by user_id so one user can't write to another's thread.
    """
    oid = _oid(conversation_id)
    if not oid:
        return
    now = _now()
    turn = [
        {"role": "user", "text": question, "created_at": now},
        {"role": "assistant", "text": answer or "", "sources": sources or [], "created_at": now},
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
    doc = db.conversations.find_one({"_id": oid, "user_id": user_id})
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


def owns_conversation(db: Database, conversation_id: str, user_id: str) -> bool:
    """Cheap ownership check used by the WS flow before appending turns."""
    oid = _oid(conversation_id)
    if not oid:
        return False
    return db.conversations.count_documents({"_id": oid, "user_id": user_id}, limit=1) == 1
