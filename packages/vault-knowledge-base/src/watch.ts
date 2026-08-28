import { watch, type FSWatcher } from "node:fs"
import path from "node:path"
import { isInsideVault, isMarkdownFile } from "./paths.js"
import { loadNote } from "./scan.js"
import type { VaultChange, VaultSyncSink } from "./types.js"

export interface WatchHandle {
  close(): void
}

export function watchVaultDir(
  root: string,
  onChange: (change: VaultChange) => void,
  opts?: { debounceMs?: number; ignore?: (absPath: string) => boolean },
): WatchHandle {
  const debounceMs = opts?.debounceMs ?? 80
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  let closed = false

  const watcher: FSWatcher = watch(root, { recursive: true }, (event, filename) => {
    if (closed || !filename) return
    const abs = path.resolve(root, filename.toString())
    if (!isInsideVault(root, abs)) return
    if (path.basename(abs).startsWith(".")) return
    if (abs.endsWith(".tmp")) return
    if (!isMarkdownFile(abs) && event !== "rename") return
    if (opts?.ignore?.(abs)) return
    const prev = timers.get(abs)
    if (prev) clearTimeout(prev)
    timers.set(
      abs,
      setTimeout(() => {
        timers.delete(abs)
        void emit(root, abs, onChange)
      }, debounceMs),
    )
  })

  watcher.on("error", () => {})

  return {
    close() {
      closed = true
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
      watcher.close()
    },
  }
}

async function emit(root: string, abs: string, onChange: (change: VaultChange) => void): Promise<void> {
  const note = await loadNote(root, abs)
  if (!note) {
    onChange({ path: abs, kind: "unlink" })
    return
  }
  onChange({
    path: note.path,
    noteId: note.id,
    kind: "change",
    note,
  })
}

export function statementFromNote(note: { id: string; title: string; body: string; properties: Record<string, string> }): string {
  const kind = note.properties.kind ?? "entity"
  const excerpt = note.body.replace(/^#\s+.+\n+/, "").trim().slice(0, 800)
  return `${kind} ${note.title}: ${excerpt || note.title}`
}

export async function pushChangeToSink(sink: VaultSyncSink, change: VaultChange): Promise<void> {
  if (!change.note || change.kind === "unlink") return
  await sink.applyEdit({
    statement: statementFromNote(change.note),
    note: `vault:${change.note.path}`,
    noteId: change.note.id,
    path: change.note.path,
  })
}
