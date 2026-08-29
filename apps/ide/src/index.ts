export { AgentServeManager } from "./serve-manager.js"
export { startSpaProxy } from "./spa-proxy.js"
export { DiffBridge } from "./diff.js"
export { createIdeHost, guessSpaRoot } from "./host.js"
export { extensionManifest, sidebarHtml, slashCount } from "./contributions.js"
export {
  BUILTIN_SLASH,
  HOST_COMMANDS,
  commandIdForSlash,
  paletteCommands,
  parseSlashInvocation,
  vscodeCommandContributions,
} from "./commands.js"
export { emptyStatus, foldEvent, statusBarText, statusFromTasks } from "./status.js"
export { DARK_COLORS, LIGHT_COLORS, THEME_PAIR, nextTheme, themeForKind } from "./theme.js"
export { encodeWorkspaceKey, decodeWorkspaceKey, sidebarPath } from "./workspace.js"
export { DEFAULT_BACKEND_PORT, DEFAULT_PROXY_PORT, LOOPBACK, loopbackOrigin, nextFreePort, portFree } from "./ports.js"
export { healthUrl, probeHttp, waitHealthy } from "./health.js"
export { IdeShellError, isIdeShellError } from "./errors.js"
export type {
  AgentServeHandle,
  AppliedChange,
  DiffOpenRequest,
  IdeHostOptions,
  ProposedChange,
  RunPhase,
  ServeState,
  SidebarTarget,
  SlashPaletteCommand,
  StatusSnapshot,
  ThemePair,
} from "./types.js"
