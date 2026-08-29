import { requestPermission } from "./permission.js"
import type { HookContext, HookFn, HookPoint } from "./types.js"

type Entry = { name: string; fn: HookFn }

const registry = new Map<HookPoint, Entry[]>()

export function registerHook(point: HookPoint, name: string, fn: HookFn): void {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("hook name required")
  const list = registry.get(point) ?? []
  const existing = list.findIndex((entry) => entry.name === trimmed)
  if (existing >= 0) list[existing] = { name: trimmed, fn }
  else list.push({ name: trimmed, fn })
  registry.set(point, list)
}

export function unregisterHook(point: HookPoint, name: string): boolean {
  const list = registry.get(point)
  if (!list) return false
  const next = list.filter((entry) => entry.name !== name)
  registry.set(point, next)
  return next.length !== list.length
}

export function listHooks(point?: HookPoint): Array<{ point: HookPoint; name: string }> {
  const points = point ? [point] : ([...registry.keys()] as HookPoint[])
  const out: Array<{ point: HookPoint; name: string }> = []
  for (const p of points) {
    for (const entry of registry.get(p) ?? []) out.push({ point: p, name: entry.name })
  }
  return out
}

export function clearHooks(): void {
  registry.clear()
}

export async function runHooks(point: HookPoint, context: HookContext): Promise<void> {
  const list = registry.get(point) ?? []
  for (const entry of list) {
    await requestPermission({
      kind: "hook",
      action: `hook:${point}:${entry.name}`,
      risk: "low",
      hookName: entry.name,
      detail: point,
    })
    try {
      await entry.fn({ ...context, point, hookName: entry.name })
    } catch (err) {
      if (point === "on-error") continue
      const message = err instanceof Error ? err.message : String(err)
      await runHooks("on-error", {
        point: "on-error",
        error: message,
        hookName: entry.name,
        taskId: context.taskId,
        runId: context.runId,
      })
      throw err
    }
  }
}
