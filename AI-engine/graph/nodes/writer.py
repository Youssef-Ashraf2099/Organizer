import logging

from graph.state import AgentState
from llm.engine import engine
from llm.prompts import WRITER_PROMPT
from tools.tool_registry import get_tools_prompt

logger = logging.getLogger(__name__)

_MAX_PAGE_CHARS = 800

def _trim(content: str) -> str:
    """Keep page context within the LLM's safe context budget."""
    if not content or len(content) <= _MAX_PAGE_CHARS:
        return content
    trimmed = content[:_MAX_PAGE_CHARS]
    last_space = trimmed.rfind(" ")
    if last_space > _MAX_PAGE_CHARS // 2:
        trimmed = trimmed[:last_space]
    return trimmed + "\n[...trimmed...]"

async def writer_node(state: AgentState):
    logger.info("Writer node running...")

    context      = state.get("context", "")
    task         = state.get("task", "")
    persona      = state.get("persona", "General Assistant")
    page_content = _trim(state.get("page_content", ""))

    system_prompt = (
        f"{WRITER_PROMPT}\n\nPersona: {persona}\n\n{get_tools_prompt()}\n\n"
        "Rules:\n"
        "- If the task asks for page edits, you MUST emit a tool_command block.\n"
        "- Never repeat tool definitions or schemas.\n"
        "- After your tool_command, write ONE sentence summary only."
    )

    page_section = (
        f"=== CURRENT PAGE ===\n{page_content}\n=== END PAGE ==="
        if page_content
        else "(Page is empty.)"
    )

    feedback = state.get("feedback", "")
    user_prompt = f"{page_section}\n\nContext:\n{context}\n\nTask:\n{task}"
    if feedback and "APPROVE" not in feedback.upper():
        user_prompt += f"\n\nReviewer feedback:\n{feedback}\nPlease revise to address this feedback."

    response = await engine.generate_response(system_prompt, user_prompt)
    return {"draft": response}
