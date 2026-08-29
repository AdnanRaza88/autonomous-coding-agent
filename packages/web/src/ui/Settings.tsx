import { useEffect, useState } from "react"
import type {
  McpServerDraft,
  PermissionRuleView,
  ProviderModel,
  ProviderSummary,
  SaveProviderRequest,
  SavedProvider,
} from "../api/contract"
import { draftFromCatalog } from "../lib/onboarding"

export function Settings(props: {
  providers: ProviderSummary[]
  models: ProviderModel[]
  saved: SavedProvider[]
  servers: McpServerDraft[]
  rules: PermissionRuleView[]
  selectedId: string
  onSelectProvider: (id: string) => void
  onSaveProvider: (body: SaveProviderRequest) => Promise<void>
  onConnectServer: (body: McpServerDraft) => Promise<void>
  onRevokeRule: (id: string) => Promise<void>
  onClearSession: () => Promise<void>
}) {
  const [form, setForm] = useState<SaveProviderRequest>(() =>
    draftFromCatalog(props.providers, props.models, props.selectedId || props.providers[0]?.id || "groq"),
  )

  useEffect(() => {
    setForm((prev) => {
      const next = draftFromCatalog(props.providers, props.models, props.selectedId || prev.id)
      return { ...next, apiKey: prev.id === next.id ? prev.apiKey : "" }
    })
  }, [props.selectedId, props.providers, props.models])
  const [server, setServer] = useState<McpServerDraft>({
    id: "",
    transport: "url",
    url: "",
  })

  return (
    <div className="mx-auto grid max-w-5xl gap-12 p-6 lg:grid-cols-2">
      <section>
        <h1 className="text-xl font-medium">Providers</h1>
        <p className="mt-1 text-sm text-muted">
          The key is sent once. After save, the UI only keeps a has-key flag.
        </p>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void props.onSaveProvider(form).then(() => setForm({ ...form, apiKey: "" }))
          }}
        >
          <select
            className="rounded border border-line bg-paper px-2 py-1.5 text-sm"
            value={form.id}
            onChange={(e) => props.onSelectProvider(e.target.value)}
          >
            {props.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-line bg-paper px-2 py-1.5 text-sm"
            placeholder="Base URL"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            required
          />
          <input
            className="rounded border border-line bg-paper px-2 py-1.5 text-sm"
            placeholder="Model"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            required
          />
          <input
            type="password"
            autoComplete="off"
            className="rounded border border-line bg-paper px-2 py-1.5 text-sm"
            placeholder="API key"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          />
          <button type="submit" className="self-start rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--paper)]">
            Store provider
          </button>
        </form>
        <ul className="mt-6 divide-y divide-[var(--line)] text-sm">
          {props.saved.map((item) => (
            <li key={item.id} className="flex justify-between py-2">
              <span>{item.id}</span>
              <span className="font-mono text-xs text-muted">{item.hasKey ? "key stored" : "no key"}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-medium">MCP servers</h2>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void props.onConnectServer(server)
          }}
        >
          <input
            className="rounded border border-line bg-paper px-2 py-1.5 text-sm"
            placeholder="Server id"
            value={server.id}
            onChange={(e) => setServer({ ...server, id: e.target.value })}
            required
          />
          <select
            className="rounded border border-line bg-paper px-2 py-1.5 text-sm"
            value={server.transport}
            onChange={(e) => setServer({ ...server, transport: e.target.value as "stdio" | "url" })}
          >
            <option value="url">URL</option>
            <option value="stdio">stdio</option>
          </select>
          {server.transport === "url" ? (
            <input
              className="rounded border border-line bg-paper px-2 py-1.5 text-sm"
              placeholder="http://127.0.0.1:3100"
              value={server.url ?? ""}
              onChange={(e) => setServer({ ...server, url: e.target.value })}
            />
          ) : (
            <input
              className="rounded border border-line bg-paper px-2 py-1.5 text-sm"
              placeholder="command"
              value={server.command ?? ""}
              onChange={(e) => setServer({ ...server, command: e.target.value })}
            />
          )}
          <button type="submit" className="self-start rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--paper)]">
            Connect
          </button>
        </form>
        <ul className="mt-6 divide-y divide-[var(--line)] text-sm">
          {props.servers.map((item) => (
            <li key={item.id} className="flex justify-between py-2">
              <span>{item.id}</span>
              <span className="font-mono text-xs text-muted">{item.connected ? "connected" : item.transport}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="lg:col-span-2">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-xl font-medium">Permission grants</h2>
            <p className="mt-1 text-sm text-muted">Always-grants survive restart. Session grants last until expiry or clear.</p>
          </div>
          <button
            type="button"
            className="text-xs text-muted"
            onClick={() => void props.onClearSession()}
          >
            Clear session
          </button>
        </div>
        {props.rules.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No stored grants.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line)] text-sm">
            {props.rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">
                    {rule.effect} {rule.scope} {rule.action ?? rule.toolName ?? rule.serverId ?? rule.kind ?? rule.id}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {rule.persist}
                    {rule.serverId ? ` / ${rule.serverId}` : ""}
                    {rule.expiresAt ? ` / until ${new Date(rule.expiresAt).toISOString()}` : ""}
                  </p>
                </div>
                <button type="button" className="shrink-0 text-xs text-muted" onClick={() => void props.onRevokeRule(rule.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
