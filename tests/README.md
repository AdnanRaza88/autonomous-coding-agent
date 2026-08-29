# Integration tests

Cross-package checks from module 07. Each test talks only to public package APIs.

## Cases

1. Orchestrator end-to-end: plan a two-task DAG, assert independent work overlaps, force a verifier miss and confirm retry.
2. Provider swap: Groq and a local OpenAI-compatible config resolve to the same adapter class and walk the same run path.
3. Custom subagent: register a definition, run it, assert the custom system prompt reached the model.
4. MCP round-trip: mock server + slash command; the permission gate fires before the tool.
5. Docker smoke: assert the image definition is complete; if a daemon is present, build and hit `/health`.

## Run

```
npm install
npm run test:integration
```

Or from this folder after a workspace install:

```
npx tsx --test graph.test.ts providers.test.ts subagents.test.ts mcp.test.ts docker.test.ts
```
