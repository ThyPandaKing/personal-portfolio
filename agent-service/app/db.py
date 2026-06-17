"""Read-only access to the portfolio MongoDB, shared with the Node backend."""
from functools import lru_cache
from typing import Any

import certifi
import gridfs
from bson import ObjectId
from pymongo import MongoClient
from pymongo.database import Database

from app.config import get_settings


@lru_cache
def get_db() -> Database:
    settings = get_settings()
    # Atlas connects over TLS. Python does not use the OS trust store, so point
    # pymongo at certifi's CA bundle to avoid CERTIFICATE_VERIFY_FAILED.
    client = MongoClient(
        settings.mongo_uri,
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where(),
    )
    return client[settings.mongo_db]


def read_gridfs_file(file_id: str) -> bytes | None:
    """Read the bytes of a file stored in GridFS (bucket 'uploads'). None if missing."""
    if not file_id or not ObjectId.is_valid(file_id):
        return None
    try:
        fs = gridfs.GridFS(get_db(), collection="uploads")
        return fs.get(ObjectId(file_id)).read()
    except Exception:
        return None


def _clean(doc: dict[str, Any]) -> dict[str, Any]:
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def get_profile() -> dict[str, Any] | None:
    s = get_settings()
    doc = get_db()[s.col_profile].find_one()
    return _clean(doc) if doc else None


def get_skills() -> list[dict[str, Any]]:
    s = get_settings()
    return [_clean(d) for d in get_db()[s.col_skills].find().sort("category", 1)]


def get_projects(
    project_type: str | None = None,
    published_only: bool = True,
    ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    from bson import ObjectId

    s = get_settings()
    query: dict[str, Any] = {}
    if project_type:
        query["type"] = project_type
    if published_only:
        query["published"] = True
    if ids:
        query["_id"] = {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}
    return [_clean(d) for d in get_db()[s.col_projects].find(query).sort("order", 1)]


def get_blogs(published_only: bool = True) -> list[dict[str, Any]]:
    s = get_settings()
    query = {"published": True} if published_only else {}
    return [_clean(d) for d in get_db()[s.col_blogs].find(query)]
