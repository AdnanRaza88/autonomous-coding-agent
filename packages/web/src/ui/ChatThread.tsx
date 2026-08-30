import { buildTranscript } from "../lib/transcript"
import { statusLabel, statusTone } from "../lib/status"
import type { RunView } from "../state/events"
import { StatusMark } from "./StatusMark"

export function ChatThread(props: { view: RunView }) {
  const turns = buildTranscript(props.view)

  return (
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
    </div>
  )
}
