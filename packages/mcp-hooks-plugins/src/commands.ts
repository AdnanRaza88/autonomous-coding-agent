import { catalog, type ArgKind, type CatalogEntry } from "./catalog.js"
import { invokeMcpTool, listAllMcpTools, listConnectedServers } from "./client.js"
import { McpError, unknownCommand } from "./errors.js"
import { listHooks, runHooks } from "./hooks.js"
import { requestPermission } from "./permission.js"
import type { RunContext, SlashCommandDefinition } from "./types.js"

const commands = new Map<string, SlashCommandDefinition>()

export function registerSlashCommand(cmd: SlashCommandDefinition): void {
  const name = normalizeName(cmd.name)
  if (!name) throw new Error("slash command name required")
  commands.set(name, { ...cmd, name })
}

export function listSlashCommands(): SlashCommandDefinition[] {
  return [...commands.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function clearSlashCommands(): void {
  commands.clear()
}

export async function runSlashCommand(name: string, args: string[], context: RunContext): Promise<void> {
  const key = normalizeName(name)
  const cmd = commands.get(key)
  if (!cmd) throw unknownCommand(name)

  await requestPermission({
    kind: "slash_command",
    action: `/${key}`,
    risk: cmd.risk ?? "medium",
    command: key,
    detail: args.join(" "),
  })

  await runHooks("before-command", {
    point: "before-command",
    command: key,
    runId: context.runId,
    taskId: context.taskId,
    args: { argv: args },
  })

  try {
    await cmd.handler(args, context)
    await runHooks("after-command", {
      point: "after-command",
      command: key,
      runId: context.runId,
      taskId: context.taskId,
      args: { argv: args },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await runHooks("on-error", {
      point: "on-error",
      command: key,
      error: message,
      runId: context.runId,
      taskId: context.taskId,
    })
    throw err
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/^\//, "").toLowerCase()
}

function stash(context: RunContext, value: unknown): void {
  if (!context.extras) context.extras = {}
  const prev = Array.isArray(context.extras.results) ? context.extras.results : []
  context.extras.results = [...prev, value]
}

function emit(context: RunContext, message: string): void {
  context.emit?.(message)
}

async function callOrQueue(
  context: RunContext,
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const result = await invokeMcpTool(serverId, toolName, args)
    stash(context, { serverId, toolName, args, result })
    emit(context, typeof result === "string" ? result : JSON.stringify(result))
  } catch (err) {
    if (err instanceof McpError && (err.code === "unknown_server" || err.code === "unknown_tool")) {
      stash(context, { queued: true, serverId, toolName, args })
      emit(context, `queued ${serverId}.${toolName}`)
      return
    }
    throw err
  }
}

function mapped(entry: CatalogEntry, args: string[], context: RunContext): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!entry.map) return out
  for (const [key, kind] of Object.entries(entry.map) as Array<[string, ArgKind]>) {
    out[key] = resolveArg(kind, args, context)
  }
  return out
}

function resolveArg(kind: ArgKind, args: string[], context: RunContext): unknown {
  if (kind === "cwd") return context.cwd
  if (kind === "path") return args[0] ?? ""
  if (kind === "first") return args[0] ?? ""
  if (kind === "rest") return args.slice(args.length > 1 ? 1 : 0).join(" ")
  if (kind === "goal") return args.join(" ") || context.spec?.goal
  if (kind === "json") {
    if (!args.length) return {}
    try {
      return JSON.parse(args.join(" "))
    } catch {
      return { input: args.join(" ") }
    }
  }
  return args.join(" ")
}

async function runAction(entry: CatalogEntry, args: string[], context: RunContext): Promise<void> {
  const action = entry.action ?? entry.name
  if (action === "help") {
    const lines = listSlashCommands().map((cmd) => `/${cmd.name} ${cmd.description}`)
    emit(context, lines.join("\n"))
    stash(context, { commands: listSlashCommands().map((cmd) => cmd.name) })
    return
  }
  if (action === "commands") {
    stash(context, listSlashCommands().map((cmd) => cmd.name))
    return
  }
  if (action === "cwd") {
    emit(context, context.cwd)
    stash(context, context.cwd)
    return
  }
  if (action === "cp") {
    await callOrQueue(context, "filesystem", "read_file", { path: args[0] })
    await callOrQueue(context, "filesystem", "write_file", { path: args[1], content: "" })
    return
  }
  if (action === "mcp-list") {
    const servers = listConnectedServers()
    const tools = servers.length ? await listAllMcpTools() : []
    stash(context, { servers, tools })
    return
  }
  if (action === "mcp-call") {
    const [serverId, toolName, ...rest] = args
    let parsed: Record<string, unknown> = {}
    if (rest.length) {
      try {
        parsed = JSON.parse(rest.join(" ")) as Record<string, unknown>
      } catch {
        parsed = { input: rest.join(" ") }
      }
    }
    await callOrQueue(context, serverId, toolName, parsed)
    return
  }
  if (action === "hooks") {
    stash(context, listHooks())
    return
  }
  if (action === "docs") {
    await callOrQueue(context, "filesystem", "search_files", { path: "docs", pattern: args[0] ?? "" })
    return
  }
  if (action === "env") {
    const key = args[0] ?? ""
    if (key && /key|token|secret|password/i.test(key)) {
      stash(context, { redacted: true, key })
      return
    }
    stash(context, { key, value: key ? process.env[key] : Object.keys(process.env).length })
    return
  }
  if (action === "spec") {
    emit(context, context.spec?.goal ?? "")
    stash(context, context.spec ?? null)
    return
  }
  if (action === "constitution") {
    stash(context, context.spec?.constraints ?? {})
    return
  }
  stash(context, {
    action,
    argv: args,
    cwd: context.cwd,
    runId: context.runId,
    taskId: args[0] ?? context.taskId,
    text: args.join(" "),
    goal: args.join(" ") || context.spec?.goal,
  })
}

export function registerBuiltinCommands(): void {
  if (commands.size > 0) return
  for (const entry of catalog) {
    registerSlashCommand({
      name: entry.name,
      description: entry.description,
      risk: entry.risk,
      handler: async (args, context) => {
        if (entry.server && entry.tool) {
          await callOrQueue(context, entry.server, entry.tool, mapped(entry, args, context))
          return
        }
        await runAction(entry, args, context)
      },
    })
  }
}

registerBuiltinCommands()
