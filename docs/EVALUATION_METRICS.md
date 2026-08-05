# Evaluation Metrics

## Purpose

A continuous evaluation suite measures the reliability, efficiency, and cost of the autonomous coding agent. Results drive model selection, prompt improvements, and product prioritization.

## Evaluation Suite Composition

The suite contains curated GitHub issues drawn from open-source repositories and synthetic tasks. Each task includes:

- Issue title and body
- Expected acceptance criteria
- Gold-standard PR description (for reference, not for scoring)
- Language and framework tags
- Difficulty label (easy, medium, hard)

Tasks are versioned. New tasks are added only after human review.

## Primary Metrics

### End-to-End Success Rate
Percentage of tasks for which the agent opens a PR that:

- Passes the repository test suite
- Satisfies the acceptance criteria as judged by an automated checker or human labeler
- Requires no more than one human intervention

### Recovery Rate
Among tasks that fail the first test run, the percentage that eventually succeed within the self-debugging budget.

### Average Iterations to Success
Mean number of code-test-reflect cycles required for successful tasks.

### Human Intervention Rate
Percentage of tasks that required at least one human action (plan approval, guidance injection, or abort).

### Time to PR
Median wall-clock time from issue ingestion to PR creation for successful tasks.

### Token and Cost Efficiency
- Median input and output tokens per successful task
- Estimated dollar cost per successful task (model + sandbox)

### Reflection Quality
- Average confidence of reflections that led to a successful next iteration
- False-positive rate of high-confidence reflections that did not improve the subsequent test result

## Secondary Metrics

- Sandbox allocation latency
- Tool-call error rate
- Percentage of escalations that were later resolved by a human with a minor edit (over-escalation)
- PR description quality (length, presence of test evidence, link to issue)

## Evaluation Harness

The harness runs on a schedule and on every major model or prompt change.

Execution flow:

1. For each task create a clean sandbox and a fresh LangGraph run.
2. Disable human interaction except for the explicit escalate path.
3. Record every state transition and tool call.
4. After terminal status, run automated validators:
   - Test suite green
   - Diff size within expected bounds
   - Required files present
5. Store results in a structured database.
6. Publish a dashboard snapshot and a regression alert if primary metrics degrade beyond a threshold.

## Regression Gates

A change is blocked from promotion if any of the following hold on the full suite:

- End-to-end success rate drops more than 5 absolute points
- Recovery rate drops more than 8 absolute points
- Average cost per success increases more than 25 percent
- Human intervention rate increases more than 10 absolute points

## Reporting

Weekly automated report includes:

- Metric trends over the last 30 days
- Per-language and per-difficulty breakdowns
- Top failure modes with example session links
- Recommended prompt or tool adjustments

## Future Extensions

- Multi-file and multi-PR tasks
- Long-horizon tasks that require planning across multiple sessions
- Adversarial tasks designed to trigger infinite loops or resource exhaustion
- Human preference scores for plan and PR quality
