from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import asyncio
import logging

from api.routes_sync import router as sync_router
from api.routes_chat import router as chat_router
from api.routes_agent import router as agent_router
from api.routes_metrics import router as metrics_router
from llm.engine import engine

import warnings

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger("uvicorn.access").disabled = True

# Suppress LangChain and LangGraph deprecation warnings
warnings.filterwarnings("ignore", message=".*LangChainPendingDeprecationWarning.*")
warnings.filterwarnings("ignore", module="langgraph")

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
app.include_router(metrics_router, prefix="/metrics", tags=["Metrics"])

import os
import psutil

DEBUG_MODE = os.getenv("DEBUG_MODE", "True").lower() in ("true", "1", "yes")

async def metrics_logger():
    process = psutil.Process(os.getpid())
    # First call to cpu_percent initializes it
    process.cpu_percent()
    while DEBUG_MODE:
        cpu = process.cpu_percent()
        mem = process.memory_info()
        logger.info(f"[DEBUGGER] App CPU: {cpu}% | App RAM: {round(mem.rss/(1024*1024))}MB")
        await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing AI Engine...")
    if DEBUG_MODE:
        logger.info("Starting background metrics debugger...")
        asyncio.create_task(metrics_logger())
    # Initialize Vector DB and Models here in the future
    logger.info("AI Engine started successfully.")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down AI Engine...")
    # Cleanup resources here

@app.get("/health")
async def health_check():
    return await engine.health()

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
