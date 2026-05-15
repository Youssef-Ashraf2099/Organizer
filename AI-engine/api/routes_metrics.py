import os
import psutil
from fastapi import APIRouter, HTTPException

router = APIRouter()

# Read the DEBUG_MODE flag. Defaults to False.
DEBUG_MODE = os.getenv("DEBUG_MODE", "True").lower() in ("true", "1", "yes")

@router.get("/")
def get_metrics():
    """
    Returns hardware metrics (CPU, RAM) if DEBUG_MODE is enabled.
    This helps monitor the AI Engine's true footprint separate from the IDE.
    """
    if not DEBUG_MODE:
        raise HTTPException(status_code=403, detail="Metrics endpoint is disabled in production (DEBUG_MODE=False).")
    
    process = psutil.Process(os.getpid())
    cpu_percent = process.cpu_percent(interval=0.1)
    mem = process.memory_info()
    
    return {
        "app_cpu_percent": cpu_percent,
        "app_memory_mb": round(mem.rss / (1024 * 1024), 2),
        "debug_mode": DEBUG_MODE
    }
