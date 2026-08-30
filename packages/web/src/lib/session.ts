const PROVIDER_KEY = "agent-core.last-provider"
const MODEL_KEY = "agent-core.last-model"

export function readLastProvider(storage: Storage): string {
  return storage.getItem(PROVIDER_KEY)?.trim() ?? ""
}

export function readLastModel(storage: Storage): string {
  return storage.getItem(MODEL_KEY)?.trim() ?? ""
}

export function writeLastProvider(storage: Storage, id: string): void {
  const next = id.trim()
  if (!next) {
    storage.removeItem(PROVIDER_KEY)
    return
  }
  storage.setItem(PROVIDER_KEY, next)
}

export function writeLastModel(storage: Storage, id: string): void {
  const next = id.trim()
  if (!next) {
    storage.removeItem(MODEL_KEY)
    return
  }
  storage.setItem(MODEL_KEY, next)
}

export function pickProvider(
  catalog: { id: string }[],
  remembered: string,
  fallback = "groq",
): string {
  if (remembered && catalog.some((row) => row.id === remembered)) return remembered
  if (catalog.some((row) => row.id === fallback)) return fallback
  return catalog[0]?.id ?? fallback
}

export function pickModel(models: { id: string }[], remembered: string): string {
  if (remembered && models.some((row) => row.id === remembered)) return remembered
  return models[0]?.id ?? ""
}
