import path from "node:path"
import { backlinksFor, buildVaultGraph } from "./graph.js"
import { loadNote, loadVaultNotes } from "./scan.js"
import { ensureHomeNote, seedKindFolders, writeVaultNoteAt } from "./write.js"
import { pushChangeToSink, watchVaultDir, type WatchHandle } from "./watch.js"
import type {
  VaultChange,
  VaultEntity,
  VaultGraph,
  VaultNote,
  VaultOptions,
  VaultSyncSink,
} from "./types.js"

export class Vault {
  readonly root: string
  private sink?: VaultSyncSink
  private watcher?: WatchHandle
  private readonly selfWrites = new Map<string, number>()
  private readonly listeners = new Set<(change: VaultChange) => void>()
  private readonly debounceMs: number

  constructor(options: VaultOptions) {
    this.root = path.resolve(options.root)
    this.sink = options.sync
    this.debounceMs = options.watchDebounceMs ?? 80
  }

  setSyncSink(sink: VaultSyncSink | undefined): void {
    this.sink = sink
  }

  onChange(listener: (change: VaultChange) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async init(): Promise<void> {
    await seedKindFolders(this.root)
    await ensureHomeNote(this.root)
  }

  async writeVaultNote(entity: VaultEntity): Promise<VaultNote> {
    const absGuess = path.join(this.root, entity.id)
    this.markSelfWrite(absGuess)
    const note = await writeVaultNoteAt(this.root, entity)
    this.markSelfWrite(path.join(this.root, note.path))
    return note
  }

  async readNote(noteId: string): Promise<VaultNote | undefined> {
    const notes = await loadVaultNotes(this.root)
    return notes.find((n) => n.id === noteId || slugEq(n.title, noteId))
  }

  async listNotes(): Promise<VaultNote[]> {
    return loadVaultNotes(this.root)
  }

  async getBacklinks(noteId: string): Promise<string[]> {
    const notes = await loadVaultNotes(this.root)
    return backlinksFor(notes, noteId)
  }

  async getVaultGraph(): Promise<VaultGraph> {
    const notes = await loadVaultNotes(this.root)
    return buildVaultGraph(notes)
  }

  startWatching(): void {
    if (this.watcher) return
    this.watcher = watchVaultDir(
      this.root,
      (change) => {
        void this.handleChange(change)
      },
      {
        debounceMs: this.debounceMs,
        ignore: (abs) => this.isSelfWrite(abs),
      },
    )
  }

  stopWatching(): void {
    this.watcher?.close()
    this.watcher = undefined
  }

  private async handleChange(change: VaultChange): Promise<void> {
    for (const listener of this.listeners) listener(change)
    if (this.sink) {
      try {
        await pushChangeToSink(this.sink, change)
      } catch {
        return
      }
    }
  }

  private markSelfWrite(abs: string): void {
    this.selfWrites.set(path.resolve(abs), Date.now())
  }

  private isSelfWrite(abs: string): boolean {
    const ts = this.selfWrites.get(path.resolve(abs))
    if (!ts) return false
    if (Date.now() - ts > 1500) {
      this.selfWrites.delete(path.resolve(abs))
      return false
    }
    return true
  }
}

function slugEq(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

let active: Vault | undefined

export function createVault(options: VaultOptions): Vault {
  return new Vault(options)
}

export function setActiveVault(vault: Vault | undefined): void {
  active = vault
}

export function getActiveVault(): Vault {
  if (!active) throw new Error("vault is not initialized")
  return active
}

export async function writeVaultNote(entity: VaultEntity): Promise<void> {
  await getActiveVault().writeVaultNote(entity)
}

export async function getBacklinks(noteId: string): Promise<string[]> {
  return getActiveVault().getBacklinks(noteId)
}

export async function getVaultGraph(): Promise<VaultGraph> {
  return getActiveVault().getVaultGraph()
}

export async function readVaultFile(root: string, relPath: string): Promise<VaultNote | null> {
  return loadNote(root, path.join(root, relPath))
}
