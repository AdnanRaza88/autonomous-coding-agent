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
    <div className="flex h-screen overflow-hidden bg-paper text-ink">
      <aside
        className={`glass relative z-20 flex h-full shrink-0 flex-col border-r border-line transition-[width] duration-200 ${
          collapsed ? "w-[68px]" : "w-[260px]"
        }`}
      >
        <div className="flex items-center gap-2 px-3 pb-2 pt-4">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tracking-tight hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]"
            onClick={props.onToggleCollapse}
            title={collapsed ? "Expand" : "Collapse"}
          >
            AC
          </button>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium tracking-tight">Agent Core</p>
              <p className="truncate font-mono text-[10px] text-muted">local-first</p>
            </div>
          ) : null}
        </div>

        {!collapsed ? (
          <nav className="mt-2 flex flex-col gap-0.5 px-2">
            <NavBtn active={screen === "run"} onClick={() => props.onScreen("run")} label="Chat" />
            <NavBtn active={screen === "agents"} onClick={() => props.onScreen("agents")} label="Subagents" />
            <NavBtn active={screen === "knowledge"} onClick={() => props.onScreen("knowledge")} label="Knowledge" />
            <NavBtn active={screen === "deploy"} onClick={() => props.onScreen("deploy")} label="Deploy" />
            <NavBtn active={screen === "settings"} onClick={() => props.onScreen("settings")} label="Connections" />
          </nav>
        ) : (
          <nav className="mt-2 flex flex-col items-center gap-1 px-2">
            <IconNav active={screen === "run"} onClick={() => props.onScreen("run")} label="C" title="Chat" />
            <IconNav active={screen === "agents"} onClick={() => props.onScreen("agents")} label="S" title="Subagents" />
            <IconNav active={screen === "knowledge"} onClick={() => props.onScreen("knowledge")} label="K" title="Knowledge" />
            <IconNav active={screen === "deploy"} onClick={() => props.onScreen("deploy")} label="D" title="Deploy" />
            <IconNav active={screen === "settings"} onClick={() => props.onScreen("settings")} label="O" title="Connections" />
          </nav>
        )}

        {!collapsed ? (
          <div className="mt-4 min-h-0 flex-1 overflow-hidden px-2">
            <p className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-wider text-muted">History</p>
            <div className="h-full overflow-y-auto pb-4">
              <RunHistory items={props.runs} activeId={props.activeRunId} onOpen={props.onOpenRun} />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="border-t border-line p-2">
          <button
            type="button"
            className="w-full rounded-lg px-2 py-2 text-left text-xs text-muted hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]"
            onClick={props.onToggleTheme}
          >
            {collapsed ? (props.theme === "dark" ? "Dk" : "Lt") : props.theme === "dark" ? "Dark mode" : "Light mode"}
          </button>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        {props.notice ? (
          <div className="shrink-0 border-b border-line px-6 py-2 text-center font-mono text-xs text-muted">
            {props.notice}
          </div>
        ) : null}
        <div className="min-h-0 flex-1">{props.children}</div>
      </main>
    </div>
  )
}

function NavBtn(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        props.active
          ? "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] font-medium text-ink"
          : "text-muted hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] hover:text-ink"
      }`}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}

function IconNav(props: { active: boolean; onClick: () => void; label: string; title: string }) {
  return (
    <button
      type="button"
      title={props.title}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium ${
        props.active
          ? "bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] text-ink"
          : "text-muted hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]"
      }`}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}
