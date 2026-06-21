from pydantic import BaseModel
from typing import Any
from datetime import datetime


class ChunkResponse(BaseModel):
    id: str
    document_id: str
    text: str
    chunk_index: int
    metadata: dict[str, Any]


class IngestResponse(BaseModel):
    document_id: str
    filename: str
    chunks_stored: int
    skipped: bool = False


class DocumentRecord(BaseModel):
    id: str
    filename: str
    size_bytes: int
    chunk_count: int
    created_at: datetime
    download_url: str | None = None
