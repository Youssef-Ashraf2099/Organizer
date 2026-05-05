from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import asyncio
import logging

from api.routes_sync import router as sync_router
from api.routes_chat import router as chat_router
from api.routes_agent import router as agent_router
from llm.engine import engine

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger("uvicorn.access").disabled = True

app = FastAPI(title="Omni AI Engine", version="1.0.0")

# Configure CORS so Tauri can talk to it if needed via localhost (though Rust HTTP clients don't strictly need CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(sync_router, prefix="/sync", tags=["Sync"])
app.include_router(chat_router, prefix="/chat", tags=["Chat"])
app.include_router(agent_router, prefix="/agent", tags=["Agent"])

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing AI Engine...")
    # Initialize Vector DB and Models here in the future
    logger.info("AI Engine started successfully.")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down AI Engine...")
    # Cleanup resources here

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model_loaded": engine.is_loaded(),
        "model_path": engine.model_path,
        "n_ctx": engine.n_ctx,
        "n_threads": engine.n_threads,
        "n_gpu_layers": engine.n_gpu_layers,
        "n_batch": engine.n_batch,
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
