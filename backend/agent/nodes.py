from typing import Any, Dict
from agent.state import AgentState


async def ingest_node(state: AgentState) -> Dict[str, Any]:
    return {
        "status": "planning",
        "iteration": 0,
        "max_iterations": state.get("max_iterations", 5),
        "artifacts": [],
        "error": None,
    }


async def plan_node(state: AgentState) -> Dict[str, Any]:
    plan = {
        "summary": "Implement the requested changes from the issue.",
        "steps": [
            {
                "id": "1",
                "description": "Explore repository structure and locate relevant files.",
                "files": [],
                "tests": [],
            },
            {
                "id": "2",
                "description": "Implement the required changes.",
                "files": [],
                "tests": [],
            },
            {
                "id": "3",
                "description": "Run tests and verify acceptance criteria.",
                "files": [],
                "tests": [],
            },
        ],
        "risks": [],
        "acceptance_criteria": [],
        "estimated_complexity": "medium",
    }
    return {
        "plan": plan,
        "status": "coding",
    }


async def code_node(state: AgentState) -> Dict[str, Any]:
    return {
        "status": "testing",
        "iteration": state.get("iteration", 0) + 1,
    }


async def test_node(state: AgentState) -> Dict[str, Any]:
    test_results = {
        "exit_code": 0,
        "stdout": "All tests passed.",
        "stderr": "",
        "passed": True,
    }
    return {
        "test_results": test_results,
        "status": "pr_ready" if test_results["passed"] else "reflecting",
    }


async def reflect_node(state: AgentState) -> Dict[str, Any]:
    reflection = {
        "hypothesis": "Previous change did not fully address the failure.",
        "evidence": [],
        "proposed_changes": [],
        "confidence": 0.6,
        "should_retry": True,
    }
    return {
        "reflection": reflection,
        "status": "coding",
    }


async def create_pr_node(state: AgentState) -> Dict[str, Any]:
    return {
        "status": "completed",
        "pr_url": None,
    }


async def escalate_node(state: AgentState) -> Dict[str, Any]:
    return {
        "status": "failed",
        "error": "Escalated after exhausting retry budget or low confidence.",
    }
