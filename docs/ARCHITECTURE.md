# Agent Architecture

## System Overview

The Autonomous Coding Agent is built on LangGraph for stateful orchestration, Docker for execution isolation, and the GitHub API for issue and pull-request lifecycle management. A React-based control panel provides observability and human control.

```
GitHub Issue
     |
     v
[Ingestion Service] -----> [LangGraph Orchestrator]
                               |
          +--------------------+--------------------+
          |                    |                    |
          v                    v                    v
     [Planner Node]      [Coder Node]         [Tester Node]
          |                    |                    |
          +--------------------+--------------------+
                               |
                               v
                     [Reflection / Self-Correction]
                               |
                               v
                        [PR Creator Node]
                               |
                               v
                          GitHub PR
```

## LangGraph Graph Structure

State is a typed dictionary containing:

- issue: raw GitHub issue payload
- plan: structured plan object
- messages: conversation history and tool results
- workspace: sandbox session identifier and mount paths
- test_results: latest test output and status
- reflection: last reflection artifact
- iteration: current retry count
- status: enum (planning, coding, testing, reflecting, pr_ready, failed, completed)
- artifacts: list of generated files and diffs

Nodes:

1. ingest
2. plan
3. code
4. test
5. reflect
6. create_pr
7. escalate

Edges are conditional:

- plan -> code (always, or after human approval)
- code -> test
- test -> create_pr (on success)
- test -> reflect (on failure and iteration < max)
- reflect -> code
- reflect -> escalate (on budget exhaustion)
- any node -> escalate (on unrecoverable error)

## Component Responsibilities

### Orchestrator (LangGraph)
- Maintains durable state.
- Routes between nodes based on status and test outcomes.
- Enforces retry budgets and timeouts.
- Emits structured events for the control panel.

### Planner
- Uses a strong reasoning model.
- Outputs a validated plan conforming to the Plan schema.
- May call repository exploration tools before finalizing the plan.

### Coder
- Receives the current plan and previous reflection (if any).
- Invokes tools: read_file, write_file, search_code, run_shell, git_status, git_diff.
- All mutations occur inside the active sandbox.

### Tester
- Executes the test command defined in the plan or repository configuration.
- Captures stdout, stderr, exit code, and coverage if available.
- Updates test_results in state.

### Reflector
- Analyzes the failure against the plan and recent tool history.
- Produces a Reflection object containing hypothesis, proposed_changes, and confidence.
- Updates the plan or injects corrective instructions for the next coding step.

### PR Creator
- Commits changes on a feature branch.
- Pushes the branch.
- Opens a pull request with a generated body that includes the plan summary, test evidence, and reflection history.

### Sandbox Manager
- Allocates a container from a warm pool or creates on demand.
- Injects the repository clone, environment variables, and secrets under policy.
- Enforces resource limits and network policy.
- Tears down or snapshots after session completion.

### Control Plane API
- REST + WebSocket endpoints for session lifecycle, live logs, plan approval, and manual overrides.
- Authentication via GitHub App or OAuth.

## Data Flow

1. GitHub webhook delivers issue labeled `agent`.
2. Ingestion creates a new LangGraph run with initial state.
3. Graph executes until terminal status.
4. Events are streamed to the control panel and persisted.
5. On success a PR is opened and the session is archived.

## Failure Modes and Recovery

- Sandbox OOM or timeout: mark iteration failed, attempt clean restart or escalate.
- Model refusal or malformed tool call: retry with stricter prompting up to three times.
- Git conflict: attempt rebase; on failure escalate with conflict details.
- Network policy violation: log and escalate.

## Extensibility

- New tools are registered via a tool registry that exposes OpenAI-compatible function schemas.
- New languages are supported by adding sandbox base images and language-specific test runners.
- Alternative planners or reflectors can be swapped by changing the node implementation while keeping the state contract.
