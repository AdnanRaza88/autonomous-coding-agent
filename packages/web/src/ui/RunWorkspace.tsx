import { useEffect, useRef } from "react"
import { planProgress } from "../lib/plan"
import { formatTokens } from "../lib/usage"
import type { RunView } from "../state/events"
import { ChatThread } from "./ChatThread"
import { PlanRail } from "./PlanRail"

export type RunSurface = "chat" | "plan"

export function RunWorkspace(props: {
  view: RunView
  surface: RunSurface
  onSurface: (next: RunSurface) => void
  onCancel?: () => void
  onCopy?: () => void
  onNew?: () => void
  copied?: boolean
}) {
  const { view, surface } = props
  const end = useRef<HTMLDivElement>(null)
  const live = view.phase === "planning" || view.phase === "running"
  const plan = planProgress(view)

  useEffect(() => {
    if (surface !== "chat") return
    end.current?.scrollIntoView({ block: "end" })
  }, [surface, view.cursor, view.drafts, view.phase])

  return (
    <div className="mx-auto max-w-3xl px-6 pb-36 pt-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
              {view.phase}
            </span>
            {live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" /> : null}
            <div className="inline-flex rounded-lg border border-line p-0.5 text-[11px]">
              <button
                type="button"
                className={`rounded-md px-2 py-0.5 ${surface === "chat" ? "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] text-ink" : "text-muted"}`}
                onClick={() => props.onSurface("chat")}
              >
                Chat
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-0.5 ${surface === "plan" ? "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] text-ink" : "text-muted"}`}
                onClick={() => props.onSurface("plan")}
              >
                Plan
              </button>
            </div>
          </div>
          {plan.line ? <p className="mt-2 font-mono text-[11px] text-muted">{plan.line}</p> : null}
          {formatTokens(view.inputTokens, view.outputTokens, view.calls) ? (
            <p className="mt-1 font-mono text-[11px] text-muted">
              {formatTokens(view.inputTokens, view.outputTokens, view.calls)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {props.onCopy ? (
            <button
              type="button"
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink"
              onClick={props.onCopy}
            >
              {props.copied ? "Copied" : "Copy"}
            </button>
          ) : null}
          {!live && props.onNew ? (
            <button
              type="button"
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink"
              onClick={props.onNew}
            >
              New
            </button>
          ) : null}
          {live && props.onCancel ? (
            <button
              type="button"
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink"
              onClick={props.onCancel}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {surface === "chat" ? (
        <>
          {plan.total > 0 ? (
            <button
              type="button"
              className="mb-6 w-full border-b border-line pb-4 text-left"
              onClick={() => props.onSurface("plan")}
            >
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Plan</p>
              <p className="mt-1 text-[13px] text-ink">
                {plan.live[0]?.title ?? plan.batches.flat()[0]?.title ?? "Tasks ready"}
                {plan.total > 1 ? ` · ${plan.total} tasks` : ""}
              </p>
            </button>
          ) : null}
          <ChatThread view={view} />
          <div ref={end} />
        </>
      ) : (
        <PlanRail view={view} />
      )}
    </div>
  )
}
