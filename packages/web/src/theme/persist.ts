import { THEME_STORAGE_KEY, type ThemeMode } from "./tokens.js"

export function readStoredTheme(storage: Pick<Storage, "getItem"> | null): ThemeMode {
  const raw = storage?.getItem(THEME_STORAGE_KEY)
  return raw === "dark" ? "dark" : "light"
}

export function writeStoredTheme(storage: Pick<Storage, "setItem"> | null, mode: ThemeMode): void {
  storage?.setItem(THEME_STORAGE_KEY, mode)
}

export function toggleTheme(mode: ThemeMode): ThemeMode {
  return mode === "light" ? "dark" : "light"
}
