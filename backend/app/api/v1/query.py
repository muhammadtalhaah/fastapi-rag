import json
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from models.query import QueryRequest, QueryResponse
from services import query_service, session_service
import db.connection as db_connection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/query", tags=["query"])

# Shown to clients when an error has no safe, user-facing message. Raw exception
# text (provider rate-limit notices, stack details, etc.) must never leak here.
GENERIC_ERROR = "Something went wrong while answering your question. Please try again."


def get_db():
    return db_connection.client["rag_db"]


def _validate(body: QueryRequest, db):
    if not body.question.strip():
        raise HTTPException(status_code=422, detail="Question must not be empty.")
    if not (1 <= body.top_k <= 20):
        raise HTTPException(status_code=422, detail="top_k must be between 1 and 20.")
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
async def query_documents_stream(body: QueryRequest):
    db = get_db()
    _validate(body, db)
    logger.info("[stream-endpoint] Accepted request: question=%r top_k=%d", body.question[:80], body.top_k)

    session_id, session = session_service.get_or_create(body.session_id)

    async def event_generator():
        # Tell the client its session id first so a freshly-minted one is captured.
        yield f"event: session\ndata: {json.dumps({'session_id': session_id})}\n\n"
        try:
            async for frame in query_service.query_stream(db, body.question, body.top_k, session):
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
        raw = await websocket.receive_text()
        body = QueryRequest(**json.loads(raw))
    except Exception as e:
        await websocket.send_text(json.dumps({"event": "error", "data": {"message": f"Invalid request: {e}"}}))
        await websocket.close()
        return

    try:
        _validate(body, db)
    except HTTPException as e:
        await websocket.send_text(json.dumps({"event": "error", "data": {"message": e.detail}}))
        await websocket.close()
        return

    logger.info("[ws-endpoint] Accepted: question=%r top_k=%d", body.question[:80], body.top_k)

    session_id, session = session_service.get_or_create(body.session_id)
    await websocket.send_text(json.dumps({"event": "session", "data": {"session_id": session_id}}))

    try:
        async for frame in query_service.query_stream(db, body.question, body.top_k, session):
            # frame is already an SSE string; re-encode as JSON for WS
            event_match = None
            data_match = None
            for line in frame.splitlines():
                if line.startswith("event:"):
                    event_match = line[6:].strip()
                elif line.startswith("data:"):
                    data_match = line[5:].strip()
            if event_match and data_match:
                await websocket.send_text(json.dumps({"event": event_match, "data": json.loads(data_match)}))
    except WebSocketDisconnect:
        logger.info("[ws-endpoint] Client disconnected")
    except ValueError as e:
        logger.info("[ws-endpoint] User-facing error: %s", e)
        try:
            await websocket.send_text(json.dumps({"event": "error", "data": {"message": str(e)}}))
        except Exception:
            pass
    except Exception:
        logger.exception("[ws-endpoint] Unhandled error")
        try:
            await websocket.send_text(json.dumps({"event": "error", "data": {"message": GENERIC_ERROR}}))
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
