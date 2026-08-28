import { useState } from "react"
import type { SubagentDraft } from "../api/contract"

const blank = (): SubagentDraft => ({
  id: "",
  name: "",
  systemPromptTemplate: "",
  defaultModel: "",
  maxContextTokens: 32000,
  tools: [],
})

export function SubagentBuilder(props: {
  items: SubagentDraft[]
  onSave: (item: SubagentDraft) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState<SubagentDraft>(blank())
  const [toolsText, setToolsText] = useState("")

  function load(item: SubagentDraft) {
    setForm({ ...item, tools: [...item.tools] })
    setToolsText(item.tools.join(", "))
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 p-6 lg:grid-cols-[1fr_1.2fr]">
      <section>
        <h1 className="text-xl font-medium">Definitions</h1>
        <ul className="mt-4 divide-y divide-[var(--line)]">
          {props.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3">
              <button className="text-left text-sm" onClick={() => load(item)}>
                <span className="font-medium">{item.name}</span>
                <span className="ml-2 font-mono text-xs text-muted">{item.id}</span>
              </button>
              <button className="text-xs text-muted" onClick={() => void props.onDelete(item.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-medium">{form.id ? "Edit" : "New definition"}</h2>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const tools = toolsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
            void props.onSave({ ...form, tools })
          }}
        >
          <Field label="Id">
            <input
              className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              required
            />
          </Field>
          <Field label="Name">
            <input
              className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Default model">
            <input
              className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
              value={form.defaultModel}
              onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
              required
            />
          </Field>
          <Field label="Context window">
            <input
              type="number"
              min={1024}
              className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
              value={form.maxContextTokens}
              onChange={(e) => setForm({ ...form, maxContextTokens: Number(e.target.value) })}
              required
            />
          </Field>
          <Field label="Tools">
            <input
              className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm"
              value={toolsText}
              onChange={(e) => setToolsText(e.target.value)}
              placeholder="read, write, edit"
            />
          </Field>
          <Field label="System prompt">
            <textarea
              className="h-40 w-full rounded border border-line bg-paper px-2 py-1.5 font-mono text-xs"
              value={form.systemPromptTemplate}
              onChange={(e) => setForm({ ...form, systemPromptTemplate: e.target.value })}
              required
            />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--paper)]">
              Save
            </button>
            <button type="button" className="text-xs text-muted" onClick={() => load(blank())}>
              Clear
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      <span className="mb-1 block">{props.label}</span>
      {props.children}
    </label>
  )
}
