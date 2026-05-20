from fastapi import APIRouter
from pydantic import BaseModel
from graph.workflow import app_graph
from graph.state import AgentState
from Memory.state_store import state_store
import uuid
import json
import re
from typing import Optional, Dict

from tools.tool_registry import ALLOWED_ACTIONS

router = APIRouter()

class AgentRequest(BaseModel):
    page_id: str
    task: str
    page_content: str = ""

# ─── Context Budget ───────────────────────────────────────────────────────────

def trim_page_content(content: str, max_chars: int = 800) -> str:
    """Trim page content to prevent LLM context overflow."""
    if not content or len(content) <= max_chars:
        return content
    trimmed = content[:max_chars]
    last_space = trimmed.rfind(" ")
    if last_space > max_chars // 2:
        trimmed = trimmed[:last_space]
    return trimmed + "\n[...trimmed...]"

# ─── Tool Command Extraction ──────────────────────────────────────────────────

def normalize_tool_command(cmd: dict) -> Optional[Dict]:
    action = cmd.get("action")
    if not isinstance(action, str) or action not in ALLOWED_ACTIONS:
        return None
    if cmd.get("params") is None:
        cmd["params"] = {}
    elif not isinstance(cmd.get("params"), dict):
        return None
    return cmd

def find_json_objects(text: str) -> list[dict]:
    commands = []
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
                snippet = text[start:idx + 1]
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
    """
    Extract block-native tool commands from LLM output.
    No markdown fallback — prevents raw content leakage.
    """
    commands: list[dict] = []

    # 1. Explicit tool_command blocks
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

    # 2. Generic code blocks
    if not commands:
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

    # 3. Inline JSON scan fallback
    if not commands:
        commands.extend(find_json_objects(text))

    # Deduplicate
    unique: list[dict] = []
    seen: set[str] = set()
    for cmd in commands:
        key = json.dumps(cmd, sort_keys=True)
        if key not in seen:
            seen.add(key)
            unique.append(cmd)

    return unique

def strip_tool_blocks(text: str) -> str:
    text = re.sub(r"```tool_command[\s\S]*?```", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```json[\s\S]*?```", "", text, flags=re.IGNORECASE)
    return text.strip()

def strip_system_echo(text: str) -> str:
    bad = [
        r"={3,}\s*CURRENT PAGE\s*={3,}",
        r"={3,}\s*END PAGE\s*={3,}",
        r"supported block types:",
        r"you have access to the following editor tools",
    ]
    lines = []
    for line in text.splitlines():
        if any(re.search(p, line, re.IGNORECASE) for p in bad):
            continue
        lines.append(line)
    return "\n".join(lines).strip()

# ─── Agent Endpoint ───────────────────────────────────────────────────────────

@router.post("/")
async def agent_task(req: AgentRequest):
    """Autonomous agent mode using LangGraph (Researcher → Writer → Reviewer)."""
    trimmed_content = trim_page_content(req.page_content or "")

    initial_state = AgentState(
        messages=[],
        page_id=req.page_id,
        task=req.task,
        page_content=trimmed_content,
        context="",
        draft="",
        persona="General Assistant",
        feedback="",
        revision_count=0,
    )

    final_state = await app_graph.ainvoke(initial_state)

    state_id = str(uuid.uuid4())
    state_store.save_agent_state(state_id, req.page_id, final_state)

    draft = final_state.get("draft") or ""
    tool_commands = extract_tool_commands(draft)

    response_text = strip_tool_blocks(draft)
    response_text = strip_system_echo(response_text)

    if not response_text.strip():
        if final_state.get("feedback") and "APPROVE" not in str(final_state.get("feedback")).upper():
            response_text = str(final_state.get("feedback"))
        elif tool_commands:
            response_text = "Applied changes to the page."
        else:
            response_text = "(No response generated.)"

    return {
        "status": "completed",
        "task": req.task,
        "response": response_text,
        "tool_commands": tool_commands,
        "feedback": final_state.get("feedback"),
        "state_id": state_id,
    }
