import { useState } from "react"
import type {
  DeployBindingView,
  DeployResultView,
  DeployTargetView,
  DetectedProjectView,
} from "../api/contract"

export function DeployPanel(props: {
  runId: string | null
  goal?: string
  targets: DeployTargetView[]
  bindings: DeployBindingView[]
  detected: DetectedProjectView | null
  last: DeployResultView | null
  onDetect: (runId: string) => Promise<void>
  onSaveToken: (body: { targetId: string; token: string; projectName?: string }) => Promise<void>
  onDeploy: (body: { runId: string; targetId: string; token?: string; projectName?: string }) => Promise<void>
}) {
  const [targetId, setTargetId] = useState(props.targets[0]?.id ?? "vercel")
  const [token, setToken] = useState("")
  const [projectName, setProjectName] = useState("")
  const [busy, setBusy] = useState(false)

  const current = props.runId
    ? props.bindings.find((b) => b.runId === props.runId)
    : undefined

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-medium">Deploy</h1>
      <p className="mt-1 text-sm text-muted">
        {props.runId
          ? `Bound to ${props.runId}${props.goal ? ` / ${props.goal}` : ""}`
          : "Open a run first. Detection reads the frozen SharedSpec and workspace."}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <label className="text-xs text-muted">
          Target
          <select
            className="mt-1 w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            {props.targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} ({t.kind})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Project name
          <input
            className="mt-1 w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="optional"
          />
        </label>
        <label className="text-xs text-muted">
          Token
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Stored server-side. Never re-read."
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-line px-3 py-1.5 text-xs"
            disabled={!props.runId || busy}
            onClick={() => {
              if (!props.runId) return
              setBusy(true)
              void props.onDetect(props.runId).finally(() => setBusy(false))
            }}
          >
            Detect kind
          </button>
          <button
            type="button"
            className="rounded border border-line px-3 py-1.5 text-xs"
            disabled={!token || busy}
            onClick={() => {
              setBusy(true)
              void props
                .onSaveToken({ targetId, token, projectName: projectName || undefined })
                .then(() => setToken(""))
                .finally(() => setBusy(false))
            }}
          >
            Store token
          </button>
          <button
            type="button"
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--paper)]"
            disabled={!props.runId || busy}
            onClick={() => {
              if (!props.runId) return
              setBusy(true)
              void props
                .onDeploy({
                  runId: props.runId,
                  targetId,
                  token: token || undefined,
                  projectName: projectName || undefined,
                })
                .then(() => setToken(""))
                .finally(() => setBusy(false))
            }}
          >
            Deploy run
          </button>
        </div>
      </div>
      {props.detected ? (
        <p className="mt-6 text-sm">
          Detected {props.detected.kind}
          {props.detected.framework ? ` / ${props.detected.framework}` : ""}
          <span className="mt-1 block font-mono text-xs text-muted">{props.detected.reasons.join(" / ")}</span>
        </p>
      ) : null}
      {props.last ? (
        <p className="mt-4 text-sm">
          Last ship: {props.last.status}
          {props.last.url ? (
            <>
              {" "}
              <a className="underline" href={props.last.url} target="_blank" rel="noreferrer">
                {props.last.url}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {current?.lastUrl ? (
        <p className="mt-2 font-mono text-xs text-muted">Binding {current.lastUrl}</p>
      ) : null}
      {props.bindings.length > 0 ? (
        <ul className="mt-8 divide-y divide-[var(--line)] text-sm">
          {props.bindings.map((b) => (
            <li key={b.runId} className="flex justify-between py-2">
              <span className="font-mono text-xs">{b.runId}</span>
              <span className="text-muted">{b.targetId ?? "unbound"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
