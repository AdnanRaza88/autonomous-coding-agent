from typing import Optional, Dict, Any
import uuid


class SandboxManager:
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}

    async def allocate(self, language: str = "python") -> str:
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "language": language,
            "container_id": None,
            "status": "allocated",
        }
        return session_id

    async def execute(self, session_id: str, command: str, timeout: int = 120) -> Dict[str, Any]:
        if session_id not in self.sessions:
            return {"exit_code": 1, "stdout": "", "stderr": "Session not found"}
        return {
            "exit_code": 0,
            "stdout": f"Executed: {command}",
            "stderr": "",
        }

    async def teardown(self, session_id: str) -> None:
        if session_id in self.sessions:
            del self.sessions[session_id]

    async def get_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self.sessions.get(session_id)
