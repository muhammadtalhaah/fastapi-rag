from pydantic import BaseModel


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5
    session_id: str | None = None


class SourceChunk(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    text: str
    score: float


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    session_id: str | None = None
