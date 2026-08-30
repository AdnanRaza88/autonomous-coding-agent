export function Composer(props: {
  value: string
  onChange: (v: string) => void
  providerId: string
  providers: { id: string; name: string }[]
  onProvider: (id: string) => void
  model: string
  models: { id: string; name: string }[]
  onModel: (id: string) => void
  busy: boolean
  blocked?: boolean
  locked?: boolean
  follow?: boolean
  onSubmit: () => void
  onStop?: () => void
  onBlocked?: () => void
}) {
  function send() {
    if (props.blocked) {
      props.onBlocked?.()
      return
    }
    if (props.locked) return
    props.onSubmit()
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[var(--paper)] via-[var(--paper)] to-transparent px-4 pb-5 pt-12">
      <form
        className="pointer-events-auto mx-auto max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div className="glass rounded-2xl p-1.5 shadow-[0_12px_40px_-16px_color-mix(in_oklab,var(--ink)_28%,transparent)]">
          <div className="solid rounded-[14px] px-4 pb-2 pt-3">
            <textarea
              className="max-h-40 min-h-[72px] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted"
              placeholder={
                props.blocked
                  ? "Connect a provider before sending a goal."
                  : props.locked
                    ? "This run is still working. Stop it to send something else."
                    : props.follow
                      ? "Continue this run. Type / for commands."
                      : "Message Agent Core. Type / for commands."
              }
              disabled={props.locked}
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Escape" && props.locked) {
                  e.preventDefault()
                  props.onStop?.()
                  return
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
              <div className="flex items-center gap-1.5">
                <select
                  className="rounded-md border-0 bg-transparent px-1.5 py-1 text-xs text-muted outline-none hover:text-ink"
                  value={props.providerId}
                  onChange={(e) => props.onProvider(e.target.value)}
                >
                  {props.providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className="text-muted/40">-</span>
                <select
                  className="max-w-[160px] truncate rounded-md border-0 bg-transparent px-1.5 py-1 text-xs text-muted outline-none hover:text-ink"
                  value={props.model}
                  onChange={(e) => props.onModel(e.target.value)}
                >
                  {props.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              {props.locked ? (
                <button
                  type="button"
                  className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-medium text-ink transition-opacity hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]"
                  onClick={() => props.onStop?.()}
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={props.busy || !props.value.trim()}
                  className="rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-xs font-medium text-[var(--paper)] transition-opacity disabled:opacity-40"
                >
                  {props.blocked ? "Connect" : props.busy ? "Starting" : props.follow ? "Continue" : "Send"}
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="mt-2 text-center font-mono text-[10px] text-muted">
          {props.locked ? "Esc to stop" : "Ctrl or Cmd + Enter to send"}
        </p>
      </form>
    </div>
  )
}
