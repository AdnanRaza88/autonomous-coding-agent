import type { ReactNode } from "react"
import type { RunSummary } from "../api/contract"
import type { ThemeMode } from "../theme/tokens"
import { RunHistory } from "./RunHistory"

export type Screen = "run" | "agents" | "knowledge" | "deploy" | "settings"

export function Layout(props: {
  collapsed: boolean
  onToggleCollapse: () => void
  screen: Screen
  onScreen: (s: Screen) => void
  theme: ThemeMode
  onToggleTheme: () => void
  notice: string
  runs: RunSummary[]
  activeRunId: string | null
  onOpenRun: (id: string) => void
  children: ReactNode
}) {
  const { collapsed, screen } = props
  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <aside
        className={`glass sticky top-0 flex h-screen flex-col justify-between p-3 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="solid flex min-h-0 flex-1 flex-col rounded-md p-3">
          <button className="text-left text-sm font-medium tracking-tight" onClick={props.onToggleCollapse}>
            {collapsed ? "AC" : "Agent Core"}
          </button>
          {!collapsed ? (
            <>
              <nav className="mt-6 flex flex-col gap-1 text-sm">
                <NavBtn active={screen === "run"} onClick={() => props.onScreen("run")} label="Run" />
                <NavBtn active={screen === "agents"} onClick={() => props.onScreen("agents")} label="Subagents" />
                <NavBtn active={screen === "knowledge"} onClick={() => props.onScreen("knowledge")} label="Knowledge" />
                <NavBtn active={screen === "deploy"} onClick={() => props.onScreen("deploy")} label="Deploy" />
                <NavBtn active={screen === "settings"} onClick={() => props.onScreen("settings")} label="Connections" />
              </nav>
              <div className="mt-6 min-h-0 flex-1 overflow-auto">
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted">History</p>
                <RunHistory items={props.runs} activeId={props.activeRunId} onOpen={props.onOpenRun} />
              </div>
            </>
          ) : null}
        </div>
        <div className="solid mt-3 rounded-md p-3">
          <button className="w-full text-left text-sm text-muted" onClick={props.onToggleTheme}>
            {collapsed ? (props.theme === "dark" ? "Dk" : "Lt") : props.theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        {props.notice ? (
          <div className="border-b border-line px-6 py-2 font-mono text-xs text-muted">{props.notice}</div>
        ) : null}
        <div className="min-h-0 flex-1">{props.children}</div>
      </main>
    </div>
  )
}

function NavBtn(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`rounded px-2 py-1.5 text-left ${props.active ? "bg-paper text-ink" : "text-muted"}`}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}
