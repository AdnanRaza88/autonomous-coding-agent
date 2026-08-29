import assert from "node:assert/strict"
import { test } from "node:test"
import { draftFromCatalog, needsOnboarding, providerRequiresKey, readyProvider } from "./onboarding.ts"

test("needsOnboarding is true until a key or local runtime is stored", () => {
  assert.equal(needsOnboarding([]), true)
  assert.equal(needsOnboarding([{ id: "groq", baseUrl: "", model: "", contextWindow: 1, hasKey: false }]), true)
  assert.equal(needsOnboarding([{ id: "groq", baseUrl: "", model: "", contextWindow: 1, hasKey: true }]), false)
  assert.equal(needsOnboarding([{ id: "ollama", baseUrl: "", model: "", contextWindow: 1, hasKey: false }]), false)
})

test("providerRequiresKey skips ollama", () => {
  assert.equal(providerRequiresKey("groq"), true)
  assert.equal(providerRequiresKey("openai"), true)
  assert.equal(providerRequiresKey("ollama"), false)
})

test("readyProvider matches the selected id only when usable", () => {
  const saved = [
    { id: "groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama", contextWindow: 8, hasKey: true },
    { id: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt", contextWindow: 8, hasKey: false },
  ]
  assert.equal(readyProvider(saved, "groq")?.id, "groq")
  assert.equal(readyProvider(saved, "openai"), undefined)
})

test("draftFromCatalog fills base URL and first model", () => {
  const draft = draftFromCatalog(
    [{ id: "groq", name: "Groq", defaultBaseUrl: "https://api.groq.com/openai/v1" }],
    [{ id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 128000 }],
    "groq",
  )
  assert.equal(draft.baseUrl, "https://api.groq.com/openai/v1")
  assert.equal(draft.model, "llama-3.3-70b-versatile")
  assert.equal(draft.apiKey, "")
})
