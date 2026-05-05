from graph.state import AgentState
from Memory.vector_store import vector_store

async def researcher_node(state: AgentState):
    print("Researcher node running...")
    
    page_id = state.get("page_id")
    task = state.get("task", "")
    
    if not page_id:
        return {"context": "No page ID provided for context retrieval."}
        
    try:
        results = await vector_store.query_context(page_id, query_texts=[task], n_results=3)
        
        # Format results into a context string
        context = ""
        if results and results.get("documents") and len(results["documents"]) > 0:
            for idx, doc_list in enumerate(results["documents"]):
                for doc in doc_list:
                    context += f"- {doc}\n"
        
        if not context:
            context = "No relevant context found in vector store."
            
        return {"context": context}
    except Exception as e:
        print(f"Error in researcher node: {e}")
        return {"context": f"Failed to retrieve context: {str(e)}"}
