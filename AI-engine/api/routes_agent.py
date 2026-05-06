from fastapi import APIRouter
from pydantic import BaseModel
from graph.workflow import app_graph
from graph.state import AgentState
from Memory.state_store import state_store
import uuid
import json
import re
from typing import Optional

router = APIRouter()

class AgentRequest(BaseModel):
    page_id: str
    task: str
    page_content: str = ""

def extract_tool_commands(text: str) -> list[dict]:
    commands = []
    pattern = re.compile(r"```tool_command\s*([\s\S]*?)```", re.IGNORECASE)
    for m in pattern.finditer(text):
        try:
            cmd = json.loads(m.group(1).strip())
            if cmd.get("action"):
                commands.append(cmd)
        except json.JSONDecodeError:
            pass

    if not commands:
        stripped = text.strip()
        if stripped.startswith("{"):
            try:
                cmd = json.loads(stripped)
                if cmd.get("action"):
                    commands.append(cmd)
            except json.JSONDecodeError:
                pass

    return commands

def strip_tool_blocks(text: str) -> str:
    return re.sub(r"```tool_command[\s\S]*?```", "", text, flags=re.IGNORECASE).strip()

def strip_json_blocks(text: str) -> str:
    return re.sub(r"```json[\s\S]*?```", "", text, flags=re.IGNORECASE).strip()

def extract_content_from_json(text: str) -> Optional[str]:
    try:
        data = json.loads(text.strip())
        if isinstance(data, dict) and isinstance(data.get("content"), str):
            return data["content"].strip()
    except json.JSONDecodeError:
        return None
    return None

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
        page_content=req.page_content or "",
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
    
    draft = final_state.get("draft") or ""
    tool_commands = extract_tool_commands(draft)
    response_text = strip_tool_blocks(draft)
    response_text = strip_json_blocks(response_text)
    if not response_text.strip():
        extracted = extract_content_from_json(draft)
        if extracted:
            response_text = extracted
        elif final_state.get("feedback"):
            response_text = str(final_state.get("feedback"))
        elif tool_commands:
            response_text = "Applied changes to the page."

    return {
        "status": "completed", 
        "task": req.task,
        "response": response_text,
        "tool_commands": tool_commands,
        "feedback": final_state.get("feedback"),
        "state_id": state_id
    }
