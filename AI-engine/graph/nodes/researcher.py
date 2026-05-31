"""
researcher.py — Researcher node for the Omni AI LangGraph pipeline.

BUG FIXED: RESEARCHER_PROMPT was defined in prompts.py but this node never called
the LLM at all. Raw vector-store chunks were passed directly to the Writer, which
produced noisy, inconsistent context. The Writer then had to interpret potentially
garbled chunks instead of clean bullet points — contributing to incomplete output.

FIX: After querying the vector store, call engine.generate_response() with
RESEARCHER_PROMPT to synthesize the chunks into 3-5 clean, task-relevant facts.
Use mode="writing" — this is a summarisation task, not JSON output.

LLM call is skipped when:
  - No vector-store results (returns raw fallback message, avoids wasted call)
  - Vector store query fails (logs error, returns safe fallback)
"""

import logging

from graph.state import AgentState
from llm.engine import engine
from llm.prompts import RESEARCHER_PROMPT
from Memory.vector_store import vector_store

logger = logging.getLogger(__name__)


async def researcher_node(state: AgentState) -> dict:
    logger.info("[Researcher] Running...")

    page_id = state.get("page_id")
    task    = state.get("task", "")

    if not page_id:
        logger.warning("[Researcher] No page_id — skipping vector store query.")
        return {"context": "No page context available."}

    # ── 1. Query vector store ─────────────────────────────────────────────────
    try:
        results = await vector_store.query_context(
            page_id, query_texts=[task], n_results=3
        )
    except Exception as exc:
        logger.error("[Researcher] Vector store error: %s", exc)
        return {"context": f"Context retrieval failed: {exc}"}

    # Flatten document lists into a single raw string
    raw_chunks: list[str] = []
    if results and results.get("documents"):
        for doc_list in results["documents"]:
            for doc in doc_list:
                if doc and doc.strip():
                    raw_chunks.append(doc.strip())

    if not raw_chunks:
        logger.info("[Researcher] No relevant chunks found in vector store.")
        return {"context": "No relevant context found for this page."}

    raw_text = "\n".join(f"- {chunk}" for chunk in raw_chunks)
    logger.debug("[Researcher] Retrieved %d chunks, synthesising...", len(raw_chunks))

    # ── 2. Synthesise chunks with LLM (BUG FIX — was completely missing) ─────
    # mode="writing" → temperature=0.40, top_k=80
    # This is a summarisation task; we want natural, thorough bullet points.
    user_prompt = (
        f"Task the user wants to accomplish:\n{task}\n\n"
        f"Retrieved document chunks:\n{raw_text}\n\n"
        "Summarise the 3-5 most relevant facts as bullet points."
    )

    try:
        context = await engine.generate_response(
            system_prompt=RESEARCHER_PROMPT,
            user_prompt=user_prompt,
            mode="writing",
        )
        logger.info("[Researcher] Synthesised context (%d chars).", len(context))
    except Exception as exc:
        logger.error("[Researcher] LLM synthesis failed: %s", exc)
        # Fall back to raw chunks so the Writer still has something to work with
        context = raw_text

    return {"context": context}