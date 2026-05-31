from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
import re
import logging

from llm.engine import engine
from llm.prompts import WRITER_PROMPT
from tools.tool_registry import get_tools_prompt, ALLOWED_ACTIONS
from Memory.vector_store import vector_store

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── Models ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str       # "user" | "assistant" | "system"
    content: str

class ChatRequest(BaseModel):
    page_id: str
    message: str
    history: Optional[List[ChatMessage]] = []
    page_content: Optional[str] = ""
    allow_tools: Optional[bool] = False

# ─── Context Budget ───────────────────────────────────────────────────────────

def trim_page_content(content: str, max_chars: int = 800) -> str:
    """
    Trim page content to a safe budget before injecting into the LLM prompt.
    Prevents context overflow on small models (2B-4B params).
    Trims at word boundaries and appends a truncation notice.
    """
    if not content or len(content) <= max_chars:
        return content
    trimmed = content[:max_chars]
    # Trim to last complete word
    last_space = trimmed.rfind(" ")
    if last_space > max_chars // 2:
        trimmed = trimmed[:last_space]
    return trimmed + "\n[...content trimmed for context budget...]"

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
    """Scan text for top-level JSON objects that look like tool commands."""
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
    Extract block-native tool commands from the LLM output.
    Checks tool_command blocks first, then generic code blocks, then inline JSON.
    The old markdown fallback has been removed to prevent raw-content leakage.
    """
    commands: list[dict] = []

    # 1. Explicit ```tool_command blocks (highest priority)
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

    # 2. Generic code blocks containing JSON
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

    # 3. Fallback: inline JSON scan
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
    """Remove lines that echo back system instructions or page context markers."""
    bad_patterns = [
        r"={3,}\s*CURRENT PAGE CONTENT\s*={3,}",
        r"={3,}\s*END PAGE CONTENT\s*={3,}",
        r"```tool_command",
        r"you have access to the following editor tools",
        r"supported block types:",
    ]
    lines = []
    for line in text.splitlines():
        lower = line.strip().lower()
        if any(re.search(p, lower, re.IGNORECASE) for p in bad_patterns):
            continue
        lines.append(line)
    return "\n".join(lines).strip()

# ─── Prompt Builder ───────────────────────────────────────────────────────────

def build_system_prompt(page_content: str, allow_tools: bool) -> str:
    trimmed = trim_page_content(page_content)
    page_section = (
        f"\n\n=== CURRENT PAGE ===\n{trimmed}\n=== END PAGE ==="
        if trimmed
        else "\n\n(Page is empty.)"
    )
    if not allow_tools:
        return f"{WRITER_PROMPT}{page_section}"
    return f"{WRITER_PROMPT}{page_section}\n\n{get_tools_prompt()}"

# ─── RAG Context ──────────────────────────────────────────────────────────────

async def fetch_rag_context(page_id: str, query: str) -> str:
    if not page_id or not query:
        return ""
    try:
        results = await vector_store.query_context(
            page_id=page_id, query_texts=[query], n_results=3,
        )
    except Exception:
        return ""
    docs = [
        doc.strip()
        for doc_list in results.get("documents", [])
        for doc in doc_list
        if isinstance(doc, str) and doc.strip()
    ]
    return "\n".join(f"- {d}" for d in docs) if docs else ""

# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/")
async def chat_interaction(req: ChatRequest):
    """
    Multi-turn AI chat powered by the Gemini Web2API-backed engine.
    Returns: { response, tool_commands[] }
    """
    system_prompt = build_system_prompt(req.page_content or "", bool(req.allow_tools))

    # Build conversation history text
    history_text = ""
    for msg in (req.history or []):
        if msg.role == "user":
            history_text += f"User: {msg.content}\n"
        elif msg.role == "assistant":
            history_text += f"Assistant: {msg.content}\n"

    rag_context = await fetch_rag_context(req.page_id, req.message)
    if rag_context:
        user_prompt = f"{history_text}Context:\n{rag_context}\n\nUser: {req.message}\nAssistant:"
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
        display_text = strip_system_echo(display_text)
    else:
        tool_commands = []
        display_text = strip_system_echo(raw)

    if not display_text.strip() and tool_commands:
        display_text = "Applied changes to the page."

    return {
        "response": display_text,
        "tool_commands": tool_commands,
    }
