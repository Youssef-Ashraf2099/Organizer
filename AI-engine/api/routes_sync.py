from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
from memory.vector_store import vector_store
import uuid

router = APIRouter()
logger = logging.getLogger(__name__)

class SyncContextRequest(BaseModel):
    page_id: str
    content: str
    type: str = "markdown" # "markdown" or "pdf"

@router.post("/context")
async def sync_context(req: SyncContextRequest):
    """
    Receives page content or PDF text and stores it in ChromaDB,
    partitioned by page_id.
    """
    logger.info(f"Syncing context for page {req.page_id}")
    try:
        # Simple chunking for stub
        # In a real scenario, use LangChain text splitters
        chunks = [req.content[i:i+1000] for i in range(0, len(req.content), 1000)]
        ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [{"source": req.type, "page_id": req.page_id} for _ in chunks]

        await vector_store.add_context(
            page_id=req.page_id,
            texts=chunks,
            metadatas=metadatas,
            ids=ids
        )
        
        return {"status": "success", "message": f"Context synced for {req.page_id}"}
    except Exception as e:
        logger.error(f"Error syncing context: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync context")
