export type ThemeMode = "light" | "dark"

export const THEME_STORAGE_KEY = "agent-core.theme"

export const BASE_HUE = 250

export function themeVars(mode: ThemeMode): Record<string, string> {
  const dark = mode === "dark"
  return {
    "--hue": String(BASE_HUE),
    "--paper": dark ? `oklch(0.18 0.018 ${BASE_HUE})` : `oklch(0.975 0.01 ${BASE_HUE})`,
    "--panel": dark ? `oklch(0.23 0.02 ${BASE_HUE} / 0.72)` : `oklch(0.995 0.012 ${BASE_HUE} / 0.7)`,
    "--solid": dark ? `oklch(0.22 0.016 ${BASE_HUE})` : `oklch(0.995 0.008 ${BASE_HUE})`,
    "--ink": dark ? `oklch(0.93 0.012 ${BASE_HUE})` : `oklch(0.24 0.03 ${BASE_HUE})`,
    "--muted": dark ? `oklch(0.72 0.02 ${BASE_HUE})` : `oklch(0.46 0.02 ${BASE_HUE})`,
    "--line": dark ? `oklch(0.4 0.02 ${BASE_HUE} / 0.45)` : `oklch(0.55 0.02 ${BASE_HUE} / 0.22)`,
    "--accent": `oklch(${dark ? "0.72" : "0.5"} 0.09 ${BASE_HUE})`,
    "--ok": dark ? "oklch(0.76 0.08 155)" : "oklch(0.52 0.08 155)",
    "--warn": dark ? "oklch(0.8 0.08 85)" : "oklch(0.58 0.08 85)",
    "--bad": dark ? "oklch(0.72 0.1 25)" : "oklch(0.52 0.12 25)",
    "--info": dark ? `oklch(0.74 0.06 ${BASE_HUE})` : `oklch(0.5 0.07 ${BASE_HUE})`,
    "--glass-blur": "16px",
  }
}

export function applyTheme(mode: ThemeMode, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = mode
  root.classList.toggle("dark", mode === "dark")
  const vars = themeVars(mode)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}
