from langgraph.graph import StateGraph, END
from graph.state import AgentState
from graph.nodes.researcher import researcher_node
from graph.nodes.writer import writer_node
from graph.nodes.reviewer import reviewer_node

# Build Graph
workflow = StateGraph(AgentState)

workflow.add_node("researcher", researcher_node)
workflow.add_node("writer", writer_node)
workflow.add_node("reviewer", reviewer_node)

workflow.set_entry_point("researcher")
workflow.add_edge("researcher", "writer")
workflow.add_edge("writer", "reviewer")
workflow.add_edge("reviewer", END)

app_graph = workflow.compile()
