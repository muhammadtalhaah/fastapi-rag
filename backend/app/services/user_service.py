from bson import ObjectId
from pymongo.database import Database
from models.user import UserCreate, UserUpdate


def create_user(db: Database, data: UserCreate) -> dict:
    result = db.users.insert_one(data.model_dump())
    return {"id": str(result.inserted_id), **data.model_dump()}


def get_user(db: Database, user_id: str) -> dict | None:
    doc = db.users.find_one({"_id": ObjectId(user_id)})
    if doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


def list_users(db: Database) -> list[dict]:
    users = []
    for doc in db.users.find():
        doc["id"] = str(doc.pop("_id"))
        users.append(doc)
    return users


def update_user(db: Database, user_id: str, data: UserUpdate) -> dict | None:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    return get_user(db, user_id)


def delete_user(db: Database, user_id: str) -> bool:
    result = db.users.delete_one({"_id": ObjectId(user_id)})
    return result.deleted_count == 1
