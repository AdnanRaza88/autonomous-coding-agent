import type { PermissionChoice, PermissionPrompt } from "../api/contract"

export function PermissionModal(props: {
  prompt: PermissionPrompt
  onDecide: (decision: PermissionChoice) => void
}) {
  const { prompt } = props
  const server = prompt.serverId
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--ink)_24%,transparent)] p-4">
      <div className="glass w-full max-w-md rounded-lg p-3">
        <div className="solid rounded-md p-4">
          <p className="font-mono text-xs uppercase tracking-wide text-muted">{prompt.risk} risk</p>
          <h2 className="mt-1 text-lg font-medium">Allow {prompt.action}?</h2>
          {prompt.detail ? <p className="mt-2 text-sm text-muted">{prompt.detail}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--paper)]"
              onClick={() => props.onDecide("allow")}
            >
              Allow once
            </button>
            <button
              className="rounded border border-line px-3 py-1.5 text-xs"
              onClick={() => props.onDecide("allow_session")}
            >
              This session
            </button>
            {server ? (
              <button
                className="rounded border border-line px-3 py-1.5 text-xs"
                onClick={() => props.onDecide("allow_server")}
              >
                {server} this session
              </button>
            ) : null}
            <button
              className="rounded border border-line px-3 py-1.5 text-xs"
              onClick={() => props.onDecide("allow_always")}
            >
              Always
            </button>
            <button className="px-3 py-1.5 text-xs text-muted" onClick={() => props.onDecide("deny_session")}>
              Deny session
            </button>
            <button className="px-3 py-1.5 text-xs text-muted" onClick={() => props.onDecide("deny")}>
              Deny once
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
