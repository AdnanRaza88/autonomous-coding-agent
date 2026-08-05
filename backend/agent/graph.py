from typing import Literal
from langgraph.graph import StateGraph, END
from agent.state import AgentState
from agent.nodes import (
    ingest_node,
    plan_node,
    code_node,
    test_node,
    reflect_node,
    create_pr_node,
    escalate_node,
)


def route_after_test(state: AgentState) -> Literal["create_pr", "reflect", "escalate"]:
    if state.get("test_results") and state["test_results"].get("passed"):
        return "create_pr"
    if state.get("iteration", 0) >= state.get("max_iterations", 5):
        return "escalate"
    return "reflect"


def route_after_reflect(state: AgentState) -> Literal["code", "escalate"]:
    reflection = state.get("reflection")
    if reflection and reflection.get("should_retry") and reflection.get("confidence", 0) >= 0.45:
        return "code"
    return "escalate"


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("ingest", ingest_node)
    graph.add_node("plan", plan_node)
    graph.add_node("code", code_node)
    graph.add_node("test", test_node)
    graph.add_node("reflect", reflect_node)
    graph.add_node("create_pr", create_pr_node)
    graph.add_node("escalate", escalate_node)

    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "plan")
    graph.add_edge("plan", "code")
    graph.add_edge("code", "test")
    graph.add_conditional_edges("test", route_after_test)
    graph.add_conditional_edges("reflect", route_after_reflect)
    graph.add_edge("create_pr", END)
    graph.add_edge("escalate", END)

    return graph.compile()
