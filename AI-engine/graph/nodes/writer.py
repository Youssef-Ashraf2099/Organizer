"""
writer.py — Writer node for the Omni AI LangGraph pipeline.

BUGS FIXED:
  BUG A  _MAX_PAGE_CHARS = 800  ← THE PRIMARY CAUSE of "stingy / missing items".
         800 chars ≈ 200 tokens. A page with 6 bullet points is already ~400 chars.
         At 800 chars the model was seeing a TRUNCATED page — it had no idea GPU
         was missing because it couldn't even see the existing list properly.

         With n_ctx=8192, max_tokens=3072, the prompt budget is ~4864 tokens.
         Deduct system (~280 tokens) + tools (~200 tokens) + context (~300 tokens)
         + task (~60 tokens) + feedback (~120 tokens) = ~960 tokens overhead.
         That leaves ~3904 tokens = ~15 600 chars for page_content.
         We set _MAX_PAGE_CHARS = 5000 (a conservative ~1250 tokens) — 6× the
         original, still well within budget.

  BUG B  mode= not passed → engine defaulted to "auto" which resolves to
         "writing" (correct), but it was implicit and fragile. Now explicit.

  BUG C  Inline rules at the bottom of system_prompt duplicated WRITER_PROMPT.
         Duplicate instructions confuse small models (they treat them as two
         conflicting rule sets and average them). Removed the redundant block.
"""

import logging

from graph.state import AgentState
from llm.engine import engine
from llm.prompts import WRITER_PROMPT
from tools.tool_registry import get_tools_prompt

logger = logging.getLogger(__name__)

# BUG A FIX: 800 → 5000.
# Why 5000 and not higher?
#   • 5000 chars ≈ 1250 tokens — safe, well within the ~3900 token page budget.
#   • We keep a margin in case page content is token-dense (code blocks, tables).
#   • The engine's _trim_prompt_if_needed() is the hard backstop if this is
#     ever exceeded.
# To increase further: set AI_MAX_PAGE_CHARS env var or raise the constant.
_MAX_PAGE_CHARS = int(__import__("os").getenv("AI_MAX_PAGE_CHARS", "5000"))


def _trim_page(content: str) -> str:
    """
    Trim page content to _MAX_PAGE_CHARS, breaking on a word boundary.
    Appends a visible marker so the model knows the page continues.
    """
    if not content or len(content) <= _MAX_PAGE_CHARS:
        return content

    trimmed   = content[:_MAX_PAGE_CHARS]
    last_nl   = trimmed.rfind("\n")
    last_sp   = trimmed.rfind(" ")
    cut_at    = max(last_nl, last_sp)
    if cut_at > _MAX_PAGE_CHARS // 2:
        trimmed = trimmed[:cut_at]

    return trimmed + "\n[...page trimmed — more content exists below...]"


async def writer_node(state: AgentState) -> dict:
    logger.info("[Writer] Running...")

    context      = state.get("context", "")
    task         = state.get("task", "")
    persona      = state.get("persona", "General Assistant")
    page_content = _trim_page(state.get("page_content", ""))

    # ── System prompt ─────────────────────────────────────────────────────────
    # WRITER_PROMPT  + persona + tool schema.
    # BUG C FIX: No duplicate rules block appended here — they are in WRITER_PROMPT.
    system_prompt = (
        f"{WRITER_PROMPT}\n\n"
        f"Persona: {persona}\n\n"
        f"{get_tools_prompt()}"
    )

    # ── User prompt ───────────────────────────────────────────────────────────
    page_section = (
        f"=== CURRENT PAGE ===\n{page_content}\n=== END PAGE ==="
        if page_content
        else "(Page is currently empty.)"
    )

    user_prompt = (
        f"{page_section}\n\n"
        f"Relevant context:\n{context}\n\n"
        f"Task:\n{task}"
    )

    feedback = state.get("feedback", "")
    if feedback and "APPROVE" not in feedback.upper():
        user_prompt += (
            f"\n\nReviewer feedback (must be addressed):\n{feedback}\n"
            "Revise your response to fix the issue above."
        )

    logger.debug(
        "[Writer] prompt sizes — page=%d chars, context=%d chars, task=%d chars",
        len(page_content), len(context), len(task),
    )

    # BUG B FIX: explicit mode="writing" → temp=0.40, top_k=80
    response = await engine.generate_response(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        mode="writing",
    )

    logger.info("[Writer] Draft produced (%d chars).", len(response))
    return {"draft": response}