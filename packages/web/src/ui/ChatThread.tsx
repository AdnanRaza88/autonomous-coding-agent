import { useEffect, useRef } from "react"
import { formatTokens } from "../lib/usage"
import { buildTranscript } from "../lib/transcript"
import { statusLabel, statusTone } from "../lib/status"
import type { RunView } from "../state/events"
import { StatusMark } from "./StatusMark"

export function ChatThread(props: { view: RunView; onCancel?: () => void }) {
  const { view } = props
  const end = useRef<HTMLDivElement>(null)
  const turns = buildTranscript(view)
  const live = view.phase === "planning" || view.phase === "running"

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [view.cursor, view.drafts, view.phase])

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
          {formatTokens(view.inputTokens, view.outputTokens, view.calls) ? (
            <p className="mt-2 font-mono text-[11px] text-muted">
              {formatTokens(view.inputTokens, view.outputTokens, view.calls)}
            </p>
          ) : null}
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

      <div className="flex flex-col gap-5">
        {turns.map((turn, i) => {
          if (turn.kind === "user") {
            return (
              <div key={`u-${i}`} className="ml-8 sm:ml-16">
                <p className="mb-1 text-right font-mono text-[10px] uppercase tracking-wide text-muted">You</p>
                <div className="rounded-2xl rounded-tr-md bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] px-4 py-3 text-[15px] leading-relaxed">
                  {turn.text}
                </div>
              </div>
            )
          }
          if (turn.kind === "status") {
            return (
              <p key={`s-${i}`} className="font-mono text-[12px] text-muted">
                {turn.text}
              </p>
            )
          }
          return (
            <div key={turn.taskId} className="mr-4 sm:mr-12">
              <div className="mb-1.5 flex items-center gap-2">
                <StatusMark tone={statusTone(turn.status === "queued" ? "queued" : turn.status)} />
                <span className="text-[13px] font-medium">{turn.title}</span>
                <span className="font-mono text-[10px] text-muted">{statusLabel(turn.status)}</span>
              </div>
              {turn.text ? (
                <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-ink">
                  {turn.text}
                  {turn.live ? <span className="stream-caret" aria-hidden /> : null}
                </pre>
              ) : turn.live ? (
                <p className="text-[13px] text-muted">
                  Writing
                  <span className="stream-caret" aria-hidden />
                </p>
              ) : null}
              {turn.note ? <p className="mt-2 text-[12px] text-muted">{turn.note}</p> : null}
            </div>
          )
        })}
        <div ref={end} />
      </div>
    </div>
  )
}
