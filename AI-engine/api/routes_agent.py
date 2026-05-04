from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class AgentRequest(BaseModel):
    page_id: str
    task: str

@router.post("/")
async def agent_task(req: AgentRequest):
    """
    Handles Autonomous Tasks (Agent Mode).
    """
    return {"status": "started", "task": req.task}
