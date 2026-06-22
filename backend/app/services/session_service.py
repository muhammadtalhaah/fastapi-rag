"""Ephemeral in-memory conversation sessions for unauthenticated users.

A session holds a rolling *summary* of older turns plus a small window of the
most recent turns kept verbatim. This keeps the prompt compact (we never ship
the full transcript to the LLM) while still letting the bot answer follow-ups
like "what did I just ask?" from the verbatim window, and recall older context
from the summary.

State lives in process memory only — it is intentionally lost on server
restart and is not shared across workers. That is acceptable for the unauth
flow; persistent, multi-worker sessions will come with the authenticated user
and admin flows.
"""

import logging
import threading
import uuid

logger = logging.getLogger(__name__)

# Conversation compaction knobs (tunable)
RECENT_TURNS = 6           # messages kept verbatim (≈3 user/assistant exchanges)
COMPACT_TRIGGER = 8        # start folding into the summary once recent exceeds this

_lock = threading.Lock()
_sessions: dict[str, dict] = {}


def create_session() -> str:
    sid = uuid.uuid4().hex
    with _lock:
        _sessions[sid] = {"summary": "", "recent": []}
    logger.info("[session] created %s", sid)
    return sid


def get_or_create(session_id: str | None) -> tuple[str, dict]:
    """Return (session_id, session). Mints a new session if the id is unknown."""
    if session_id:
        with _lock:
            sess = _sessions.get(session_id)
        if sess is not None:
            return session_id, sess
        logger.info("[session] unknown id %s — minting fresh", session_id)
    sid = create_session()
    with _lock:
        return sid, _sessions[sid]


def delete_session(session_id: str) -> bool:
    with _lock:
        existed = _sessions.pop(session_id, None) is not None
    logger.info("[session] deleted %s (existed=%s)", session_id, existed)
    return existed


def build_history(session: dict) -> list[dict]:
    """Compose the compact history sent to the LLM: summary (as a system note)
    followed by the verbatim recent window."""
    messages: list[dict] = []
    summary = session.get("summary") or ""
    if summary.strip():
        messages.append({
            "role": "system",
            "content": f"Summary of earlier conversation:\n{summary}",
        })
    messages.extend(session.get("recent", []))
    return messages


def append_turn(session: dict, question: str, answer: str, summarize) -> None:
    """Record a completed exchange, folding the oldest turns into the running
    summary once the recent window grows past COMPACT_TRIGGER.

    `summarize(prev_summary, overflow_messages) -> str` performs the LLM-backed
    compaction; it is injected so this module stays free of LLM-client wiring.
    """
    recent: list[dict] = session.setdefault("recent", [])
    recent.append({"role": "user", "content": question})
    recent.append({"role": "assistant", "content": answer or ""})

    if len(recent) <= COMPACT_TRIGGER:
        return

    overflow = recent[: len(recent) - RECENT_TURNS]
    session["recent"] = recent[len(recent) - RECENT_TURNS :]
    try:
        session["summary"] = summarize(session.get("summary") or "", overflow)
        logger.info("[session] compacted %d msgs into summary (summary_len=%d)", len(overflow), len(session["summary"]))
    except Exception as exc:
        # Compaction is best-effort; if it fails, drop the overflow rather than
        # letting recent grow unbounded. The recent window still gives context.
        logger.warning("[session] summary compaction failed, dropping overflow: %s", exc)
