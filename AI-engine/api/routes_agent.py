from fastapi import APIRouter
from pydantic import BaseModel
from graph.workflow import app_graph
from graph.state import AgentState
from Memory.state_store import state_store
import uuid
import json
import re
from typing import Optional, Dict

router = APIRouter()

class AgentRequest(BaseModel):
    page_id: str
    task: str
    page_content: str = ""

ALLOWED_ACTIONS = {
    "insert_block",
    "replace_all",
    "replace_text",
    "delete_block",
}

def normalize_tool_command(cmd: dict) -> Optional[Dict]:
    action = cmd.get("action")
    if not isinstance(action, str):
        return None
    if action not in ALLOWED_ACTIONS:
        return None
    if "<" in action or ">" in action:
        return None
    params = cmd.get("params")
    if params is None:
        cmd["params"] = {}
    elif not isinstance(params, dict):
        return None
    return cmd

def find_json_tool_commands(text: str) -> list[dict]:
    commands: list[dict] = []
    stack = 0
    start = None
    for idx, ch in enumerate(text):
        if ch == "{":
            if stack == 0:
                start = idx
            stack += 1
        elif ch == "}" and stack > 0:
            stack -= 1
            if stack == 0 and start is not None:
                snippet = text[start : idx + 1]
                start = None
                try:
                    parsed = json.loads(snippet)
                except json.JSONDecodeError:
                    continue
                if isinstance(parsed, dict):
                    cmd = normalize_tool_command(parsed)
                    if cmd:
                        commands.append(cmd)
    return commands

def extract_tool_commands(text: str) -> list[dict]:
    commands: list[dict] = []
    pattern = re.compile(r"```tool_command\s*([\s\S]*?)```", re.IGNORECASE)
    for m in pattern.finditer(text):
        try:
            cmd = json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            continue
        if isinstance(cmd, dict):
            normalized = normalize_tool_command(cmd)
            if normalized:
                commands.append(normalized)

    code_pattern = re.compile(r"```[a-zA-Z0-9_-]*\s*([\s\S]*?)```")
    for m in code_pattern.finditer(text):
        block = m.group(1).strip()
        if not block.startswith("{"):
            continue
        try:
            cmd = json.loads(block)
        except json.JSONDecodeError:
            continue
        if isinstance(cmd, dict):
            normalized = normalize_tool_command(cmd)
            if normalized:
                commands.append(normalized)

    if not commands:
        commands.extend(find_json_tool_commands(text))

    unique: list[dict] = []
    seen = set()
    for cmd in commands:
        key = json.dumps(cmd, sort_keys=True)
        if key not in seen:
            seen.add(key)
            unique.append(cmd)
    return unique

def strip_tool_blocks(text: str) -> str:
    return re.sub(r"```tool_command[\s\S]*?```", "", text, flags=re.IGNORECASE).strip()

def strip_json_blocks(text: str) -> str:
    return re.sub(r"```json[\s\S]*?```", "", text, flags=re.IGNORECASE).strip()

def strip_tool_prompt_echo(text: str) -> str:
    lines = []
    for line in text.splitlines():
        lower = line.strip().lower()
        if not lower:
            lines.append(line)
            continue
        if "tool_command" in lower or "tool commands" in lower:
            continue
        if lower.startswith("- **insert_block**"):
            continue
        if lower.startswith("- **replace_all**"):
            continue
        if lower.startswith("- **replace_text**"):
            continue
        if lower.startswith("- **delete_block**"):
            continue
        if "you have access to the following editor tools" in lower:
            continue
        if lower.startswith("params:") and "{" in lower and "}" in lower:
            continue
        lines.append(line)
    return "\n".join(lines).strip()

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
    response_text = strip_tool_prompt_echo(response_text)
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
