import type { ProviderModel, ProviderSummary, SavedProvider } from "../api/contract"

export function needsOnboarding(saved: SavedProvider[]): boolean {
  return !saved.some((row) => row.hasKey || row.id === "ollama")
}

export function providerRequiresKey(id: string): boolean {
  return id !== "ollama"
}

export function readyProvider(
  saved: SavedProvider[],
  providerId: string,
): SavedProvider | undefined {
  return saved.find((row) => row.id === providerId && (row.hasKey || row.id === "ollama"))
}

export function draftFromCatalog(
  providers: ProviderSummary[],
  models: ProviderModel[],
  id: string,
): {
  id: string
  baseUrl: string
  apiKey: string
  model: string
  contextWindow: number
} {
  const catalog = providers.find((p) => p.id === id) ?? providers[0]
  const first = models[0]
  return {
    id: catalog?.id ?? id,
    baseUrl: catalog?.defaultBaseUrl ?? "",
    apiKey: "",
    model: first?.id ?? "",
    contextWindow: first?.contextWindow ?? 128000,
  }
}
