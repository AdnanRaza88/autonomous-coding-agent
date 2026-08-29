import type { RunSummary } from "../api/contract"

export function RunHistory(props: {
  items: RunSummary[]
  activeId: string | null
  onOpen: (id: string) => void
}) {
  if (props.items.length === 0) {
    return <p className="mt-4 text-xs text-muted">No runs yet</p>
  }
  return (
    <ul className="mt-4 flex flex-col gap-1">
      {props.items.map((row) => {
        const active = row.id === props.activeId
        return (
          <li key={row.id}>
            <button
              className={`w-full rounded px-2 py-1.5 text-left ${
                active ? "bg-paper text-ink" : "text-muted"
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
