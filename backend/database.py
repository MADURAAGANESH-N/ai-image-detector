import os
from datetime import datetime
from typing import Optional
import logging

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

logger = logging.getLogger(__name__)

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://madhuraaaganesh_db_user:RaMYA%401982@cluster0.qzhfzew.mongodb.net/",
)
DB_NAME = os.getenv("DB_NAME", "ai_image_detector")

_client: Optional[AsyncIOMotorClient] = None
_db = None


async def get_db():
    global _client, _db
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        _db = _client[DB_NAME]
        # Create indexes
        try:
            await _db.analyses.create_index([("created_at", -1)])
            await _db.analyses.create_index([("verdict", 1)])
            logger.info("MongoDB connected and indexes ensured")
        except Exception as e:
            logger.error(f"MongoDB index creation failed: {e}")
    return _db


async def save_analysis(result: dict) -> str:
    """Save analysis result to MongoDB. Returns the inserted document ID."""
    db = await get_db()
    doc = {
        **result,
        "created_at": datetime.utcnow(),
    }
    inserted = await db.analyses.insert_one(doc)
    return str(inserted.inserted_id)


async def get_history(limit: int = 20, skip: int = 0) -> list[dict]:
    """Get analysis history, newest first. Excludes large base64 fields."""
    db = await get_db()
    projection = {
        "annotated_image": 0,
        "ela_image": 0,
        "original_thumb": 0,
    }
    cursor = db.analyses.find({}, projection).sort("created_at", -1).skip(skip).limit(limit)
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs


async def get_analysis_by_id(analysis_id: str) -> Optional[dict]:
    """Get full analysis document by ID."""
    db = await get_db()
    try:
        doc = await db.analyses.find_one({"_id": ObjectId(analysis_id)})
    except Exception:
        return None
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


async def get_stats() -> dict:
    """Get aggregate statistics."""
    db = await get_db()
    pipeline = [
        {
            "$group": {
                "_id": "$verdict",
                "count": {"$sum": 1},
                "avg_confidence": {"$avg": "$confidence"},
            }
        }
    ]
    cursor = db.analyses.aggregate(pipeline)
    stats = {"total": 0, "verdicts": {}}
    async for doc in cursor:
        label = doc["_id"] or "Unknown"
        stats["verdicts"][label] = {
            "count": doc["count"],
            "avg_confidence": round(doc["avg_confidence"], 2),
        }
        stats["total"] += doc["count"]
    return stats


async def delete_analysis(analysis_id: str) -> bool:
    db = await get_db()
    try:
        res = await db.analyses.delete_one({"_id": ObjectId(analysis_id)})
        return res.deleted_count > 0
    except Exception:
        return False
