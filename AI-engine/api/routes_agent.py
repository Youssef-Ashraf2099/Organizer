from fastapi import APIRouter
from pydantic import BaseModel
from graph.workflow import app_graph
from graph.state import AgentState
from Memory.state_store import state_store
import uuid

router = APIRouter()

class AgentRequest(BaseModel):
    page_id: str
    task: str

@router.post("/")
async def agent_task(req: AgentRequest):
    """
    Handles Autonomous Tasks (Agent Mode) using LangGraph.
    """
    # Create an initial state
    initial_state = AgentState(
        messages=[],
        page_id=req.page_id,
        task=req.task,
        context="",
        draft="",
        persona="General Assistant",
        feedback=""
    )
    
    # Run the graph
    # LangGraph compile().ainvoke handles async execution
    final_state = await app_graph.ainvoke(initial_state)
    
    # Save the final state to sqlite
    state_id = str(uuid.uuid4())
    state_store.save_agent_state(state_id, req.page_id, final_state)
    
    return {
        "status": "completed", 
        "task": req.task,
        "draft": final_state.get("draft"),
        "feedback": final_state.get("feedback"),
        "state_id": state_id
    }
