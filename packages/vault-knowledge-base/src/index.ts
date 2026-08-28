export {
  Vault,
  createVault,
  setActiveVault,
  getActiveVault,
  writeVaultNote,
  getBacklinks,
  getVaultGraph,
  readVaultFile,
} from "./vault.js"
export { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js"
export { parseWikiLinks, linkTargetKey } from "./wiki.js"
export { renderNote, parseNoteText } from "./render.js"
export { buildVaultGraph, backlinksFor } from "./graph.js"
export { loadVaultNotes, loadNote } from "./scan.js"
export { writeVaultNoteAt, ensureHomeNote } from "./write.js"
export { watchVaultDir, statementFromNote, pushChangeToSink } from "./watch.js"
export { entityFromGraphRecord, writeGraphEntities, mapKind } from "./from-graph.js"
export type {
  VaultEntity,
  VaultNote,
  VaultNode,
  VaultEdge,
  VaultGraph,
  VaultNoteKind,
  VaultOptions,
  VaultChange,
  VaultSyncSink,
  ParsedNote,
  WikiLink,
} from "./types.js"
export type { GraphEntityInput } from "./from-graph.js"
