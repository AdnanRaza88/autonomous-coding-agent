# Autonomous Coding Agent

Devin-style autonomous coding agent that turns GitHub issues into tested pull requests.

**Pipeline:** Issue → Plan → Code → Test → Reflect & Self-Correct → PR

**Backend:** LangGraph + Docker sandbox + GitHub API  
**Frontend:** Professional light-theme control panel

## Status

| Layer | Status |
|-------|--------|
| Product docs (PRD, architecture, tools, sandbox, metrics) | Complete |
| Backend skeleton (LangGraph graph, nodes, FastAPI, sandbox manager) | Complete (stubs) |
| Frontend control panel (6 pages, single design system) | Complete (UI + mock data) |
| Real LLM / Docker / GitHub webhook wiring | Not yet (needs API keys + infra) |
| Figma design file | Started (Dashboard) |

## Repository Structure

```
docs/           Product and engineering docs
backend/
  agent/        LangGraph state, graph, nodes, FastAPI entry
  sandbox/      Docker sandbox manager
  tools/        Tool implementations (to expand)
frontend/
  src/
    pages/      Dashboard, Sessions, Session Detail, Settings, Evaluation, History
    styles/     Design tokens + layout (single Clean SaaS system)
```

## Design System (Single Style)

One consistent visual language only: **Clean Soft SaaS**.

- Light theme only
- White elevated cards with subtle border and soft shadow
- Clear hierarchy, generous spacing
- Rounded controls (12px buttons, 16px cards, pill badges)
- Primary accent: blue `#2563EB`
- No neumorphism, no claymorphism, no heavy glass stacks

### Tokens

| Token | Value | Role |
|-------|-------|------|
| --bg-base | #F4F6F9 | Page background |
| --bg-surface | #FFFFFF | Cards, nav |
| --border | #E2E8F0 | Default borders |
| --text-primary | #0F172A | Headings and body |
| --text-secondary | #64748B | Meta and labels |
| --accent | #2563EB | Primary actions |
| --shadow-sm | 0 1px 2px rgba(15,23,42,0.05) | Card elevation |

### Components

- `.card` — surface with border + light shadow
- `.btn` / `.btn-primary` — standard and primary buttons
- `.badge` + status variants — status pills
- `.metric-tile` — KPI blocks
- `.input` — form fields with focus ring

### Pages

1. Dashboard — KPIs + activity
2. Active Sessions — session list with status
3. Session Detail — plan, tests, event stream, actions
4. Repository Settings — repo allow-list and policies
5. Evaluation — suite metrics
6. History — searchable archive

Figma (reference): https://www.figma.com/design/jMMcvPdKO8KWJ5iNwJ0Hur  
Frontend CSS implements the same Clean Soft SaaS language so UI matches the intended product look.

## Quick Start

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn agent.main:app --reload --app-dir .

# Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 for the control panel. API health: http://localhost:8000/health

## Validation Checklist

- [x] All core docs present under `docs/`
- [x] LangGraph graph with plan → code → test → reflect → PR/escalate
- [x] FastAPI session + WebSocket stubs
- [x] Frontend builds with single design system (no mixed morphisms)
- [x] Six control-panel pages routed and styled consistently
- [ ] Live model + real sandbox (requires secrets and Docker host)
- [ ] GitHub App webhook + PR creation end-to-end

## License

Proprietary. All rights reserved.
