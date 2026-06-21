import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.query import QueryRequest, QueryResponse
from services import query_service
import db.connection as db_connection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/query", tags=["query"])


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

    try:
        result = query_service.query(db, body.question, body.top_k)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")

    return result


@router.post("/stream")
async def query_documents_stream(body: QueryRequest):
    db = get_db()
    _validate(body, db)
    logger.info("[stream-endpoint] Accepted request: question=%r top_k=%d", body.question[:80], body.top_k)

    async def event_generator():
        try:
            async for frame in query_service.query_stream(db, body.question, body.top_k):
                yield frame
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error("[stream-endpoint] Unhandled error: %s", e)
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
