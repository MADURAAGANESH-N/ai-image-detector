import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from detector import analyze_image
from database import save_analysis, get_history, get_analysis_by_id, get_stats, delete_analysis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 15 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 AI Image Detector API starting up...")
    yield
    logger.info("🛑 Shutting down...")


app = FastAPI(
    title="AI Image Detector API",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# allow_credentials MUST be False when allow_origins=["*"]
# otherwise browsers strip the CORS header entirely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "AI Image Detector",
        "version": "1.0.0",
        "status": "online",
        "endpoints": ["/api/analyze", "/api/history", "/api/stats"],
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}",
        )

    image_bytes = await file.read()

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max 15MB")

    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="File appears empty or corrupted")

    try:
        result = analyze_image(image_bytes, filename=file.filename or "upload.jpg")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal analysis error")

    try:
        doc_id = await save_analysis(result)
        result["_id"] = doc_id
    except Exception as e:
        logger.warning(f"Failed to save to MongoDB: {e}")
        result["_id"] = None

    return JSONResponse(content=result)


@app.get("/api/history")
async def history(
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    try:
        docs = await get_history(limit=limit, skip=skip)
        return {"items": docs, "limit": limit, "skip": skip}
    except Exception as e:
        logger.error(f"History fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch history")


@app.get("/api/history/{analysis_id}")
async def get_single(analysis_id: str):
    doc = await get_analysis_by_id(analysis_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return doc


@app.get("/api/stats")
async def stats():
    try:
        return await get_stats()
    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


@app.delete("/api/history/{analysis_id}")
async def delete(analysis_id: str):
    deleted = await delete_analysis(analysis_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"deleted": True, "id": analysis_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)