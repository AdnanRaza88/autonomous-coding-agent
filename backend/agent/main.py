from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, Optional
from agent.graph import build_graph
from agent.state import AgentState

app = FastAPI(title="Autonomous Coding Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graph = build_graph()


class StartSessionRequest(BaseModel):
    issue: Dict[str, Any]
    max_iterations: int = 5
    repository: str


class SessionResponse(BaseModel):
    session_id: str
    status: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/sessions", response_model=SessionResponse)
async def start_session(req: StartSessionRequest):
    initial_state: AgentState = {
        "issue": req.issue,
        "plan": None,
        "messages": [],
        "workspace_id": None,
        "test_results": None,
        "reflection": None,
        "iteration": 0,
        "max_iterations": req.max_iterations,
        "status": "planning",
        "artifacts": [],
        "branch_name": None,
        "pr_url": None,
        "error": None,
    }
    result = await graph.ainvoke(initial_state)
    return SessionResponse(
        session_id=result.get("workspace_id") or "session-placeholder",
        status=result.get("status", "unknown"),
    )


@app.websocket("/ws/sessions/{session_id}")
async def session_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    await websocket.send_json({"type": "connected", "session_id": session_id})
    await websocket.close()
