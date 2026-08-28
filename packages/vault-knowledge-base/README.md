# @agent-core/vault-knowledge-base

Obsidian-compatible project wiki. Graphiti (module 09) stays the queryable graph. This package mirrors the same facts as a folder of Markdown files a person can open in Obsidian or edit in-app.

## Layout

Given a vault root (default project `/vault`):

```
vault/
  Home.md
  modules/
  decisions/
  constraints/
  runs/
  entities/
  attachments/
```

Each note is one entity. YAML frontmatter holds `id`, `title`, `kind`, and any extra properties. Relationships are ordinary `[[wiki links]]`.

## Public API

```ts
import {
  createVault,
  setActiveVault,
  writeVaultNote,
  getBacklinks,
  getVaultGraph,
} from "@agent-core/vault-knowledge-base"

const vault = createVault({ root: "./vault" })
await vault.init()
setActiveVault(vault)

await writeVaultNote({
  id: "decision-sqlite",
  title: "Use SQLite",
  body: "Local-first persistence is a single file.",
  links: ["Memory package"],
  properties: { kind: "decision" },
})

const back = await getBacklinks("decision-sqlite")
const graph = await getVaultGraph()
```

`getVaultGraph()` is the data module 05 should render as a force-directed panel. This package does not ship UI.

## User edits

`vault.startWatching()` watches the folder. Hand edits (in-app writer or Obsidian) emit `VaultChange` and, if a sink is set, call module 09 the same way a user fact edit does:

```ts
const vault = createVault({
  root: "./vault",
  sync: {
    async applyEdit(edit) {
      await applyUserFactEdit(graphiti, {
        statement: edit.statement,
        note: edit.note,
      })
    },
  },
})
vault.startWatching()
```

Writes performed through `writeVaultNote` are ignored by the watcher for a short window so the agent does not echo its own notes back into Graphiti.

## Graphiti mirror

```ts
import { writeGraphEntities, entityFromGraphRecord } from "@agent-core/vault-knowledge-base"

await writeGraphEntities((entity) => vault.writeVaultNote(entity), [
  { id: "mod-providers", name: "Provider layer", kind: "module", text: "OpenAI-compatible adapters." },
])
```

## Run / test

```
npx tsx --test src/**/*.test.ts
```

From the monorepo root:

```
npm test -w @agent-core/vault-knowledge-base
```

Tests write under the OS temp directory and do not need Obsidian or Docker.

## Out of scope

Obsidian plugins, Canvas, Bases, Sync, and the in-app graph renderer. Those stay with Obsidian itself or with module 05.
