import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import type {
  DeployBindingView,
  DeployResultView,
  DeployTargetView,
  DetectedProjectView,
  GraphFactView,
  MemoryHealth,
  PermissionPrompt,
  PermissionRuleView,
  RunSummary,
  ProviderModel,
  ProviderSummary,
  SaveProviderRequest,
  SavedProvider,
  SlashCommandInfo,
  SubagentDraft,
  VaultGraphView,
  VaultNoteSummary,
} from "./api/contract"
import { createHttpApi } from "./api/client"
import { createMockApi, createMockBus } from "./api/mock"
import { watchPermissions, watchRunEvents } from "./api/stream"
import { Layout, type Screen } from "./ui/Layout"
import { Composer } from "./ui/Composer"
import { AgentTree } from "./ui/AgentTree"
import { ChatThread } from "./ui/ChatThread"
import { SubagentBuilder } from "./ui/SubagentBuilder"
import { Settings } from "./ui/Settings"
import { PermissionModal } from "./ui/PermissionModal"
import { CommandPalette } from "./ui/CommandPalette"
import { Knowledge } from "./ui/Knowledge"
import { DeployPanel } from "./ui/DeployPanel"
import { Onboarding } from "./ui/Onboarding"
import { emptyRun, hydrateRun, reduceRun, type RunView } from "./state/events"
import { applyTheme, type ThemeMode } from "./theme/tokens"
import { readStoredTheme, toggleTheme, writeStoredTheme } from "./theme/persist"
import { parseComposer } from "./lib/filter"
import { needsOnboarding, readyProvider } from "./lib/onboarding"

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
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [models, setModels] = useState<ProviderModel[]>([])
  const [providerId, setProviderId] = useState("groq")
  const [model, setModel] = useState("")
  const [saved, setSaved] = useState<SavedProvider[]>([])
  const [agents, setAgents] = useState<SubagentDraft[]>([])
  const [commands, setCommands] = useState<SlashCommandInfo[]>([])
  const [servers, setServers] = useState<Awaited<ReturnType<typeof api.listMcpServers>>>([])
  const [rules, setRules] = useState<PermissionRuleView[]>([])
  const [prompt, setPrompt] = useState<PermissionPrompt | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [health, setHealth] = useState<MemoryHealth | null>(null)
  const [facts, setFacts] = useState<GraphFactView[]>([])
  const [notes, setNotes] = useState<VaultNoteSummary[]>([])
  const [graph, setGraph] = useState<VaultGraphView | null>(null)
  const [targets, setTargets] = useState<DeployTargetView[]>([])
  const [bindings, setBindings] = useState<DeployBindingView[]>([])
  const [detected, setDetected] = useState<DetectedProjectView | null>(null)
  const [lastDeploy, setLastDeploy] = useState<DeployResultView | null>(null)
  const [booted, setBooted] = useState(false)
  const [probeBusy, setProbeBusy] = useState(false)
  const [probeStatus, setProbeStatus] = useState("")
  const [forceOnboard, setForceOnboard] = useState(false)

  cursorRef.current = run.cursor

  useEffect(() => {
    applyTheme(theme)
    writeStoredTheme(window.localStorage, theme)
  }, [theme])

  useEffect(() => {
    let alive = true
    void (async () => {
      const [plist, slist, clist, mlist, rlist, grants] = await Promise.all([
        api.listProviders(),
        api.listSubagents(),
        api.listCommands(),
        api.listMcpServers(),
        api.listRuns().catch(() => [] as RunSummary[]),
        api.listPermissionRules().catch(() => [] as PermissionRuleView[]),
      ])
      if (!alive) return
      setProviders(plist)
      setAgents(slist)
      setCommands(clist)
      setServers(mlist)
      setHistory(rlist)
      setRules(grants)
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
      const [mem, listedFacts, listedNotes, listedGraph, listedTargets, listedBindings] = await Promise.all([
        api.memoryHealth().catch(() => null),
        api.listFacts().catch(() => [] as GraphFactView[]),
        api.listVaultNotes().catch(() => [] as VaultNoteSummary[]),
        api.vaultGraph().catch(() => null),
        api.listDeployTargets().catch(() => [] as DeployTargetView[]),
        api.listDeployBindings().catch(() => [] as DeployBindingView[]),
      ])
      if (!alive) return
      setHealth(mem)
      setFacts(listedFacts)
      setNotes(listedNotes)
      setGraph(listedGraph)
      setTargets(listedTargets)
      setBindings(listedBindings)
      setBooted(true)
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

  async function refreshRules() {
    try {
      setRules(await api.listPermissionRules())
    } catch {
      return
    }
  }

  async function refreshKnowledge() {
    try {
      const [listedFacts, listedNotes, listedGraph, mem] = await Promise.all([
        api.listFacts(),
        api.listVaultNotes(),
        api.vaultGraph(),
        api.memoryHealth(),
      ])
      setFacts(listedFacts)
      setNotes(listedNotes)
      setGraph(listedGraph)
      setHealth(mem)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    }
  }

  async function refreshDeploy() {
    try {
      setBindings(await api.listDeployBindings())
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

  const usable = readyProvider(saved, providerId)
  const blocked = booted && !usable
  const showOnboarding = booted && (forceOnboard || needsOnboarding(saved))

  async function storeProvider(body: SaveProviderRequest) {
    setProbeBusy(true)
    setProbeStatus("storing")
    try {
      await api.saveProvider(body)
      const listed = await api.listSavedProviders()
      setSaved(listed)
      setProviderId(body.id)
      const mods = await api.listProviderModels(body.id)
      setModels(mods)
      setModel(body.model || mods[0]?.id || "")
      const probe = await api.probeProvider(body.id)
      if (!probe.ok) {
        setProbeStatus(probe.message ?? probe.code ?? "probe failed")
        setNotice(probe.message ?? `probe failed for ${body.id}`)
        return
      }
      setProbeStatus(`connected in ${probe.latencyMs}ms`)
      setNotice(`${body.id} ready`)
      setForceOnboard(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setProbeStatus(message)
      setNotice(message)
    } finally {
      setProbeBusy(false)
    }
  }

  async function useLocalRuntime() {
    const catalog = providers.find((row) => row.id === "ollama")
    const first = (await api.listProviderModels("ollama"))[0]
    await storeProvider({
      id: "ollama",
      baseUrl: catalog?.defaultBaseUrl ?? "http://127.0.0.1:11434/v1",
      apiKey: "",
      model: first?.id ?? "qwen2.5-coder:7b",
      contextWindow: first?.contextWindow ?? 32768,
    })
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
    if (!readyProvider(saved, providerId)) {
      setForceOnboard(true)
      return
    }
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
        <div className="relative flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {run.phase === "idle" ? (
              <AgentTree view={run} onHint={setDraft} />
            ) : (
              <ChatThread view={run} onCancel={() => void abortRun()} />
            )}
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
            blocked={blocked}
            onSubmit={() => void submitGoal()}
            onBlocked={() => setForceOnboard(true)}
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
        <div className="h-full overflow-y-auto">
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
        </div>
      ) : null}

      {screen === "knowledge" ? (
        <div className="h-full overflow-y-auto">
          <Knowledge
            health={health}
            facts={facts}
            notes={notes}
            graph={graph}
            onSearch={(q) => api.memoryContext(q)}
            onAddFact={async (statement) => {
              await api.addFact({ statement })
              await refreshKnowledge()
            }}
            onOpenNote={(id) => api.readVaultNote(id)}
            onSaveNote={async (body) => {
              await api.writeVaultNote(body)
              await refreshKnowledge()
            }}
          />
        </div>
      ) : null}

      {screen === "deploy" ? (
        <div className="h-full overflow-y-auto">
          <DeployPanel
            runId={run.runId}
            goal={run.goal}
            targets={targets}
            bindings={bindings}
            detected={detected}
            last={lastDeploy}
            onDetect={async (runId) => {
              setDetected(await api.detectDeploy(runId))
              await refreshDeploy()
            }}
            onSaveToken={async (body) => {
              const stored = await api.saveDeployCredentials(body)
              setNotice(`token stored for ${stored.targetId}`)
            }}
            onDeploy={async (body) => {
              const result = await api.deployRun(body)
              setLastDeploy(result)
              setNotice(result.status === "live" ? result.url : result.message ?? "deploy failed")
              await refreshDeploy()
            }}
          />
        </div>
      ) : null}

      {screen === "settings" ? (
        <div className="h-full overflow-y-auto">
          <Settings
            providers={providers}
            models={models}
            saved={saved}
            servers={servers}
            rules={rules}
            selectedId={providerId}
            onSelectProvider={(id) => void onProviderChange(id)}
            onSaveProvider={async (body) => {
              await storeProvider(body)
            }}
            onConnectServer={async (body) => {
              await api.connectMcpServer(body)
              setServers(await api.listMcpServers())
            }}
            onRevokeRule={async (id) => {
              await api.removePermissionRule(id)
              await refreshRules()
            }}
            onClearSession={async () => {
              await api.clearPermissionSession()
              await refreshRules()
            }}
          />
        </div>
      ) : null}

      {showOnboarding ? (
        <Onboarding
          providers={providers}
          models={models}
          initialId={providerId}
          busy={probeBusy}
          status={probeStatus}
          onProvider={(id) => void onProviderChange(id)}
          onSave={storeProvider}
          onSkipLocal={useLocalRuntime}
        />
      ) : null}

      {prompt ? (
        <PermissionModal
          prompt={prompt}
          onDecide={async (decision) => {
            await api.decidePermission(prompt.id, decision)
            setPrompt(null)
            await refreshRules()
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
