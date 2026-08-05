# Self-Debugging Loop Design

## Purpose

The self-debugging loop enables the agent to recover from test failures without human intervention when possible. It combines structured reflection with bounded retries and explicit escalation criteria.

## Trigger Conditions

The loop activates when:

- The test node returns a non-zero exit code.
- A runtime exception is captured during shell execution that is classified as recoverable.
- A static analysis or lint step fails and is marked as blocking.

The loop does not activate for:

- Sandbox infrastructure failures (resource exhaustion, network policy violations).
- Explicit escalate tool calls.
- Human abort signals.

## Loop Structure

```
Test Failure
     |
     v
[Reflection Node]
     |
     +-- confidence >= threshold and should_retry == true
     |         |
     |         v
     |   [Update Plan / Inject Guidance]
     |         |
     |         v
     |   [Coder Node] --> [Tester Node]
     |         |
     |         +-- success --> exit loop
     |         +-- failure --> increment iteration
     |
     +-- confidence < threshold or should_retry == false or iteration >= max
               |
               v
         [Escalate Node]
```

## Reflection Node Behavior

Inputs:

- Current plan
- Full tool call history for the current iteration
- Latest test output (stdout, stderr, exit code)
- Previous reflection artifacts (if any)

Processing:

1. Summarize the failure surface (failing test names, error messages, stack frames).
2. Generate one or more root-cause hypotheses ranked by likelihood.
3. Select the highest-confidence hypothesis that has not been previously attempted.
4. Produce concrete proposed_changes that map to tool calls (edit_file, write_file, etc.).
5. Assign a confidence score in [0, 1].
6. Decide should_retry based on confidence and remaining budget.

Output is validated against the Reflection schema before being written to state.

## Retry Budget

Default configuration:

- max_iterations: 5
- max_reflection_tokens: 8000
- min_confidence_to_retry: 0.45

After each failed iteration the agent stores a short summary of the attempted fix to avoid repeating the same change.

## Plan Mutation Rules

The reflector may:

- Add new steps to the plan.
- Mark existing steps as completed or blocked.
- Replace the implementation notes of a step.
- Append a "correction" section that the coder must follow on the next pass.

The reflector may not:

- Delete acceptance criteria.
- Change the high-level goal of the issue.

## Escalation Criteria

Escalate when any of the following hold:

- iteration >= max_iterations
- reflector returns should_retry = false
- confidence remains below threshold for two consecutive reflections
- the same file and the same error message appear in three consecutive failures
- a human has already intervened once in the current session

On escalation the control panel receives a structured notification containing the full reflection history and the last test output.

## Observability

Every reflection produces an event:

```json
{
  "type": "reflection",
  "session_id": "...",
  "iteration": 2,
  "hypothesis": "...",
  "confidence": 0.72,
  "proposed_changes_count": 3,
  "should_retry": true
}
```

These events are stored and displayed in the Session Detail view of the control panel.

## Evaluation of the Loop

The evaluation harness measures:

- Recovery rate: percentage of initially failing runs that eventually produce a green test suite within the budget.
- Average iterations to recovery.
- False-positive reflections (reflections that claim high confidence but do not improve the next test run).
- Escalation precision (escalations that truly require human help).
