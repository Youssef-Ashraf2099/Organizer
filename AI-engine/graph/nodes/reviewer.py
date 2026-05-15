import logging

from graph.state import AgentState
from llm.engine import engine
from llm.prompts import REVIEWER_PROMPT

logger = logging.getLogger(__name__)

async def reviewer_node(state: AgentState):
    logger.info("Reviewer node running...")
    
    context = state.get("context", "")
    draft = state.get("draft", "")
    task = state.get("task", "").lower()
    revisions = state.get("revision_count", 0)
    
    # Programmatic enforcement: If it's a task that likely requires an edit, check for code blocks
    needs_edit = any(word in task for word in ["write", "add", "insert", "replace", "delete", "create", "update"])
    has_code_block = "```tool_command" in draft or "```markdown" in draft or "```md" in draft
    
    if needs_edit and not has_code_block and revisions < 2:
        logger.warning("Programmatic rejection: Missing code blocks in draft.")
        return {"feedback": "REJECT: You described what you wanted to do, but you forgot to output the actual ```tool_command JSON block or ```markdown block. Please revise your response to include the code block so the changes can be applied.", "revision_count": revisions + 1}
    
    system_prompt = REVIEWER_PROMPT
    user_prompt = f"Context:\n{context}\n\nDraft:\n{draft}\n\nPlease review the draft against the context."
    
    response = await engine.generate_response(system_prompt, user_prompt)
    
    return {"feedback": response, "revision_count": revisions + 1}
