import { useEffect, useState } from "react"
import type {
  GraphFactView,
  MemoryHealth,
  ProjectContextView,
  VaultGraphView,
  VaultNoteSummary,
  VaultNoteView,
} from "../api/contract"

export function Knowledge(props: {
  health: MemoryHealth | null
  facts: GraphFactView[]
  notes: VaultNoteSummary[]
  graph: VaultGraphView | null
  onSearch: (query: string) => Promise<ProjectContextView>
  onAddFact: (statement: string) => Promise<void>
  onOpenNote: (id: string) => Promise<VaultNoteView>
  onSaveNote: (body: { id?: string; title: string; body: string; links?: string[] }) => Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [context, setContext] = useState<ProjectContextView | null>(null)
  const [statement, setStatement] = useState("")
  const [open, setOpen] = useState<VaultNoteView | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftBody, setDraftBody] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraftTitle(open.title)
    setDraftBody(open.body)
  }, [open])

  const healthLine = props.health
    ? `AutoMem ${props.health.automem} / Graphiti ${props.health.graphiti}`
    : "Memory layer not loaded"

  return (
    <div className="mx-auto grid max-w-6xl gap-12 p-6 lg:grid-cols-2">
      <section>
        <h1 className="text-xl font-medium">Memory</h1>
        <p className="mt-1 font-mono text-xs text-muted">{healthLine}</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!query.trim()) return
            setBusy(true)
            void props
              .onSearch(query.trim())
              .then(setContext)
              .finally(() => setBusy(false))
          }}
        >
          <input
            className="min-w-0 flex-1 rounded border border-line bg-paper px-2 py-1.5 text-sm"
            placeholder="Recall a fact or prior run"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--paper)]" disabled={busy}>
            Recall
          </button>
        </form>
        {context ? (
          <div className="mt-4 text-sm">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Recall</p>
            <ul className="mt-2 divide-y divide-[var(--line)]">
              {(context.relevantMemories.length ? context.relevantMemories : context.relevantKnowledgeGraphFacts).map(
                (line, i) => (
                  <li key={i} className="py-2">
                    {line}
                  </li>
                ),
              )}
              {context.relevantMemories.length === 0 && context.relevantKnowledgeGraphFacts.length === 0 ? (
                <li className="py-2 text-muted">Nothing stored for that query.</li>
              ) : null}
            </ul>
          </div>
        ) : null}
        <form
          className="mt-8 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!statement.trim()) return
            void props.onAddFact(statement.trim()).then(() => setStatement(""))
          }}
        >
          <label className="text-xs text-muted">
            Add fact
            <textarea
              className="mt-1 h-20 w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="self-start rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--paper)]">
            Store fact
          </button>
        </form>
        <ul className="mt-6 divide-y divide-[var(--line)] text-sm">
          {props.facts.map((fact) => (
            <li key={fact.id} className="py-2">
              <p>{fact.text}</p>
              <p className="mt-0.5 font-mono text-[10px] text-muted">
                {fact.kind}
                {fact.source ? ` / ${fact.source}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-medium">Vault</h2>
        <p className="mt-1 text-sm text-muted">Obsidian-compatible notes. Wiki links stay as written.</p>
        <ul className="mt-4 divide-y divide-[var(--line)] text-sm">
          {props.notes.map((note) => (
            <li key={note.id}>
              <button className="flex w-full items-baseline justify-between py-2 text-left" onClick={() => void props.onOpenNote(note.id).then(setOpen)}>
                <span>{note.title}</span>
                <span className="font-mono text-[10px] text-muted">{note.id}</span>
              </button>
            </li>
          ))}
        </ul>
        {props.graph && props.graph.edges.length > 0 ? (
          <div className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Links</p>
            <ul className="mt-2 font-mono text-xs text-muted">
              {props.graph.edges.map((edge, i) => (
                <li key={`${edge.from}-${edge.to}-${i}`}>
                  {edge.from} - {edge.to}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const links = [...draftBody.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]!)
            void props
              .onSaveNote({
                id: open?.id,
                title: draftTitle,
                body: draftBody,
                links,
              })
              .then(() => {
                setOpen(null)
                setDraftTitle("")
                setDraftBody("")
              })
          }}
        >
          <input
            className="rounded border border-line bg-paper px-2 py-1.5 text-sm"
            placeholder="Note title"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            required
          />
          <textarea
            className="h-40 rounded border border-line bg-paper px-2 py-1.5 font-mono text-xs"
            placeholder="Markdown body. Use [[Wiki Links]]."
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--paper)]">
              {open ? "Save note" : "Write note"}
            </button>
            {open ? (
              <button
                type="button"
                className="text-xs text-muted"
                onClick={() => {
                  setOpen(null)
                  setDraftTitle("")
                  setDraftBody("")
                }}
              >
                New
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  )
}
