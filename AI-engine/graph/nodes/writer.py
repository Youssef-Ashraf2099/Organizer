from graph.state import AgentState
from llm.engine import engine
from llm.prompts import WRITER_PROMPT
from tools.tool_registry import get_tools_prompt

async def writer_node(state: AgentState):
    print("Writer node running...")
    
    context = state.get("context", "")
    task = state.get("task", "")
    persona = state.get("persona", "General Assistant")
    
    system_prompt = f"{WRITER_PROMPT}\n\nPersona: {persona}\n\n{get_tools_prompt()}"
    user_prompt = f"Context:\n{context}\n\nTask:\n{task}"
    
    # We pass the tools schema to enforce JSON output (mocked for now, but in reality LLM will try to output it)
    response = await engine.generate_response(system_prompt, user_prompt, json_schema=True)
    
    return {"draft": response}
