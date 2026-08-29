import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import type { PermissionPrompt, RunSummary, SavedProvider, SlashCommandInfo, SubagentDraft } from "./api/contract"
import { createHttpApi } from "./api/client"
import { createMockApi, createMockBus } from "./api/mock"
import { watchPermissions, watchRunEvents } from "./api/stream"
import { Layout } from "./ui/Layout"
import { Composer } from "./ui/Composer"
import { AgentTree } from "./ui/AgentTree"
import { SubagentBuilder } from "./ui/SubagentBuilder"
import { Settings } from "./ui/Settings"
import { PermissionModal } from "./ui/PermissionModal"
import { CommandPalette } from "./ui/CommandPalette"
import { emptyRun, hydrateRun, reduceRun, type RunView } from "./state/events"
import { applyTheme, type ThemeMode } from "./theme/tokens"
import { readStoredTheme, toggleTheme, writeStoredTheme } from "./theme/persist"
import { parseComposer } from "./lib/filter"

type Screen = "run" | "agents" | "settings"

const useLiveBackend = import.meta.env.VITE_API_MODE !== "mock"
const LAST_RUN_KEY = "agent-core.last-run"

export function App() {
  const bus = useMemo(() => createMockBus(), [])
  const api = useMemo(() => (useLiveBackend ? createHttpApi() : createMockApi(bus)), [bus])
  const cursorRef = useRef(-1)

  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme(window.localStorage))
  const [screen, setScreen] = useState<Screen>("run")
  const [collapsed, setCollapsed] = useState(false)
  const [run, setRun] = useReducer(reduceView, emptyRun())
  const [history, setHistory] = useState<RunSummary[]>([])
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([])
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [providerId, setProviderId] = useState("groq")
  const [model, setModel] = useState("")
  const [saved, setSaved] = useState<SavedProvider[]>([])
  const [agents, setAgents] = useState<SubagentDraft[]>([])
  const [commands, setCommands] = useState<SlashCommandInfo[]>([])
  const [servers, setServers] = useState<Awaited<ReturnType<typeof api.listMcpServers>>>([])
  const [prompt, setPrompt] = useState<PermissionPrompt | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  cursorRef.current = run.cursor

  useEffect(() => {
    applyTheme(theme)
    writeStoredTheme(window.localStorage, theme)
  }, [theme])

  useEffect(() => {
    let alive = true
    void (async () => {
      const [plist, slist, clist, mlist, rlist] = await Promise.all([
        api.listProviders(),
        api.listSubagents(),
        api.listCommands(),
        api.listMcpServers(),
        api.listRuns().catch(() => [] as RunSummary[]),
      ])
      if (!alive) return
      setProviders(plist)
      setAgents(slist)
      setCommands(clist)
      setServers(mlist)
      setHistory(rlist)
      const first = plist[0]?.id ?? "groq"
      setProviderId(first)
      const mods = await api.listProviderModels(first)
      if (!alive) return
      setModels(mods)
      setModel(mods[0]?.id ?? "")
      setSaved(await api.listSavedProviders())
      const remembered = window.sessionStorage.getItem(LAST_RUN_KEY)
      const resume = remembered ?? rlist[0]?.id
      if (resume) {
        try {
          const snap = await api.getRun(resume)
          if (!alive) return
          setRun({ kind: "hydrate", snapshot: snap })
        } catch {
          window.sessionStorage.removeItem(LAST_RUN_KEY)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [api])

  useEffect(() => {
    if (useLiveBackend) return
    return bus.subscribe((msg) => {
      if (msg.channel === "orchestrator" && msg.runId === run.runId) {
        setRun({ kind: "event", event: msg.event })
      }
      if (msg.channel === "permission") setPrompt(msg.prompt)
    })
  }, [bus, run.runId])

  useEffect(() => {
    if (!useLiveBackend || !run.runId) return
    window.sessionStorage.setItem(LAST_RUN_KEY, run.runId)
    const stream = watchRunEvents(
      run.runId,
      (msg) => {
        setRun({ kind: "event", event: msg.event })
      },
      undefined,
      { after: cursorRef.current },
    )
    return () => stream.close()
  }, [run.runId])

  useEffect(() => {
    if (!useLiveBackend) return
    const stream = watchPermissions((next) => setPrompt(next))
    return () => stream.close()
  }, [])

  async function refreshHistory() {
    try {
      setHistory(await api.listRuns())
    } catch {
      return
    }
  }

  async function onProviderChange(id: string) {
    setProviderId(id)
    const mods = await api.listProviderModels(id)
    setModels(mods)
    setModel(mods[0]?.id ?? "")
  }

  async function openRun(id: string) {
    try {
      const snap = await api.getRun(id)
      setRun({ kind: "hydrate", snapshot: snap })
      window.sessionStorage.setItem(LAST_RUN_KEY, id)
      setScreen("run")
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    }
  }

  async function submitGoal() {
    const parsed = parseComposer(draft)
    if (parsed.slash) {
      setPaletteOpen(true)
      return
    }
    const goal = draft.trim()
    if (!goal) return
    setBusy(true)
    try {
      const started = await api.startRun({ goal, providerId, model })
      try {
        const snap = await api.getRun(started.runId)
        setRun({ kind: "hydrate", snapshot: { ...snap, goal } })
      } catch {
        setRun({ kind: "start", runId: started.runId, goal })
      }
      setDraft("")
      setScreen("run")
      await refreshHistory()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function abortRun() {
    if (!run.runId) return
    try {
      await api.cancelRun(run.runId)
      const snap = await api.getRun(run.runId)
      setRun({ kind: "hydrate", snapshot: snap })
      await refreshHistory()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    }
  }

  async function runSlash(name: string, args: string[]) {
    const result = await api.runCommand(name, args)
    setNotice(result.output)
    setPaletteOpen(false)
  }

  return (
    <Layout
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((v) => !v)}
      screen={screen}
      onScreen={setScreen}
      theme={theme}
      onToggleTheme={() => setTheme(toggleTheme(theme))}
      notice={notice}
      runs={history}
      activeRunId={run.runId}
      onOpenRun={(id) => void openRun(id)}
    >
      {screen === "run" ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-auto p-6">
            <AgentTree view={run} onCancel={() => void abortRun()} />
          </div>
          <Composer
            value={draft}
            onChange={(next) => {
              setDraft(next)
              setPaletteOpen(next.startsWith("/"))
            }}
            providerId={providerId}
            providers={providers}
            onProvider={onProviderChange}
            model={model}
            models={models}
            onModel={setModel}
            busy={busy}
            onSubmit={() => void submitGoal()}
          />
          {paletteOpen ? (
            <CommandPalette
              query={draft}
              commands={commands}
              onPick={(cmd) => {
                const parsed = parseComposer(draft)
                void runSlash(cmd.name, parsed.args)
              }}
              onClose={() => setPaletteOpen(false)}
            />
          ) : null}
        </div>
      ) : null}

      {screen === "agents" ? (
        <SubagentBuilder
          items={agents}
          onSave={async (item) => {
            const savedItem = await api.upsertSubagent(item)
            setAgents(await api.listSubagents())
            setNotice(`saved ${savedItem.id}`)
          }}
          onDelete={async (id) => {
            await api.deleteSubagent(id)
            setAgents(await api.listSubagents())
          }}
        />
      ) : null}

      {screen === "settings" ? (
        <Settings
          providers={providers}
          saved={saved}
          servers={servers}
          onSaveProvider={async (body) => {
            const record = await api.saveProvider(body)
            setSaved(await api.listSavedProviders())
            setNotice(`provider ${record.id} stored`)
          }}
          onConnectServer={async (body) => {
            await api.connectMcpServer(body)
            setServers(await api.listMcpServers())
          }}
        />
      ) : null}

      {prompt ? (
        <PermissionModal
          prompt={prompt}
          onDecide={async (decision) => {
            await api.decidePermission(prompt.id, decision)
            setPrompt(null)
          }}
        />
      ) : null}
    </Layout>
  )
}

type ViewAction =
  | { kind: "start"; runId: string; goal: string }
  | { kind: "hydrate"; snapshot: import("./api/contract").RunSnapshot }
  | { kind: "event"; event: import("@agent-core/types").OrchestratorEvent }

function reduceView(view: RunView, action: ViewAction): RunView {
  if (action.kind === "start") {
    return { ...emptyRun(), runId: action.runId, goal: action.goal, phase: "planning", log: ["planning"], cursor: -1 }
  }
  if (action.kind === "hydrate") {
    return hydrateRun(action.snapshot)
  }
  return reduceRun(view, action.event)
}
