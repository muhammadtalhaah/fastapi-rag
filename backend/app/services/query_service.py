import asyncio
import json
import logging
import time
import threading
from typing import AsyncIterator

import httpx
import numpy as np
import voyageai
from openai import AzureOpenAI
from pymongo.database import Database
from config import VOYAGE_API_KEY, AZURE_API_KEY, AZURE_BASE_URL

logger = logging.getLogger(__name__)

voyage_client = voyageai.Client(api_key=VOYAGE_API_KEY)  # type: ignore[attr-defined]
azure_client = AzureOpenAI(api_key=AZURE_API_KEY, azure_endpoint=AZURE_BASE_URL, api_version="2025-03-01-preview")

EMBED_MODEL = "voyage-4-large"
AZURE_DEPLOYMENT = "gpt-5-pro"

SYSTEM_PROMPT = (
    "You are a helpful assistant. Answer the user's question using only the context provided below. "
    "If the answer is not in the context, say so clearly."
)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a), np.array(b)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom else 0.0


def _embed(question: str) -> list[float]:
    logger.info("[embed] Calling VoyageAI for question: %r", question[:80])
    t0 = time.perf_counter()
    result = voyage_client.embed([question], model=EMBED_MODEL, input_type="query")
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
    top_chunks = scored[:top_k]
    logger.info("[retrieve] Scoring done in %.2fs, top score=%.4f", time.perf_counter() - t1, top_chunks[0][0] if top_chunks else 0)

    doc_ids = {c["document_id"] for _, c in top_chunks}
    docs = {d["_id"]: d for d in db.documents.find({"_id": {"$in": list(doc_ids)}})}

    sources = []
    context_parts = []
    for score, chunk in top_chunks:
        doc = docs.get(chunk["document_id"], {})
        sources.append({
            "document_id": str(chunk["document_id"]),
            "filename": doc.get("filename", "unknown"),
            "chunk_index": chunk["chunk_index"],
            "text": chunk["text"],
            "score": round(score, 4),
        })
        context_parts.append(f"[{doc.get('filename', 'unknown')}]\n{chunk['text']}")

    context = "\n\n---\n\n".join(context_parts)
    logger.info("[retrieve] Returning %d sources", len(sources))
    return sources, context


def query(db: Database, question: str, top_k: int = 5) -> dict:
    logger.info("[query] START question=%r top_k=%d", question[:80], top_k)
    t0 = time.perf_counter()

    query_embedding = _embed(question)
    sources, context = _retrieve(db, query_embedding, top_k)

    user_message = f"Context:\n{context}\n\nQuestion: {question}"
    logger.info("[query] Calling Azure OpenAI (non-streaming)...")
    chat_response = azure_client.responses.create(
        model=AZURE_DEPLOYMENT,
        instructions=SYSTEM_PROMPT,
        input=user_message,
    )
    answer = chat_response.output_text
    logger.info("[query] DONE total=%.2fs answer_len=%d", time.perf_counter() - t0, len(answer or ""))
    return {"answer": answer, "sources": sources}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def query_stream(db: Database, question: str, top_k: int = 5) -> AsyncIterator[str]:
    """Yield SSE frames with real-time status, streamed tokens, and sources."""
    request_id = f"{time.time():.0f}"
    logger.info("[stream:%s] START question=%r top_k=%d", request_id, question[:80], top_k)
    t_total = time.perf_counter()

    # 1. Embed — runs in thread pool so the event loop stays unblocked
    yield _sse("status", {"stage": "embedding", "message": "Understanding your question..."})
    logger.info("[stream:%s] Embedding question...", request_id)
    t0 = time.perf_counter()
    query_embedding = await asyncio.to_thread(_embed, question)
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
    user_message = f"Context:\n{context}\n\nQuestion: {question}"

    t0 = time.perf_counter()
    token_count = 0
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    url = f"{AZURE_BASE_URL.rstrip('/')}/openai/responses?api-version=2025-03-01-preview"
    payload = {
        "model": AZURE_DEPLOYMENT,
        "instructions": SYSTEM_PROMPT,
        "input": user_message,
        "stream": True,
    }
    headers = {
        "api-key": AZURE_API_KEY,
        "Content-Type": "application/json",
    }

    def _run_and_enqueue():
        try:
            logger.info("[stream:%s] Thread: opening raw httpx stream to Azure...", request_id)
            with httpx.Client(timeout=120) as client:
                with client.stream("POST", url, json=payload, headers=headers) as response:
                    response.raise_for_status()
                    logger.info("[stream:%s] Thread: connected, reading SSE lines...", request_id)
                    buffer = ""
                    for chunk in response.iter_text():
                        buffer += chunk
                        while "\n\n" in buffer:
                            frame, buffer = buffer.split("\n\n", 1)
                            event_type = None
                            data_str = None
                            for line in frame.splitlines():
                                if line.startswith("event:"):
                                    event_type = line[6:].strip()
                                elif line.startswith("data:"):
                                    data_str = line[5:].strip()
                            if not event_type or not data_str or data_str == "[DONE]":
                                continue
                            try:
                                data = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue
                            etype = data.get("type", "")
                            logger.info("[stream:%s] SSE event type=%r", request_id, etype)
                            if etype == "response.output_text.delta":
                                delta = data.get("delta", "")
                                if delta:
                                    loop.call_soon_threadsafe(queue.put_nowait, ("token", delta))
                            elif etype in ("response.reasoning_text.delta", "response.reasoning_summary_text.delta"):
                                loop.call_soon_threadsafe(queue.put_nowait, ("thinking", None))
        except Exception as exc:
            logger.error("[stream:%s] Thread error: %s", request_id, exc)
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _DONE)

    import threading
    t = threading.Thread(target=_run_and_enqueue, daemon=True)
    t.start()
    logger.info("[stream:%s] Background thread started for Azure stream", request_id)

    thinking_notified = False
    while True:
        item = await queue.get()
        if item is _DONE:
            break
        if isinstance(item, Exception):
            raise item
        kind, payload = item
        if kind == "thinking":
            if not thinking_notified:
                yield _sse("status", {"stage": "thinking", "message": "Thinking..."})
                thinking_notified = True
        elif kind == "token":
            if thinking_notified:
                yield _sse("status", {"stage": "generating", "message": "Generating answer..."})
                thinking_notified = False
            token_count += 1
            yield _sse("token", {"text": payload})

    t.join()
    logger.info("[stream:%s] Generation done in %.2fs, tokens=%d", request_id, time.perf_counter() - t0, token_count)
    logger.info("[stream:%s] DONE total=%.2fs", request_id, time.perf_counter() - t_total)
    yield _sse("done", {})
