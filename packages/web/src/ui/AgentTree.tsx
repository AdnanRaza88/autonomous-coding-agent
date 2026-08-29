import { topologicalBatches } from "../lib/dag"
import { statusLabel, statusTone } from "../lib/status"
import type { RunView } from "../state/events"
import { StatusMark } from "./StatusMark"

export function AgentTree(props: {
  view: RunView
  onCancel?: () => void
}) {
  const { view } = props

  if (view.phase === "idle") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 pb-32">
        <div className="max-w-lg text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Agent Core</p>
          <h1 className="mt-3 text-[28px] font-medium tracking-tight text-ink">What should we build?</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Describe a goal. The planner freezes a spec, runs independent tasks in parallel, and streams progress live.
          </p>
          <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
            <Hint text="Refactor auth to JWT with refresh rotation" />
            <Hint text="Add integration tests for the permission gate" />
            <Hint text="Ship a Vercel deploy for the active run" />
            <Hint text="Register a specialist subagent for reviews" />
          </div>
        </div>
      </div>
    )
  }

  const live = view.phase === "planning" || view.phase === "running"
  const batches = topologicalBatches(view.tasks)

  return (
    <div className="mx-auto max-w-3xl px-6 pb-36 pt-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
              {view.phase}
            </span>
            {live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" /> : null}
          </div>
          <h1 className="mt-3 text-xl font-medium leading-snug tracking-tight">{view.goal || "Untitled run"}</h1>
        </div>
        {live && props.onCancel ? (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink"
            onClick={props.onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {view.log.length > 0 ? (
        <div className="mb-8 space-y-1 border-b border-line pb-6">
          {view.log.slice(-8).map((line, i) => (
            <p key={i} className="font-mono text-xs text-muted">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        {batches.map((batch, i) => (
          <section key={i}>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">
              Batch {i + 1}
              {batch.length > 1 ? " · parallel" : ""}
            </p>
            <ul className="space-y-0">
              {batch.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-4 border-t border-line py-3.5 first:border-t-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <StatusMark tone={statusTone(task.status)} />
                      <span className="text-sm font-medium">{task.title}</span>
                    </div>
                    {task.instructions ? (
                      <p className="mt-1.5 max-w-xl pl-[18px] text-[13px] leading-relaxed text-muted">{task.instructions}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted">{statusLabel(task.status)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function Hint(props: { text: string }) {
  return (
    <div className="rounded-xl border border-line px-3.5 py-3 text-[13px] leading-snug text-muted">
      {props.text}
    </div>
  )
}
