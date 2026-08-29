import assert from "node:assert/strict"
import { test } from "node:test"
import { THEME_STORAGE_KEY } from "./tokens.ts"
import { readStoredTheme, toggleTheme, writeStoredTheme } from "./persist.ts"

test("theme persists across reload via storage", () => {
  const mem = new Map<string, string>()
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v)
    },
  }
  assert.equal(readStoredTheme(storage), "light")
  writeStoredTheme(storage, "dark")
  assert.equal(mem.get(THEME_STORAGE_KEY), "dark")
  assert.equal(readStoredTheme(storage), "dark")
})

test("toggleTheme flips modes", () => {
  assert.equal(toggleTheme("light"), "dark")
  assert.equal(toggleTheme("dark"), "light")
})
