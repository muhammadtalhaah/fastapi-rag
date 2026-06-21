from bson import ObjectId
from pymongo.database import Database
from models.document import DocumentCreate, DocumentUpdate


def create_document(db: Database, data: DocumentCreate) -> dict:
    result = db.documents.insert_one(data.model_dump())
    return {"id": str(result.inserted_id), **data.model_dump()}


def get_document(db: Database, doc_id: str) -> dict | None:
    doc = db.documents.find_one({"_id": ObjectId(doc_id)})
    if doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


def list_documents(db: Database, owner_id: str | None = None) -> list[dict]:
    query = {"owner_id": owner_id} if owner_id else {}
    docs = []
    for doc in db.documents.find(query):
        doc["id"] = str(doc.pop("_id"))
        docs.append(doc)
    return docs


def update_document(db: Database, doc_id: str, data: DocumentUpdate) -> dict | None:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": updates})
    return get_document(db, doc_id)


def delete_document(db: Database, doc_id: str) -> bool:
    result = db.documents.delete_one({"_id": ObjectId(doc_id)})
    return result.deleted_count == 1
