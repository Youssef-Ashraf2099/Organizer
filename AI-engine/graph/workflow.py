from langgraph.graph import StateGraph, END
from graph.state import AgentState

# Stub functions for nodes
def researcher_node(state: AgentState):
    print("Researcher node running...")
    # TODO: Query ChromaDB for facts
    return {"context": "Gathered facts from ChromaDB based on task."}

def writer_node(state: AgentState):
    print("Writer node running...")
    # TODO: Generate draft using LLM + Persona + Context
    return {"draft": "This is the drafted content."}

def reviewer_node(state: AgentState):
    print("Reviewer node running...")
    # TODO: Check draft against context to prevent hallucinations
    return {"feedback": "Draft looks good, no hallucinations."}

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
