from pydantic import BaseModel
from typing import Optional


class DocumentCreate(BaseModel):
    title: str
    content: str
    owner_id: str


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class DocumentResponse(BaseModel):
    id: str
    title: str
    content: str
    owner_id: str
