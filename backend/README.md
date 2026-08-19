# Autonomous Coding Agent — Backend

Standalone FastAPI service. Deploy this folder on **Railway**, Render, Fly, or AWS.

## What it does

- Chat / issue → plan → code → GitHub branch commit → PR
- WebSocket live session events
- **Free-tier multi-provider LLM router** (simple Omni-inspired fallback)

## Free-tier LLM Router

File: `agent/llm_router.py`

You can add multiple free API keys. The router tries them in priority order and automatically falls back if one hits rate-limit or fails.

Supported out of the box:
- Groq (fast free)
- Cerebras (large daily free)
- DeepSeek (free credits)
- OpenAI (if you still have free credits)
- Any custom OpenAI-compatible endpoint (including local OmniRoute)

### How to use in nodes

```python
from agent.llm_router import get_router

router = get_router()
result = await router.chat([
    {"role": "system", "content": "You are a senior coding agent."},
    {"role": "user", "content": "Write a plan for this issue..."},
])
print(result["content"])
print("Used provider:", result["provider"])
```

### Env vars (Railway / local)

| Variable | Required | Example |
|----------|----------|---------|
| `GROQ_API_KEY` | Recommended | `gsk_...` |
| `CEREBRAS_API_KEY` | Optional | free key from cerebras.ai |
| `DEEPSEEK_API_KEY` | Optional | free key from platform.deepseek.com |
| `OPENAI_API_KEY` | Optional | if you have free credits |
| `LLM_BASE_URL` | Optional | `http://localhost:20128/v1` (if using OmniRoute) |
| `GITHUB_TOKEN` | Yes | `ghp_...` (scope: `repo`) |
| `CORS_ORIGINS` | Yes | your Vercel URL + localhost |
| `PORT` | Auto | Railway sets this |

## Local run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and put your free keys
uvicorn agent.main:app --host 0.0.0.0 --port 8000
```

Health: `GET /health`

## Railway deploy

1. New project → Deploy from GitHub repo
2. **Root directory:** `backend`
3. Add env vars from table above
4. Start command (if needed): `uvicorn agent.main:app --host 0.0.0.0 --port $PORT`
5. Copy public URL, e.g. `https://xxx.up.railway.app`

## Frontend connection

Set on Vercel / local frontend:

```
VITE_API_URL=https://YOUR-RAILWAY-URL
```
