import { registerBuiltinCommands } from "./commands.js"

registerBuiltinCommands()

export {
  connectMcpServer,
  disconnectAll,
  disconnectMcpServer,
  getServerConfig,
  invokeMcpTool,
  listAllMcpTools,
  listConfiguredServers,
  listConnectedServers,
  listMcpTools,
  rememberServerConfig,
  setMcpConnector,
} from "./client.js"
export {
  clearSlashCommands,
  listSlashCommands,
  registerBuiltinCommands,
  registerSlashCommand,
  runSlashCommand,
} from "./commands.js"
export { loadMcpConfigFile, loadMcpServersFromConfig, parseMcpConfig } from "./config.js"
export { defaultMcpConfig, defaultMcpServers } from "./defaults.js"
export { McpError } from "./errors.js"
export { clearHooks, listHooks, registerHook, runHooks, unregisterHook } from "./hooks.js"
export {
  addPermissionRule,
  askPermission,
  clearSessionGrants,
  denySession,
  grantAlways,
  grantServerSession,
  grantSession,
  listPermissionRules,
  matchRule,
  permissionKey,
  removePermissionRule,
  requestPermission,
  revokeGrants,
  setPermissionHandler,
} from "./permission.js"
export type {
  HookContext,
  HookFn,
  HookPoint,
  LiveMcpSession,
  McpConfigFile,
  McpConnector,
  McpServerConfig,
  McpTool,
  PermissionDecision,
  PermissionHandler,
  PermissionKind,
  PermissionRequest,
  PermissionRisk,
  PermissionRule,
  PermissionScope,
  RunContext,
  SlashCommandDefinition,
} from "./types.js"
