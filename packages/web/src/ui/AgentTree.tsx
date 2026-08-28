import { topologicalBatches } from "../lib/dag"
import { statusLabel, statusTone } from "../lib/status"
import type { RunView } from "../state/events"
import { StatusMark } from "./StatusMark"

export function AgentTree(props: { view: RunView }) {
  const { view } = props
  if (view.phase === "idle") {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <h1 className="text-2xl font-medium tracking-tight">Run a goal</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          The planner will freeze a spec, then execute independent tasks in the same batch. Progress updates live from
          orchestrator events.
        </p>
      </div>
    )
  }

  const batches = topologicalBatches(view.tasks)
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wide text-muted">{view.phase}</p>
        <h1 className="mt-1 text-xl font-medium">{view.goal || "Untitled run"}</h1>
      </div>
      <div className="flex flex-col gap-6">
        {batches.map((batch, i) => (
          <section key={i}>
            <p className="mb-2 font-mono text-xs text-muted">
              Batch {i + 1}
              {batch.length > 1 ? " · parallel" : " · sequential"}
            </p>
            <ul className="divide-y divide-[var(--line)]">
              {batch.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusMark tone={statusTone(task.status)} />
                      <span className="text-sm font-medium">{task.title}</span>
                    </div>
                    <p className="mt-1 max-w-xl text-xs text-muted">{task.instructions}</p>
                  </div>
                  <span className="font-mono text-xs text-muted">{statusLabel(task.status)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
