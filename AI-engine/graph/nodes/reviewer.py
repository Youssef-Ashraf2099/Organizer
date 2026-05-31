"""
reviewer.py — Reviewer node for the Omni AI LangGraph pipeline.

BUGS FIXED:
  BUG D  mode= not passed → engine used writing temperature (0.40) for a strict
         classification task (APPROVE / REJECT). Higher temperature introduces
         randomness into a binary decision that should be deterministic.
         FIX: mode="structured" → temperature=0.15, top_k=40.

  BUG E  user_prompt included full `context` (raw vector-store chunks or synthesised
         bullets — ~200-400 tokens). The reviewer only needs task + draft to decide
         whether the format is correct. Sending context:
           (a) wastes tokens — up to 400 tokens per reviewer call, 800 per revision
               cycle when revisions=2
           (b) causes the reviewer to make content judgements ("the context says X
               but the draft missed Y") instead of pure format validation.
         FIX: context removed from reviewer's user_prompt.

  BUG F  has_code_block accepted ```markdown and ```md as valid output.
         The writer should ONLY produce ```tool_command blocks for page edits.
         Accepting markdown blocks silently passes incorrect writer output,
         which then fails when the frontend tries to parse a tool_command.
         FIX: only ```tool_command is accepted as a valid edit block.
"""

import logging

from graph.state import AgentState
from llm.engine import engine
from llm.prompts import REVIEWER_PROMPT

logger = logging.getLogger(__name__)


async def reviewer_node(state: AgentState) -> dict:
    logger.info("[Reviewer] Running...")

    draft     = state.get("draft", "")
    task      = state.get("task", "").lower()
    revisions = state.get("revision_count", 0)

    # ── Programmatic pre-check (fast path — avoids a full LLM call) ───────────
    # Determines whether an LLM edit was expected based on task keywords.
    edit_keywords = {
        "write", "add", "insert", "replace", "delete", "remove",
        "create", "update", "append", "include", "put",
    }
    needs_edit = any(word in task.split() for word in edit_keywords)

    # BUG F FIX: only ```tool_command is a valid edit block.
    # ```markdown / ```md blocks indicate the model ignored instructions.
    has_tool_command = "```tool_command" in draft

    if needs_edit and not has_tool_command and revisions < 2:
        reason = (
            "REJECT: The task requires a page edit, but the response is missing "
            "the required ```tool_command JSON block. "
            "Output a ```tool_command block with insert_blocks or replace_page."
        )
        logger.warning("[Reviewer] Fast-path rejection (missing tool_command).")
        return {"feedback": reason, "revision_count": revisions + 1}

    # ── LLM review (format + quality check) ──────────────────────────────────
    # BUG E FIX: only task + draft — context deliberately excluded.
    # BUG D FIX: mode="structured" for deterministic APPROVE/REJECT classification.
    user_prompt = (
        f"Task:\n{task}\n\n"
        f"Writer's draft:\n{draft}\n\n"
        "Review the draft and reply APPROVE or REJECT: <reason>."
    )

    response = await engine.generate_response(
        system_prompt=REVIEWER_PROMPT,
        user_prompt=user_prompt,
        mode="structured",  # BUG D FIX: deterministic classifier
    )

    logger.info("[Reviewer] Decision: %s", response[:60])
    return {"feedback": response, "revision_count": revisions + 1}