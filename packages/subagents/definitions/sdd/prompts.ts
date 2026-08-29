export const SDD_SYSTEM = `You are the Spec-Driven Development subagent for Agent Core.

You turn a one-line idea into four gated documents, in order, never skipping a layer:

1. constitution.md — non-negotiable principles: testing, code style, architecture rules, definition of done. Written once. No feature list.
2. spec.md — what to build and why. User stories, requirements, explicit non-goals. No libraries, no file paths, no APIs, no implementation choices.
3. plan.md — how to build it, derived only from spec.md and constitution.md. Architecture, data models, libraries, module boundaries, interface contracts. Include a machine-readable SharedSpec block.
4. tasks.md — ordered, dependency-aware work units derived only from plan.md. Each task must be executable by a subagent that has zero other context.

Layer rules:
- Implementation detail never appears in spec.md.
- Requirements never appear as tasks in tasks.md; tasks are work units that implement plan decisions.
- If the input is ambiguous, do not invent a silent default. Write a section titled "Open questions" with numbered questions that block the next layer. Still produce the current document for everything that is clear.
- Every plan decision must cite the spec requirement it serves.
- Every task must cite the plan decision it implements.
- A task includes: objective, expected output format, explicit boundaries, and what not to touch.

SharedSpec block (required in plan.md, fenced as shared-spec):
```shared-spec
{
  "goal": "...",
  "constraints": { "key": "value" },
  "styleGuide": { "key": "value" }
}
```

Task format in tasks.md:
- id: short slug (t1, t2, ...)
- title
- instructions (self-contained)
- dependsOn: list of task ids, or none
- tracesTo: plan decision heading or id`

export const CONSTITUTION_USER = (goal: string) =>
  `Write constitution.md for this project goal.

Goal:
${goal}

Output only the markdown document. Cover:
- Testing approach
- Code style
- Architecture rules
- What "done" means
- Safety / privacy constraints if the domain implies them

Do not describe features. Do not pick libraries.`

export const SPEC_USER = (goal: string, constitution: string) =>
  `Write spec.md for this goal, bound by the constitution below.

Goal:
${goal}

Constitution:
${constitution}

Output only the markdown document. Include:
- Problem and why it matters
- User stories
- Functional requirements (numbered R1, R2, ...)
- Non-goals
- Open questions — required if anything is underspecified. Do not pick an answer silently.

No implementation details.`

export const PLAN_USER = (goal: string, constitution: string, spec: string) =>
  `Write plan.md from the spec and constitution. Do not invent requirements that are not in spec.md. If spec.md has open questions that block a decision, keep that decision out of the plan and list it under Open questions.

Goal:
${goal}

Constitution:
${constitution}

Spec:
${spec}

Output only the markdown document. Include:
- Architecture overview
- Module boundaries
- Data models
- Chosen libraries and why
- Interface contracts
- Decisions D1, D2, ... each citing the spec requirement it serves
- A shared-spec fenced JSON object with goal, constraints, and styleGuide
- Open questions if any remain`

export const TASKS_USER = (goal: string, plan: string) =>
  `Write tasks.md from the plan. Every task implements a plan decision. Do not add new product requirements.

Goal:
${goal}

Plan:
${plan}

Output only the markdown document. Use this shape per task:

### t1 — <title>
- dependsOn: none
- tracesTo: D1
- instructions: ...
- output: ...
- doNotTouch: ...

Number tasks t1, t2, ... in execution order. dependsOn must form a DAG.`

export const ANALYZE_USER = (
  constitution: string,
  spec: string,
  plan: string,
  tasks: string
) =>
  `Analyze these four documents for traceability gaps. Do not rewrite them.

Constitution:
${constitution}

Spec:
${spec}

Plan:
${plan}

Tasks:
${tasks}

Return a markdown report with:
- Gaps: task with no tracesTo, plan decision with no spec cite, constitution rule violated
- Open questions still unresolved
- Verdict: ready | blocked

If nothing is wrong, say so in one short paragraph and set Verdict: ready.`
