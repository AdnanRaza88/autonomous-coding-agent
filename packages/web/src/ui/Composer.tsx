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
  onSubmit: () => void
}) {
  return (
    <form
      className="glass m-4 rounded-lg p-3"
      onSubmit={(e) => {
        e.preventDefault()
        props.onSubmit()
      }}
    >
      <div className="solid rounded-md p-3">
        <textarea
          className="h-24 w-full resize-none bg-transparent text-sm outline-none"
          placeholder="Describe the goal. Type / for commands."
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              props.onSubmit()
            }
          }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <select
              className="rounded border border-line bg-paper px-2 py-1 text-xs"
              value={props.providerId}
              onChange={(e) => props.onProvider(e.target.value)}
            >
              {props.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-line bg-paper px-2 py-1 text-xs"
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
          <button
            type="submit"
            disabled={props.busy}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--paper)] disabled:opacity-50"
          >
            {props.busy ? "Starting" : "Run"}
          </button>
        </div>
      </div>
    </form>
  )
}
