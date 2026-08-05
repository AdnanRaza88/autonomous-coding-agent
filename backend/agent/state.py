from typing import Annotated, Any, Dict, List, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class PlanStep(TypedDict):
    id: str
    description: str
    files: List[str]
    tests: List[str]


class Plan(TypedDict):
    summary: str
    steps: List[PlanStep]
    risks: List[str]
    acceptance_criteria: List[str]
    estimated_complexity: str


class Reflection(TypedDict):
    hypothesis: str
    evidence: List[str]
    proposed_changes: List[Dict[str, str]]
    confidence: float
    should_retry: bool


class TestResult(TypedDict):
    exit_code: int
    stdout: str
    stderr: str
    passed: bool


class AgentState(TypedDict):
    issue: Dict[str, Any]
    plan: Optional[Plan]
    messages: Annotated[List[Any], add_messages]
    workspace_id: Optional[str]
    test_results: Optional[TestResult]
    reflection: Optional[Reflection]
    iteration: int
    max_iterations: int
    status: str
    artifacts: List[Dict[str, Any]]
    branch_name: Optional[str]
    pr_url: Optional[str]
    error: Optional[str]
