import json
import logging

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from models.query import QueryRequest, QueryResponse
from services import (
    auth_session_service,
    conversation_service,
    orchestrator_service,
    query_service,
    session_service,
    user_service,
)
import db.connection as db_connection
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/query", tags=["query"])

# Shown to clients when an error has no safe, user-facing message. Raw exception
# text (provider rate-limit notices, stack details, etc.) must never leak here.
GENERIC_ERROR = "Something went wrong while answering your question. Please try again."


def get_db():
    return db_connection.client["rag_db"]


def _resolve_ws_user(websocket: WebSocket, db) -> dict | None:
    """Resolve the logged-in user from the session cookie on a WS connection,
    or None for guests. WebSockets can't use the HTTP Depends() auth chain, so we
    validate the session the same way get_current_user does, by hand.

    Note: session binding is to User-Agent only (IP binding is off by default),
    and the WS handshake carries the same cookies + UA as normal requests, so
    validation behaves identically to the REST flow.
    """
    raw_session_id = websocket.cookies.get(settings.session_cookie_name)
    if not raw_session_id:
        return None
    ip = websocket.client.host if websocket.client else ""
    ua = websocket.headers.get("user-agent", "")
    session = auth_session_service.validate_session(db, raw_session_id, ip, ua)
    if not session:
        return None
    return user_service.get_user(db, session["user_id"])


def _validate_input(body: QueryRequest):
    """Transport-agnostic input validation that applies to every route.

    The "no documents -> 404" gate is NOT here anymore: it is RAG-specific and
    now lives in the orchestrator (it only fires when a turn is actually routed
    to RAG), so general/web questions are no longer blocked by an empty
    knowledge base.
    """
    if not body.question.strip():
        raise HTTPException(status_code=422, detail="Question must not be empty.")
    if not (1 <= body.top_k <= 20):
        raise HTTPException(status_code=422, detail="top_k must be between 1 and 20.")


def _validate(body: QueryRequest, db):
    """Full validation for the legacy non-streaming RAG endpoint, which always
    answers from documents and so keeps the pre-flight 404 gate."""
    _validate_input(body)
    if db.chunks.count_documents({}) == 0:
        raise HTTPException(status_code=404, detail="No documents have been ingested yet.")


@router.post("/", response_model=QueryResponse)
def query_documents(body: QueryRequest):
    db = get_db()
    _validate(body, db)

    session_id, session = session_service.get_or_create(body.session_id)
    try:
        result = query_service.query(db, body.question, body.top_k, session)
    except ValueError as e:
        # Intentional, user-facing message raised by the service layer.
        logger.info("[query-endpoint] User-facing error: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
    except Exception:
        logger.exception("[query-endpoint] Unhandled error")
        raise HTTPException(status_code=500, detail=GENERIC_ERROR)

    return {**result, "session_id": session_id}


@router.delete("/session/{session_id}")
def end_session(session_id: str):
    """Drop a conversation server-side (e.g. on 'New chat')."""
    existed = session_service.delete_session(session_id)
    return {"ended": existed}


@router.post("/stream")
async def query_documents_stream(body: QueryRequest, request: Request):
    db = get_db()
    _validate_input(body)
    client_ip = request.client.host if request.client else None
    logger.info(
        "[stream-endpoint] Accepted request: question=%r top_k=%d mode=%r",
        body.question[:80], body.top_k, body.mode,
    )

    session_id, session = session_service.get_or_create(body.session_id)

    async def event_generator():
        # Tell the client its session id first so a freshly-minted one is captured.
        yield f"event: session\ndata: {json.dumps({'session_id': session_id})}\n\n"
        try:
            async for frame in orchestrator_service.run_stream(
                db, body.question, top_k=body.top_k, mode=body.mode,
                web_search=body.web_search, session=session, client_ip=client_ip,
            ):
                yield frame
        except ValueError as e:
            # Intentional, user-facing message raised by the service layer.
            logger.info("[stream-endpoint] User-facing error: %s", e)
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        except Exception:
            import traceback
            traceback.print_exc()
            logger.exception("[stream-endpoint] Unhandled error")
            yield f"event: error\ndata: {json.dumps({'message': GENERIC_ERROR})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.websocket("/ws")
async def query_websocket(websocket: WebSocket):
    await websocket.accept()
    db = get_db()

    try:
        while True:
            try:
                raw = await websocket.receive_text()
                payload = json.loads(raw)
                body = QueryRequest(**payload)
            except WebSocketDisconnect:
                logger.info("[ws-endpoint] Client disconnected")
                break
            except Exception as e:
                await websocket.send_text(
                    json.dumps({"event": "error", "data": {"message": f"Invalid request: {e}"}})
                )
                continue

            try:
                _validate_input(body)
            except HTTPException as e:
                await websocket.send_text(json.dumps({"event": "error", "data": {"message": e.detail}}))
                continue

            logger.info(
                "[ws-endpoint] Accepted: question=%r top_k=%d mode=%r web_search=%s",
                body.question[:80], body.top_k, body.mode, body.web_search,
            )

            session_id, session = session_service.get_or_create(body.session_id)
            await websocket.send_text(json.dumps({"event": "session", "data": {"session_id": session_id}}))

            user = _resolve_ws_user(websocket, db)

            # Regeneration is a logged-in-only action: it rewrites a stored answer
            # in an owned conversation, which guests don't have. Reject an
            # unauthenticated regenerate explicitly rather than silently treating
            # it as a fresh question, so the client's gating can't be bypassed.
            if body.regenerate and not user:
                await websocket.send_text(
                    json.dumps({
                        "event": "error",
                        "data": {"message": "Sign in to regenerate a response."},
                    })
                )
                continue

            requested_conversation_id = (payload.get("conversation_id") or "").strip() or None
            conversation_id = None
            # A regeneration only applies to an existing, owned conversation; for a
            # guest or a brand-new chat it degrades to a normal turn.
            is_regenerate = bool(body.regenerate and requested_conversation_id)
            if user:
                if requested_conversation_id and conversation_service.owns_conversation(
                    db, requested_conversation_id, user["id"]
                ):
                    conversation_id = requested_conversation_id
                    # Reopening a past conversation: the in-memory context session
                    # is freshly minted (empty) because it doesn't survive a reload.
                    # Prime it from the durable transcript so follow-ups keep the
                    # thread instead of starting cold.
                    convo = conversation_service.get_conversation(db, conversation_id, user["id"])
                    if convo:
                        session_service.hydrate_from_transcript(session, convo.get("messages", []))
                    # Regenerating the last answer: drop that exchange from the
                    # context window so the model doesn't see (and echo) its own
                    # prior answer to the same question.
                    if is_regenerate:
                        session_service.pop_last_exchange(session)
                else:
                    conversation_id = conversation_service.create_conversation(db, user["id"], body.question)
                await websocket.send_text(
                    json.dumps({"event": "conversation", "data": {"conversation_id": conversation_id}})
                )
                if not requested_conversation_id:
                    async for partial_title in conversation_service.stream_generated_title(body.question):
                        await websocket.send_text(
                            json.dumps({"event": "conversation_title", "data": {"text": partial_title}})
                        )

            captured_sources: list[dict] = []
            answer_parts: list[str] = []
            captured_model: str | None = None
            client_ip = websocket.client.host if websocket.client else None

            try:
                async for frame in orchestrator_service.run_stream(
                    db, body.question, top_k=body.top_k, mode=body.mode,
                    web_search=body.web_search, session=session, client_ip=client_ip,
                ):
                    event_match = None
                    data_match = None
                    for line in frame.splitlines():
                        if line.startswith("event:"):
                            event_match = line[6:].strip()
                        elif line.startswith("data:"):
                            data_match = line[5:].strip()
                    if event_match and data_match:
                        data_obj = json.loads(data_match)
                        if event_match == "sources":
                            captured_sources = data_obj.get("sources", [])
                        elif event_match == "model":
                            captured_model = data_obj.get("name") or None
                        elif event_match == "token":
                            answer_parts.append(data_obj.get("text", ""))
                        await websocket.send_text(json.dumps({"event": event_match, "data": data_obj}))

                if user and conversation_id:
                    if not requested_conversation_id:
                        conversation_service.rename_conversation(
                            db,
                            conversation_id,
                            user["id"],
                            conversation_service.generate_title(body.question, "".join(answer_parts)),
                        )
                    # A regeneration replaces the last answer in place (a new
                    # version in its carousel); fall back to appending if the
                    # last turn no longer matches (e.g. a stale client).
                    regenerated = False
                    if is_regenerate:
                        regenerated = conversation_service.regenerate_last_turn(
                            db,
                            conversation_id,
                            user["id"],
                            body.question,
                            "".join(answer_parts),
                            captured_sources,
                            captured_model,
                        )
                    if not regenerated:
                        conversation_service.append_turn(
                            db,
                            conversation_id,
                            user["id"],
                            body.question,
                            "".join(answer_parts),
                            captured_sources,
                            captured_model,
                        )
            except ValueError as e:
                logger.info("[ws-endpoint] User-facing error: %s", e)
                await websocket.send_text(json.dumps({"event": "error", "data": {"message": str(e)}}))
            except WebSocketDisconnect:
                logger.info("[ws-endpoint] Client disconnected")
                break
            except Exception:
                logger.exception("[ws-endpoint] Unhandled error")
                await websocket.send_text(json.dumps({"event": "error", "data": {"message": GENERIC_ERROR}}))
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
