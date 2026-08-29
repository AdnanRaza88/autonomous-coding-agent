import type { ThemePair } from "./types.js"

export const THEME_PAIR: ThemePair[] = [
  {
    id: "agent-core-light",
    label: "Agent Core Light",
    uiTheme: "vs",
    path: "./themes/agent-core-light.json",
  },
  {
    id: "agent-core-dark",
    label: "Agent Core Dark",
    uiTheme: "vs-dark",
    path: "./themes/agent-core-dark.json",
  },
]

export function themeForKind(kind: "light" | "dark"): ThemePair {
  return kind === "dark" ? THEME_PAIR[1] : THEME_PAIR[0]
}

export function nextTheme(currentId: string): ThemePair {
  return currentId === "agent-core-light" ? THEME_PAIR[1] : THEME_PAIR[0]
}

export const LIGHT_COLORS = {
  accent: "#5B4FA8",
  editorBg: "#F4F3F8",
  editorFg: "#1C1B22",
  sidebarBg: "#ECEAF3",
  statusBg: "#E4E1EE",
  lineHighlight: "#E4E0F2",
  selection: "#C9C2E8",
  comment: "#6B6680",
}

export const DARK_COLORS = {
  accent: "#8B82C9",
  editorBg: "#16151C",
  editorFg: "#E8E6F0",
  sidebarBg: "#121118",
  statusBg: "#1C1B24",
  lineHighlight: "#221F2C",
  selection: "#3A3454",
  comment: "#8A849C",
}
