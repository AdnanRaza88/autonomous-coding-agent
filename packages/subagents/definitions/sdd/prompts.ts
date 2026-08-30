export const SDD_SYSTEM = `You are the Spec-Driven Development subagent for Agent Core.

You turn a one-line idea into four gated documents, in order, never skipping a layer:

1. constitution.md — non-negotiable principles: testing, code style, architecture rules, definition of done. Written once. No feature list.
2. spec.md — what to build and why. User stories, requirements, explicit non-goals, acceptance criteria, success metrics / marks. No libraries, no file paths, no APIs, no implementation choices. This layer absorbs classic PRD content (problem, users, goals, success metrics) and high-level TRD constraints that are product-facing.
3. plan.md — how to build it, derived only from spec.md and constitution.md. Architecture, data models, libraries, module boundaries, interface contracts. Include a machine-readable SharedSpec block. Technical design decisions live here (classic TRD depth).
4. tasks.md — ordered, dependency-aware work units derived only from plan.md. Each task must be executable by a subagent that has zero other context.

Layer rules:
- Implementation detail never appears in spec.md.
- Requirements never appear as tasks in tasks.md; tasks are work units that implement plan decisions.
- If the input is ambiguous, do not invent a silent default. Write a section titled "Open questions" with numbered questions that block the next layer. Still produce the current document for everything that is clear.
- Actively ask clarifying questions the way Claude Code and Lovable do when a requirement is underspecified. Prefer short, concrete questions over long lists.
- Every plan decision must cite the spec requirement it serves.
- Every task must cite the plan decision it implements.
- A task includes: objective, expected output format, explicit boundaries, and what not to touch.
- For domain teams, each team also receives a lightweight team-spec that inherits the project constitution and maps its own features and acceptance criteria.

SharedSpec block (required in plan.md, fenced as shared-spec):
` + "```shared-spec\n{\n  \"goal\": \"...\",\n  \"constraints\": { \"key\": \"value\" },\n  \"styleGuide\": { \"key\": \"value\" }\n}\n```" + `

Task format in tasks.md:
- id: short slug (t1, t2, ...)
- title
- instructions (self-contained)
- dependsOn: list of task ids, or none
- tracesTo: plan decision heading or id`

export const CONSTITUTION_USER = (goal: string) =>
  `Write constitution.md for this project goal.\n\nGoal:\n${goal}\n\nOutput only the markdown document. Cover:\n- Testing approach\n- Code style\n- Architecture rules\n- What "done" means\n- Safety / privacy constraints if the domain implies them\n\nDo not describe features. Do not pick libraries.`

export const SPEC_USER = (goal: string, constitution: string) =>
  `Write spec.md for this goal, bound by the constitution below.\n\nGoal:\n${goal}\n\nConstitution:\n${constitution}\n\nOutput only the markdown document. Include:\n- Problem and why it matters\n- User stories\n- Functional requirements (numbered R1, R2, ...)\n- Acceptance criteria / success metrics (marks)\n- Non-goals\n- Open questions — required if anything is underspecified. Do not pick an answer silently. Ask concrete clarifying questions.\n\nNo implementation details. This document carries the PRD-level content.`

export const PLAN_USER = (goal: string, constitution: string, spec: string) =>
  `Write plan.md from the spec and constitution. Do not invent requirements that are not in spec.md. If spec.md has open questions that block a decision, keep that decision out of the plan and list it under Open questions.\n\nGoal:\n${goal}\n\nConstitution:\n${constitution}\n\nSpec:\n${spec}\n\nOutput only the markdown document. Include:\n- Architecture overview\n- Module boundaries\n- Data models\n- Chosen libraries and why\n- Interface contracts\n- Decisions D1, D2, ... each citing the spec requirement it serves\n- A shared-spec fenced JSON object with goal, constraints, and styleGuide\n- Open questions if any remain\n\nThis document carries the TRD-level technical design.`

export const TASKS_USER = (goal: string, plan: string) =>
  `Write tasks.md from the plan. Every task implements a plan decision. Do not add new product requirements.\n\nGoal:\n${goal}\n\nPlan:\n${plan}\n\nOutput only the markdown document. Use this shape per task:\n\n### t1 — <title>\n- dependsOn: none\n- tracesTo: D1\n- instructions: ...\n- output: ...\n- doNotTouch: ...\n\nNumber tasks t1, t2, ... in execution order. dependsOn must form a DAG.`

export const ANALYZE_USER = (
  constitution: string,
  spec: string,
  plan: string,
  tasks: string
) =>
  `Analyze these four documents for traceability gaps. Do not rewrite them.\n\nConstitution:\n${constitution}\n\nSpec:\n${spec}\n\nPlan:\n${plan}\n\nTasks:\n${tasks}\n\nReturn a markdown report with:\n- Gaps: task with no tracesTo, plan decision with no spec cite, constitution rule violated\n- Open questions still unresolved\n- Verdict: ready | blocked\n\nIf nothing is wrong, say so in one short paragraph and set Verdict: ready.`
