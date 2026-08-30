import { planProgress } from "../lib/plan"
import { statusLabel, statusTone } from "../lib/status"
import type { RunView } from "../state/events"
import { StatusMark } from "./StatusMark"

export function PlanRail(props: { view: RunView }) {
  const { view } = props
  const plan = planProgress(view)

  if (view.phase === "planning" && plan.total === 0) {
    return <p className="font-mono text-[12px] text-muted">Waiting on the planner.</p>
  }

  return (
    <div className="flex flex-col gap-8">
      {plan.batches.map((batch, i) => (
        <section key={i}>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">
            Batch {i + 1}
            {batch.length > 1 ? " · parallel" : ""}
            {plan.activeBatch === i ? " · live" : ""}
          </p>
          <ul>
            {batch.map((task) => (
              <li
                key={task.id}
                className="flex items-start justify-between gap-4 border-t border-line py-3.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <StatusMark tone={statusTone(task.status)} />
                    <span className="text-sm font-medium">{task.title}</span>
                  </div>
                  {task.instructions ? (
                    <p className="mt-1.5 max-w-xl pl-[18px] text-[13px] leading-relaxed text-muted">
                      {task.instructions}
                    </p>
                  ) : null}
                  {view.notes[task.id] ? (
                    <p className="mt-1.5 pl-[18px] text-[12px] text-muted">{view.notes[task.id]}</p>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted">{statusLabel(task.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
