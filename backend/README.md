# Autonomous Coding Agent — Backend

Standalone FastAPI service. Deploy this folder on **Railway**, Render, Fly, or AWS.

## What it does

- Chat / issue → plan → code → GitHub branch commit → PR
- WebSocket live session events
- LLM via **Groq** (OpenAI-compatible) by default

## Env vars (Railway)

| Variable | Required | Example |
|----------|----------|---------|
| `GROQ_API_KEY` | Yes | `gsk_...` |
| `GITHUB_TOKEN` | Yes | `ghp_...` (scope: `repo`) |
| `LLM_PROVIDER` | No | `groq` (default) |
| `LLM_MODEL` | No | `llama-3.3-70b-versatile` |
| `LLM_BASE_URL` | No | `https://api.groq.com/openai/v1` |
| `CORS_ORIGINS` | Yes | your Vercel URL + localhost |
| `PORT` | Auto | Railway sets this |

## Local run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env
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

That is the only Vite API URL — it is the backend base URL.

## AWS free tier note

- EC2 t2.micro / t3.micro can run this API.
- AWS free tier is limited; Railway is simpler for this stack.
