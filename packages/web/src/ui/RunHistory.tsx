import type { RunSummary } from "../api/contract"

export function RunHistory(props: {
  items: RunSummary[]
  activeId: string | null
  onOpen: (id: string) => void
}) {
  if (props.items.length === 0) {
    return <p className="mt-2 px-2 text-xs text-muted">No runs yet</p>
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {props.items.map((row) => {
        const active = row.id === props.activeId
        return (
          <li key={row.id}>
            <button
              type="button"
              className={`w-full rounded-lg px-2 py-1.5 text-left ${
                active
                  ? "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] text-ink"
                  : "text-muted hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] hover:text-ink"
              }`}
              onClick={() => props.onOpen(row.id)}
            >
              <span className="block truncate text-xs">{row.goal || row.id}</span>
              <span className="font-mono text-[10px] uppercase tracking-wide">{row.status}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
