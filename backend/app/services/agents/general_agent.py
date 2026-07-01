"""General-purpose chat agent — answers without RAG retrieval or web search.

Used for coding, writing, math, reasoning, and casual conversation. Draws on
conversation history so follow-ups resolve correctly, but never touches the
document store or any external API beyond the LLM.
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from typing import AsyncIterator

from openai import BadRequestError
from pymongo.database import Database

from services import session_service
from services.query_service import (
    AZURE_DEPLOYMENT,
    BUDGET_ANSWER,
    azure_client,
    personalize,
    summarize_overflow,
    _trim_history,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a knowledgeable, helpful assistant for this app. You can answer "
    "questions from the user's uploaded documents / knowledge base, handle "
    "anything a general LLM can do (writing, coding, math, reasoning, "
    "conversation), and search the web for current information — the app picks "
    "the right capability automatically.\n\n"
    "When the user asks what you can do or how you can help, reply with one "
    "short intro sentence followed by a compact bulleted list of exactly those "
    "three capabilities, each a single concise line:\n"
    "- **Knowledge base** — answer questions from your uploaded documents.\n"
    "- **General assistance** — writing, coding, math, reasoning, and everyday questions.\n"
    "- **Web search** — look up current, real-time information.\n"
    "Keep each bullet to one line. Do not add extra examples, sub-bullets, or "
    "long explanations unless the user explicitly asks for them.\n\n"
    "For everything else, answer the user's question directly and concisely. "
    "Use the conversation history to resolve follow-ups and pronouns. Format "
    "your answer as clean GitHub-flavored Markdown where structure genuinely "
    "helps (code blocks, lists, bold for key terms); for short conversational "
    "answers, plain prose is fine."
)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def stream(
    db: Database,
    question: str,
    *,
    top_k: int,
    session: dict | None,
    request_id: str,
    client_ip: str | None = None,
    user: dict | None = None,
) -> AsyncIterator[str]:
    rid = request_id
    t_total = time.perf_counter()

    history = session_service.build_history(session) if session else []
    messages = [
        {"role": "system", "content": personalize(SYSTEM_PROMPT, user)},
        *_trim_history(history),
        {"role": "user", "content": question},
    ]

    yield _sse("status", {"stage": "generating", "message": "Generating answer..."})

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    def _run_and_enqueue():
        try:
            with azure_client.chat.completions.create(
                model=AZURE_DEPLOYMENT,
                messages=messages,
                stream=True,
                timeout=120,
                max_completion_tokens=BUDGET_ANSWER,
            ) as response_stream:
                for chunk in response_stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    if delta.content:
                        loop.call_soon_threadsafe(queue.put_nowait, ("token", delta.content))
        except BadRequestError as exc:
            if "content_filter" in str(exc) or (hasattr(exc, "code") and exc.code == "content_filter"):
                friendly = ValueError("Your message was flagged by the content filter and could not be processed.")
                loop.call_soon_threadsafe(queue.put_nowait, friendly)
            else:
                loop.call_soon_threadsafe(queue.put_nowait, exc)
        except Exception as exc:
            logger.error("[general-agent:%s] thread error: %s", rid, exc, exc_info=True)
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _DONE)

    t = threading.Thread(target=_run_and_enqueue, daemon=True)
    t.start()

    answer_parts: list[str] = []
    while True:
        item = await queue.get()
        if item is _DONE:
            break
        if isinstance(item, Exception):
            raise item
        kind, payload = item
        if kind == "token":
            answer_parts.append(payload)
            yield _sse("token", {"text": payload})

    t.join()
    if session is not None:
        await asyncio.to_thread(
            session_service.append_turn, session, question, "".join(answer_parts), summarize_overflow
        )
    logger.info("[general-agent:%s] done total=%.2fs", rid, time.perf_counter() - t_total)
    yield _sse("done", {})
