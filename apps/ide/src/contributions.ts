import { paletteCommands, vscodeCommandContributions } from "./commands.js"
import { THEME_PAIR } from "./theme.js"

export function extensionManifest(publisher = "agent-core"): Record<string, unknown> {
  const commands = vscodeCommandContributions()
  return {
    name: "agent-core-ide",
    displayName: "Agent Core",
    description: "Native sidebar for the Agent Core coding agent",
    publisher,
    version: "0.1.0",
    engines: { vscode: "^1.96.0" },
    categories: ["Other"],
    activationEvents: ["onStartupFinished", "onView:agentCore.sidebar"],
    main: "./out/extension.js",
    contributes: {
      viewsContainers: {
        activitybar: [
          {
            id: "agent-core",
            title: "Agent Core",
            icon: "media/activitybar.svg",
          },
        ],
      },
      views: {
        "agent-core": [
          {
            type: "webview",
            id: "agentCore.sidebar",
            name: "Agent",
          },
        ],
      },
      commands,
      keybindings: [
        { command: "agent-core.openSidebar", key: "ctrl+shift+a", mac: "cmd+shift+a" },
        { command: "agent-core.focusComposer", key: "ctrl+shift+.", mac: "cmd+shift+." },
        { command: "agent-core.acceptDiff", key: "ctrl+shift+enter", mac: "cmd+shift+enter" },
        { command: "agent-core.rejectDiff", key: "ctrl+shift+backspace", mac: "cmd+shift+backspace" },
      ],
      menus: {
        commandPalette: commands.map((c) => ({ command: c.command })),
        "editor/title": [
          { command: "agent-core.acceptDiff", when: "agentCore.pendingDiff", group: "navigation" },
          { command: "agent-core.rejectDiff", when: "agentCore.pendingDiff", group: "navigation" },
        ],
      },
      themes: THEME_PAIR.map((t) => ({
        id: t.id,
        label: t.label,
        uiTheme: t.uiTheme,
        path: t.path,
      })),
      configuration: {
        title: "Agent Core",
        properties: {
          "agentCore.backendPort": { type: "number", default: 3000 },
          "agentCore.proxyPort": { type: "number", default: 17300 },
          "agentCore.spaRoot": { type: "string", default: "" },
        },
      },
    },
  }
}

export function sidebarHtml(iframeUrl: string): string {
  const safe = escapeAttr(iframeUrl)
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://127.0.0.1:* http://localhost:*; style-src 'unsafe-inline';" />
    <style>
      html, body, iframe { margin: 0; padding: 0; height: 100%; width: 100%; border: 0; background: transparent; }
    </style>
  </head>
  <body>
    <iframe id="agent-core-frame" src="${safe}" allow="clipboard-read; clipboard-write"></iframe>
  </body>
</html>`
}

export function slashCount(): number {
  return paletteCommands().length
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}
