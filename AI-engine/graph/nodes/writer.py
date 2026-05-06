import logging

from graph.state import AgentState
from llm.engine import engine
from llm.prompts import WRITER_PROMPT
from tools.tool_registry import get_tools_prompt

logger = logging.getLogger(__name__)

async def writer_node(state: AgentState):
    logger.info("Writer node running...")
    
    context = state.get("context", "")
    task = state.get("task", "")
    persona = state.get("persona", "General Assistant")
    page_content = state.get("page_content", "")
    
    system_prompt = (
        f"{WRITER_PROMPT}\n\nPersona: {persona}\n\n{get_tools_prompt()}\n\n"
        "Rules:\n"
        "- If the task asks for page edits or writing, you MUST emit tool_command blocks.\n"
        "- After the tool blocks, provide a short summary for the panel.\n"
        "- Never repeat the tool list or schema."
    )
    user_prompt = f"Page Content:\n{page_content}\n\nContext:\n{context}\n\nTask:\n{task}"
    
    response = await engine.generate_response(system_prompt, user_prompt)
    
    return {"draft": response}
