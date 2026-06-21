from fastapi import APIRouter, HTTPException
from typing import Optional
from models.document import DocumentCreate, DocumentUpdate, DocumentResponse
from services import document_service
import db.connection as db_connection

router = APIRouter(prefix="/documents", tags=["documents"])


def get_db():
    return db_connection.client["rag_db"]


@router.post("/", response_model=DocumentResponse, status_code=201)
def create_document(body: DocumentCreate):
    return document_service.create_document(get_db(), body)


@router.get("/", response_model=list[DocumentResponse])
def list_documents(owner_id: Optional[str] = None):
    return document_service.list_documents(get_db(), owner_id)


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: str):
    doc = document_service.get_document(get_db(), doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.patch("/{doc_id}", response_model=DocumentResponse)
def update_document(doc_id: str, body: DocumentUpdate):
    doc = document_service.update_document(get_db(), doc_id, body)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str):
    if not document_service.delete_document(get_db(), doc_id):
        raise HTTPException(status_code=404, detail="Document not found")
