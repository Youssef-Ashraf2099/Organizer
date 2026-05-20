from typing import TypedDict, Annotated, List
import operator

class AgentState(TypedDict):
    """
    Defines the data passed between LangGraph agents.
    """
    messages: Annotated[List[dict], operator.add]
    page_id: str
    task: str
    page_content: str
    context: str
    draft: str
    persona: str
    feedback: str
    revision_count: int
