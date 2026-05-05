from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import re
import logging

from llm.engine import engine
from llm.prompts import WRITER_PROMPT
from tools.tool_registry import get_tools_prompt

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── Models ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant" | "system"
    content: str

class ChatRequest(BaseModel):
    page_id: str
    message: str
    history: Optional[List[ChatMessage]] = []
    page_content: Optional[str] = ""
    allow_tools: Optional[bool] = False

# ─── Helpers ──────────────────────────────────────────────────────────────────

def extract_tool_commands(text: str) -> list[dict]:
    """
    Extracts ```tool_command ... ``` blocks from the model output.
    Falls back to bare JSON object if the whole output is JSON.
    """
    commands = []

    # Try ```tool_command blocks first
    pattern = re.compile(r"```tool_command\s*([\s\S]*?)```", re.IGNORECASE)
    for m in pattern.finditer(text):
        try:
            cmd = json.loads(m.group(1).strip())
            if cmd.get("action"):
                commands.append(cmd)
        except json.JSONDecodeError:
            pass

    # If no blocks, check if the entire output is a single JSON tool command
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

def build_system_prompt(page_content: str, allow_tools: bool) -> str:
    page_section = (
        f"\n\n=== CURRENT PAGE CONTENT ===\n{page_content}\n=== END PAGE CONTENT ==="
        if page_content
        else "\n\n(No page content provided.)"
    )

    if not allow_tools:
        return f"{WRITER_PROMPT}{page_section}"

    tools_section = """
## Tool Commands

To modify the page, emit one or more tool commands wrapped in triple backticks:

```tool_command
{"action": "replace_all", "description": "Short description", "params": {"markdown": "# Full page in markdown"}}
```

Available actions:
- **replace_all**: Replace entire page. Params: { markdown: string }
- **insert_block**: Insert a block. Params: { type: "paragraph"|"heading"|"bulletListItem"|"numberedListItem", content: string, level?: 1|2|3 }
- **replace_text**: Find & replace. Params: { find: string, replace: string }
- **delete_block**: Delete matching block. Params: { content: string }

Rules:
- Output markdown ONLY, never HTML.
- Use emoji for visual appeal (✅ 🚀 📝 etc.)
- Always copy existing content into replace_all — never truncate.
- Explain what you did after any tool commands.
"""
    return f"{WRITER_PROMPT}{page_section}\n{tools_section}"

# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/")
async def chat_interaction(req: ChatRequest):
    """
    Multi-turn AI chat powered by the local LLM engine.
    Returns: { response, tool_commands[] }
    """
    system_prompt = build_system_prompt(req.page_content or "", bool(req.allow_tools))

    # Build a single user prompt that includes conversation history
    history_text = ""
    for msg in (req.history or []):
        if msg.role == "user":
            history_text += f"User: {msg.content}\n"
        elif msg.role == "assistant":
            history_text += f"Assistant: {msg.content}\n"

    user_prompt = f"{history_text}User: {req.message}\nAssistant:"

    try:
        raw = await engine.generate_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
    except Exception as e:
        logger.error(f"LLM engine error: {e}")
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")

    if req.allow_tools:
        tool_commands = extract_tool_commands(raw)
        display_text = strip_tool_blocks(raw) if tool_commands else raw
    else:
        tool_commands = []
        display_text = raw

    display_text = strip_json_blocks(display_text)
    if not display_text.strip():
        extracted = extract_content_from_json(raw)
        if extracted:
            display_text = extracted

    return {
        "response": display_text,
        "tool_commands": tool_commands,
        "raw": raw,
    }

