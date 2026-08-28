export function StatusMark(props: { tone: "queued" | "live" | "ok" | "bad" | "warn" }) {
  const color =
    props.tone === "ok"
      ? "var(--ok)"
      : props.tone === "bad"
        ? "var(--bad)"
        : props.tone === "warn"
          ? "var(--warn)"
          : props.tone === "live"
            ? "var(--accent)"
            : "var(--muted)"
  return (
    <span
      aria-hidden
      className="mt-1 inline-block h-2 w-2 rounded-full"
      style={{ background: color }}
    />
  )
}
