from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from gridfs import GridFS
import db.connection as db_connection

router = APIRouter(prefix="/images", tags=["images"])


def _get_fs() -> GridFS:
    db = db_connection.client["rag_db"]
    return GridFS(db, collection="images")


@router.get("/{file_id}")
def get_image(file_id: str):
    try:
        oid = ObjectId(file_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid file id")

    fs = _get_fs()
    if not fs.exists(oid):
        raise HTTPException(status_code=404, detail="Image not found")

    grid_out = fs.get(oid)
    content_type = grid_out.content_type or "application/octet-stream"
    return StreamingResponse(grid_out, media_type=content_type)
