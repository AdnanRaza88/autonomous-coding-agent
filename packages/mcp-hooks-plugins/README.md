# @agent-core/mcp-hooks-plugins

MCP client, permission gate, lifecycle hooks, and slash commands for Agent Core.

This package does not implement filesystem, git, memory, or browser tools. It connects to MCP servers (stdio or URL) through `@modelcontextprotocol/sdk` and puts every invocation behind one permission function.

## Public API

```ts
connectMcpServer(id, config)
listMcpTools(serverId)
invokeMcpTool(serverId, toolName, args)

requestPermission(action)

registerHook(point, name, fn)
runHooks(point, context)

registerSlashCommand(cmd)
listSlashCommands()
runSlashCommand(name, args, context)
```

## Config

Same shape for built-in and user-added servers:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "."]
    },
    "automem": { "url": "http://127.0.0.1:8000/mcp" },
    "graphiti": { "url": "http://127.0.0.1:8001/mcp" }
  }
}
```

`loadMcpServersFromConfig(path)` reads that file. Omit the path to seed the four default servers. Connecting still happens through `connectMcpServer`.

## Permission

`requestPermission` is the only gate. Wire the UI with `setPermissionHandler`.

- no handler + `risk: "low"` → allow
- no handler + medium/high → deny
- handler may return `true`, `false`, `"allow"`, `"deny"`, or `"allow_session"`
- session and always-grants skip the next prompt for the same key

Tool calls, slash commands, and hooks all go through this function.

## Hooks

Points: `before-task`, `after-task`, `before-tool-call`, `after-tool-call`, `on-error`, `before-command`, `after-command`.

## Slash commands

`registerBuiltinCommands()` (called on package import) installs 60+ commands covering files, git, tests, orchestrator control, SDD, subagents, deploy, memory, and MCP. Handlers call MCP tools when the matching server is connected; otherwise they queue a structured action on `context.extras.results`.

## Tests

```sh
npm test --workspace=@agent-core/mcp-hooks-plugins
```
