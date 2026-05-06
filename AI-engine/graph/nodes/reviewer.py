import logging

from graph.state import AgentState
from llm.engine import engine
from llm.prompts import REVIEWER_PROMPT

logger = logging.getLogger(__name__)

async def reviewer_node(state: AgentState):
    logger.info("Reviewer node running...")
    
    context = state.get("context", "")
    draft = state.get("draft", "")
    
    system_prompt = REVIEWER_PROMPT
    user_prompt = f"Context:\n{context}\n\nDraft:\n{draft}\n\nPlease review the draft against the context."
    
    response = await engine.generate_response(system_prompt, user_prompt)
    
    return {"feedback": response}
