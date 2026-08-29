import { filterCommands, parseComposer } from "../lib/filter"
import type { SlashCommandInfo } from "../api/contract"

export function CommandPalette(props: {
  query: string
  commands: SlashCommandInfo[]
  onPick: (cmd: SlashCommandInfo) => void
  onClose: () => void
}) {
  const parsed = parseComposer(props.query)
  const matches = filterCommands(props.commands, parsed.query)
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-36 z-20 flex justify-center px-4">
      <div className="glass pointer-events-auto w-full max-w-xl rounded-lg p-2">
        <div className="solid max-h-72 overflow-auto rounded-md">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">No commands match</p>
          ) : (
            <ul>
              {matches.map((cmd) => (
                <li key={cmd.name}>
                  <button
                    className="flex w-full items-baseline justify-between px-3 py-2 text-left text-sm hover:bg-paper"
                    onClick={() => props.onPick(cmd)}
                  >
                    <span className="font-mono">/{cmd.name}</span>
                    <span className="ml-4 text-xs text-muted">{cmd.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="mt-1 px-2 text-xs text-muted" onClick={props.onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
