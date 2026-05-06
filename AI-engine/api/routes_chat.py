from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
import re
import logging

from llm.engine import engine
from llm.prompts import WRITER_PROMPT
from tools.tool_registry import get_tools_prompt
from Memory.vector_store import vector_store

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
    """
    Extracts tool commands from tool_command blocks, JSON blocks, or inline JSON.
    """
    commands: list[dict] = []

    # Try ```tool_command blocks first
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

    # Try generic code blocks that may contain JSON
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

    # Fallback: scan for inline JSON
    if not commands:
        commands.extend(find_json_tool_commands(text))

    # Deduplicate
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

def build_system_prompt(page_content: str, allow_tools: bool) -> str:
    page_section = (
        f"\n\n=== CURRENT PAGE CONTENT ===\n{page_content}\n=== END PAGE CONTENT ==="
        if page_content
        else "\n\n(No page content provided.)"
    )

    if not allow_tools:
        return f"{WRITER_PROMPT}{page_section}"

    tools_section = get_tools_prompt()
    rules_section = """
Rules:
- Output markdown ONLY, never HTML.
- Always copy existing content into replace_all unless the user explicitly wants removal.
- Explain what you did after any tool commands.
"""
    return f"{WRITER_PROMPT}{page_section}\n\n{tools_section}\n{rules_section}"

async def fetch_rag_context(page_id: str, query: str) -> str:
    if not page_id or not query:
        return ""
    try:
        results = await vector_store.query_context(
            page_id=page_id,
            query_texts=[query],
            n_results=3,
        )
    except Exception:
        return ""

    docs: list[str] = []
    for doc_list in results.get("documents", []):
        for doc in doc_list:
            if isinstance(doc, str) and doc.strip():
                docs.append(doc.strip())

    if not docs:
        return ""

    return "\n".join(f"- {doc}" for doc in docs)

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

    rag_context = await fetch_rag_context(req.page_id, req.message)
    if rag_context:
        user_prompt = (
            f"{history_text}Context:\n{rag_context}\n\n"
            f"User: {req.message}\nAssistant:"
        )
    else:
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
        display_text = strip_tool_prompt_echo(display_text)
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

