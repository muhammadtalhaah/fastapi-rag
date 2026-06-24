import asyncio
import json
import logging
import time
import threading
from typing import AsyncIterator

import numpy as np
import tiktoken
import voyageai
import voyageai.error as voyage_error
from openai import AzureOpenAI, BadRequestError
from pymongo.database import Database
from config import VOYAGE_API_KEY, AZURE_API_KEY, AZURE_BASE_URL
from services import session_service

logger = logging.getLogger(__name__)

voyage_client = voyageai.Client(api_key=VOYAGE_API_KEY)  # type: ignore[attr-defined]
azure_client = AzureOpenAI(api_key=AZURE_API_KEY, azure_endpoint=AZURE_BASE_URL, api_version="2025-04-01-preview")

EMBED_MODEL = "voyage-4-large"
AZURE_DEPLOYMENT = "gpt-5.4"

# Retrieval relevance gating (tunable)
RELEVANCE_FLOOR = 0.5     # discard chunks below this cosine similarity
RELATIVE_GAP = 0.12       # also discard chunks scoring this far below the best match

# Token budgets per RAG cycle (tunable)
BUDGET_SYSTEM_PROMPT = 1_000
BUDGET_CONTEXT = 6_000
BUDGET_HISTORY = 3_000
BUDGET_ANSWER = 1_500

SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions about the user's documents. "
    "Use the retrieved context below as your primary source, and also draw on the earlier "
    "conversation when the user refers back to it (e.g. 'it', 'that', or follow-up questions). "
    "If a follow-up is ambiguous, resolve it using the conversation so far rather than asking "
    "what the user means. Only state that you don't have the information when the answer is in "
    "neither the retrieved context nor the conversation.\n\n"
    "Format every answer as clean, well-structured GitHub-flavored Markdown so it is easy to scan:\n"
    "- Use Markdown headings (## for main sections, ### for sub-sections) to break a longer answer "
    "into clearly labeled parts instead of one wall of text.\n"
    "- Use bullet lists, numbered lists, and **bold** for key terms where they aid readability.\n"
    "- Use Markdown tables when comparing or listing structured data.\n"
    "- Always wrap code, commands, file paths, and config in fenced code blocks with the correct "
    "language tag (e.g. ```python, ```bash, ```json) so it is syntax-highlighted, and use `inline code` "
    "for short identifiers.\n"
    "- For short, simple answers, do not over-structure — a sentence or two is fine. Add headings and "
    "sections only when the content genuinely has multiple parts."
)

try:
    _enc = tiktoken.encoding_for_model("gpt-4o")
except KeyError:
    _enc = tiktoken.get_encoding("cl100k_base")

_SYSTEM_PROMPT_TOKENS = len(_enc.encode(SYSTEM_PROMPT))
logger.info("[budget] system_prompt=%d tokens (budget=%d)", _SYSTEM_PROMPT_TOKENS, BUDGET_SYSTEM_PROMPT)


def _count_tokens(text: str) -> int:
    return len(_enc.encode(text))


def _retrieval_query(question: str, history: list[dict] | None) -> str:
    """Build the text used for retrieval embedding.

    Short follow-ups ("leave policy", "how many?") embed poorly on their own and
    miss the chunks the full question would have hit. For brief questions, blend
    in the most recent prior user turn so retrieval stays anchored to the topic.
    Longer, self-contained questions are used as-is.
    """
    q = question.strip()
    if not history or len(q.split()) > 6:
        return q
    prior_user = next(
        (m["content"] for m in reversed(history) if m.get("role") == "user" and m.get("content")),
        None,
    )
    if not prior_user:
        return q
    blended = f"{prior_user}\n{q}"
    logger.info("[retrieval] short follow-up — blending prior turn into query")
    return blended


def _build_user_message(context: str, question: str) -> str:
    """Frame the retrieved context and the question. When retrieval came up
    empty, say so explicitly so the model falls back to the conversation
    instead of treating a blank block as 'no information available'."""
    context_block = context.strip() or "(No relevant passages were retrieved for this question.)"
    return f"Context:\n{context_block}\n\nQuestion: {question}"


def _trim_history(history: list[dict] | None) -> list[dict]:
    """Final safety clamp on the composed history to BUDGET_HISTORY.

    Session compaction already keeps history small; this guards against an
    unusually long summary or recent turn blowing the budget. Walks backwards
    so the freshest context is retained, then restores chronological order.
    """
    if not history:
        return []
    kept: list[dict] = []
    remaining = BUDGET_HISTORY
    for msg in reversed(history):
        role = msg.get("role")
        content = msg.get("content") or ""
        if role not in ("user", "assistant", "system") or not content.strip():
            continue
        cost = _count_tokens(content) + 4  # rough per-message overhead
        if cost > remaining:
            break
        remaining -= cost
        kept.append({"role": role, "content": content})
    kept.reverse()
    logger.info("[history] kept %d/%d messages, ~%d tokens", len(kept), len(history), BUDGET_HISTORY - remaining)
    return kept


SUMMARY_PROMPT = (
    "You maintain a running summary of a conversation between a user and an assistant. "
    "Given the previous summary and the new messages that are scrolling out of the recent "
    "window, produce an updated summary. Preserve concrete facts the user may refer back to "
    "later — especially the exact questions the user asked and the key points of each answer. "
    "Be concise. Return only the updated summary."
)


def summarize_overflow(prev_summary: str, overflow: list[dict]) -> str:
    """Fold messages scrolling out of the recent window into the running summary.

    Injected into session_service.append_turn so the session layer stays free of
    LLM wiring. Best-effort: callers treat failures as non-fatal.
    """
    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in overflow)
    user_content = f"Previous summary:\n{prev_summary or '(none)'}\n\nNew messages:\n{transcript}"
    resp = azure_client.chat.completions.create(
        model=AZURE_DEPLOYMENT,
        messages=[
            {"role": "system", "content": SUMMARY_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_completion_tokens=BUDGET_HISTORY,
    )
    return resp.choices[0].message.content or prev_summary


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a), np.array(b)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom else 0.0


def _embed(question: str) -> list[float]:
    logger.info("[embed] Calling VoyageAI for question: %r", question[:80])
    t0 = time.perf_counter()
    try:
        result = voyage_client.embed([question], model=EMBED_MODEL, input_type="query")
    except voyage_error.RateLimitError:
        logger.warning("[embed] VoyageAI rate limit hit", exc_info=True)
        raise ValueError("The service is busy right now. Please wait a moment and try again.")
    except (voyage_error.AuthenticationError, voyage_error.InvalidRequestError):
        logger.error("[embed] VoyageAI configuration error", exc_info=True)
        raise ValueError("We couldn't process your question right now. Please try again later.")
    except (voyage_error.Timeout, voyage_error.APIConnectionError,
            voyage_error.ServiceUnavailableError, voyage_error.ServerError):
        logger.warning("[embed] VoyageAI transient error", exc_info=True)
        raise ValueError("The service is temporarily unavailable. Please try again in a moment.")
    except voyage_error.VoyageError:
        logger.error("[embed] VoyageAI error", exc_info=True)
        raise ValueError("We couldn't process your question right now. Please try again later.")
    embedding = result.embeddings[0]  # type: ignore[attr-defined]
    logger.info("[embed] Done in %.2fs, dims=%d", time.perf_counter() - t0, len(embedding))
    return embedding


def _retrieve(db: Database, query_embedding: list[float], top_k: int) -> tuple[list[dict], str]:
    logger.info("[retrieve] Loading all chunks from MongoDB...")
    t0 = time.perf_counter()
    chunks = list(db.chunks.find({}, {"text": 1, "embedding": 1, "document_id": 1, "chunk_index": 1, "metadata": 1}))
    logger.info("[retrieve] Loaded %d chunks in %.2fs", len(chunks), time.perf_counter() - t0)

    logger.info("[retrieve] Computing cosine similarities...")
    t1 = time.perf_counter()
    scored = []
    for chunk in chunks:
        score = _cosine_similarity(query_embedding, chunk["embedding"])
        scored.append((score, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)

    # Relevance gate: keep only chunks above the absolute floor AND within a
    # relative gap of the best match, capped at top_k. This makes the source
    # count reflect actual relevance — an off-topic query returns few/none,
    # an on-topic one returns up to top_k — instead of always returning top_k.
    best_score = scored[0][0] if scored else 0.0
    cutoff = max(RELEVANCE_FLOOR, best_score - RELATIVE_GAP)
    top_chunks = [(s, c) for s, c in scored[:top_k] if s >= cutoff]
    logger.info(
        "[retrieve] Scoring done in %.2fs, best=%.4f cutoff=%.4f kept=%d",
        time.perf_counter() - t1, best_score, cutoff, len(top_chunks),
    )

    doc_ids = {c["document_id"] for _, c in top_chunks}
    docs = {d["_id"]: d for d in db.documents.find({"_id": {"$in": list(doc_ids)}})}

    sources = []
    context_parts = []
    budget_remaining = BUDGET_CONTEXT
    separator = "\n\n---\n\n"

    for score, chunk in top_chunks:
        doc = docs.get(chunk["document_id"], {})
        filename = doc.get("filename", "unknown")
        part = f"[{filename}]\n{chunk['text']}"
        part_tokens = _count_tokens(part + (separator if context_parts else ""))
        if part_tokens > budget_remaining:
            logger.info("[retrieve] Context budget exhausted at chunk %d (need %d, have %d)", chunk["chunk_index"], part_tokens, budget_remaining)
            break
        budget_remaining -= part_tokens
        sources.append({
            "document_id": str(chunk["document_id"]),
            "filename": filename,
            "chunk_index": chunk["chunk_index"],
            "text": chunk["text"],
            "score": round(score, 4),
        })
        context_parts.append(part)

    context = separator.join(context_parts)
    logger.info("[retrieve] Returning %d sources, context_tokens=%d", len(sources), BUDGET_CONTEXT - budget_remaining)
    return sources, context


def query(db: Database, question: str, top_k: int = 5, session: dict | None = None) -> dict:
    history = session_service.build_history(session) if session else []
    logger.info("[query] START question=%r top_k=%d history=%d", question[:80], top_k, len(history))
    t0 = time.perf_counter()

    query_embedding = _embed(_retrieval_query(question, history))
    sources, context = _retrieve(db, query_embedding, top_k)

    user_message = _build_user_message(context, question)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *_trim_history(history),
        {"role": "user", "content": user_message},
    ]
    logger.info("[query] Calling Azure OpenAI (non-streaming)...")
    try:
        chat_response = azure_client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
            messages=messages,
            max_completion_tokens=BUDGET_ANSWER,
        )
    except BadRequestError as e:
        if "content_filter" in str(e) or (hasattr(e, "code") and e.code == "content_filter"):
            raise ValueError("Your message was flagged by the content filter and could not be processed.")
        raise
    answer = chat_response.choices[0].message.content
    if session is not None:
        session_service.append_turn(session, question, answer, summarize_overflow)
    logger.info("[query] DONE total=%.2fs answer_len=%d", time.perf_counter() - t0, len(answer or ""))
    return {"answer": answer, "sources": sources}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def query_stream(db: Database, question: str, top_k: int = 5, session: dict | None = None) -> AsyncIterator[str]:
    """Yield SSE frames with real-time status, streamed tokens, and sources."""
    history = session_service.build_history(session) if session else []
    request_id = f"{time.time():.0f}"
    logger.info("[stream:%s] START question=%r top_k=%d history=%d", request_id, question[:80], top_k, len(history))
    t_total = time.perf_counter()

    # 1. Embed — runs in thread pool so the event loop stays unblocked
    yield _sse("status", {"stage": "embedding", "message": "Understanding your question..."})
    logger.info("[stream:%s] Embedding question...", request_id)
    t0 = time.perf_counter()
    query_embedding = await asyncio.to_thread(_embed, _retrieval_query(question, history))
    logger.info("[stream:%s] Embedding done in %.2fs", request_id, time.perf_counter() - t0)

    # 2. Retrieve — also blocking (MongoDB + numpy), run in thread pool
    yield _sse("status", {"stage": "searching", "message": "Searching documents..."})
    logger.info("[stream:%s] Retrieving chunks...", request_id)
    t0 = time.perf_counter()
    sources, context = await asyncio.to_thread(_retrieve, db, query_embedding, top_k)
    logger.info("[stream:%s] Retrieval done in %.2fs, %d sources", request_id, time.perf_counter() - t0, len(sources))
    yield _sse("sources", {"sources": sources})

    # 3. Stream generation tokens
    yield _sse("status", {"stage": "generating", "message": "Generating answer..."})
    logger.info("[stream:%s] Starting Azure OpenAI stream...", request_id)
    user_message = _build_user_message(context, question)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *_trim_history(history),
        {"role": "user", "content": user_message},
    ]

    t0 = time.perf_counter()
    token_count = 0
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    def _run_and_enqueue():
        try:
            logger.info("[stream:%s] Thread: opening Chat Completions stream...", request_id)
            with azure_client.chat.completions.create(
                model=AZURE_DEPLOYMENT,
                messages=messages,
                stream=True,
                timeout=120,
                max_completion_tokens=BUDGET_ANSWER,
            ) as stream:
                for chunk in stream:
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
            logger.error("[stream:%s] Thread error: %s", request_id, exc, exc_info=True)
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _DONE)

    t = threading.Thread(target=_run_and_enqueue, daemon=True)
    t.start()
    logger.info("[stream:%s] Background thread started for Chat Completions stream", request_id)

    answer_parts: list[str] = []
    while True:
        item = await queue.get()
        if item is _DONE:
            break
        if isinstance(item, Exception):
            raise item
        kind, payload = item
        if kind == "token":
            token_count += 1
            answer_parts.append(payload)
            yield _sse("token", {"text": payload})

    t.join()
    if session is not None:
        # Compaction may make an LLM call — keep the event loop free.
        await asyncio.to_thread(
            session_service.append_turn, session, question, "".join(answer_parts), summarize_overflow
        )
    logger.info("[stream:%s] Generation done in %.2fs, tokens=%d", request_id, time.perf_counter() - t0, token_count)
    logger.info("[stream:%s] DONE total=%.2fs", request_id, time.perf_counter() - t_total)
    yield _sse("done", {})
