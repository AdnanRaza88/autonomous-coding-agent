import assert from "node:assert/strict"
import { test } from "node:test"
import { pickModel, pickProvider, readLastModel, readLastProvider, writeLastModel, writeLastProvider } from "./session.ts"

function memory(): Storage {
  const bag = new Map<string, string>()
  return {
    get length() {
      return bag.size
    },
    clear() {
      bag.clear()
    },
    getItem(key: string) {
      return bag.get(key) ?? null
    },
    key(index: number) {
      return [...bag.keys()][index] ?? null
    },
    removeItem(key: string) {
      bag.delete(key)
    },
    setItem(key: string, value: string) {
      bag.set(key, value)
    },
  }
}

test("round-trips provider and model", () => {
  const store = memory()
  writeLastProvider(store, "anthropic")
  writeLastModel(store, "claude-sonnet-4-5")
  assert.equal(readLastProvider(store), "anthropic")
  assert.equal(readLastModel(store), "claude-sonnet-4-5")
})

test("clears blank writes", () => {
  const store = memory()
  writeLastProvider(store, "groq")
  writeLastProvider(store, "  ")
  assert.equal(readLastProvider(store), "")
})

test("picks remembered ids when they still exist", () => {
  assert.equal(pickProvider([{ id: "groq" }, { id: "openai" }], "openai"), "openai")
  assert.equal(pickProvider([{ id: "groq" }], "missing"), "groq")
  assert.equal(pickModel([{ id: "a" }, { id: "b" }], "b"), "b")
  assert.equal(pickModel([{ id: "a" }], "gone"), "a")
})
