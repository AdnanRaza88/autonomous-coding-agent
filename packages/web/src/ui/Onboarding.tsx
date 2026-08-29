import { useEffect, useState } from "react"
import type { ProviderModel, ProviderSummary, SaveProviderRequest } from "../api/contract"
import { draftFromCatalog, providerRequiresKey } from "../lib/onboarding"

export function Onboarding(props: {
  providers: ProviderSummary[]
  models: ProviderModel[]
  initialId: string
  busy: boolean
  status: string
  onProvider: (id: string) => void
  onSave: (body: SaveProviderRequest) => Promise<void>
  onSkipLocal?: () => void
}) {
  const [form, setForm] = useState(() => draftFromCatalog(props.providers, props.models, props.initialId))

  useEffect(() => {
    setForm((prev) => {
      const next = draftFromCatalog(props.providers, props.models, props.initialId)
      return { ...next, apiKey: prev.id === next.id ? prev.apiKey : "" }
    })
  }, [props.initialId, props.providers, props.models])

  const needsKey = providerRequiresKey(form.id)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[color-mix(in_oklab,var(--ink)_28%,transparent)] p-4">
      <div className="glass w-full max-w-lg rounded-2xl p-2">
        <div className="solid rounded-xl px-6 py-6">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">First run</p>
          <h1 className="mt-1 text-xl font-medium tracking-tight">Connect a model provider</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Agent Core stores the key on the local boot server. The UI keeps a has-key flag only.
          </p>
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void props.onSave(form)
            }}
          >
            <label className="text-xs text-muted">
              Provider
              <select
                className="mt-1 block w-full rounded border border-line bg-paper px-2 py-1.5 text-sm text-ink"
                value={form.id}
                onChange={(e) => props.onProvider(e.target.value)}
              >
                {props.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Base URL
              <input
                className="mt-1 block w-full rounded border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                required
              />
            </label>
            <label className="text-xs text-muted">
              Model
              <select
                className="mt-1 block w-full rounded border border-line bg-paper px-2 py-1.5 text-sm text-ink"
                value={form.model}
                onChange={(e) => {
                  const picked = props.models.find((m) => m.id === e.target.value)
                  setForm({
                    ...form,
                    model: e.target.value,
                    contextWindow: picked?.contextWindow ?? form.contextWindow,
                  })
                }}
              >
                {props.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            {needsKey ? (
              <label className="text-xs text-muted">
                API key
                <input
                  type="password"
                  autoComplete="off"
                  className="mt-1 block w-full rounded border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  required
                />
              </label>
            ) : (
              <p className="text-xs text-muted">Ollama talks to a local runtime. No key is stored.</p>
            )}
            <div className="mt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={props.busy || (needsKey && !form.apiKey.trim())}
                className="rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-xs font-medium text-[var(--paper)] disabled:opacity-40"
              >
                {props.busy ? "Checking" : needsKey ? "Store and test" : "Use local runtime"}
              </button>
              {!needsKey && props.onSkipLocal ? (
                <button type="button" className="text-xs text-muted" onClick={props.onSkipLocal}>
                  Continue
                </button>
              ) : null}
            </div>
          </form>
          {props.status ? <p className="mt-4 font-mono text-xs text-muted">{props.status}</p> : null}
        </div>
      </div>
    </div>
  )
}
