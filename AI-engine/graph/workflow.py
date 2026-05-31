"""
workflow.py — LangGraph pipeline definition for the Omni AI Agent.

The revision budget stays intentionally small so the agent converges quickly
even when the backend is remote.
"""

import os
from langgraph.graph import StateGraph, END

from graph.state import AgentState
from graph.nodes.researcher import researcher_node
from graph.nodes.writer import writer_node
from graph.nodes.reviewer import reviewer_node

_MAX_REVISIONS = int(os.getenv("AI_MAX_REVISIONS", "1"))  # was hardcoded 2


def should_continue(state: AgentState) -> str:
    feedback  = state.get("feedback", "")
    revisions = state.get("revision_count", 0)

    if "APPROVE" in feedback.upper() or revisions >= _MAX_REVISIONS:
        return "end"
    return "continue"


# ── Build graph ───────────────────────────────────────────────────────────────
workflow = StateGraph(AgentState)

workflow.add_node("researcher", researcher_node)
workflow.add_node("writer",     writer_node)
workflow.add_node("reviewer",   reviewer_node)

workflow.set_entry_point("researcher")
workflow.add_edge("researcher", "writer")
workflow.add_edge("writer",     "reviewer")

workflow.add_conditional_edges(
    "reviewer",
    should_continue,
    {
        "continue": "writer",   # writer sees Reviewer feedback in state["feedback"]
        "end":      END,
    },
)

app_graph = workflow.compile()