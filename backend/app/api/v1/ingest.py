from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import StreamingResponse
from bson import ObjectId
import gridfs
from models.chunk import IngestResponse, DocumentRecord
from services import ingest_service
import db.connection as db_connection

router = APIRouter(prefix="/ingest", tags=["ingest"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}


def get_db():
    return db_connection.client["rag_db"]


@router.post("/", response_model=IngestResponse, status_code=201)
async def ingest_document(file: UploadFile):
    suffix = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '{suffix}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    db = get_db()

    if db.documents.find_one({"filename": file.filename}):
        raise HTTPException(status_code=409, detail=f"Document '{file.filename}' already exists.")

    try:
        result = ingest_service.ingest_file(db, file_bytes, file.filename)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return result


@router.get("/", response_model=list[DocumentRecord])
def list_documents(request: Request):
    db = get_db()
    docs = []
    for doc in db.documents.find():
        doc["id"] = str(doc.pop("_id"))
        doc.pop("gridfs_id", None)
        doc["download_url"] = str(request.url_for("download_document", document_id=doc["id"]))
        docs.append(doc)
    return docs


@router.get("/{document_id}/download")
def download_document(document_id: str):
    db = get_db()
    try:
        doc = db.documents.find_one({"_id": ObjectId(document_id)})
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid document ID format.")
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    fs = gridfs.GridFS(db)
    grid_file = fs.get(doc["gridfs_id"])

    return StreamingResponse(
        grid_file,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc["filename"]}"'},
    )


@router.get("/{document_id}", response_model=DocumentRecord)
def get_document(document_id: str, request: Request):
    db = get_db()
    try:
        doc = db.documents.find_one({"_id": ObjectId(document_id)})
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid document ID format.")
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc["id"] = str(doc.pop("_id"))
    doc.pop("gridfs_id", None)
    doc["download_url"] = str(request.url_for("download_document", document_id=doc["id"]))
    return doc
