#!/bin/sh
set -eu

DATA_DIR="${AGENT_CORE_DATA:-/data}"
PORT="${PORT:-3000}"
WEB_ROOT="${AGENT_CORE_WEB_ROOT:-/app/web}"

mkdir -p "$DATA_DIR/workspace"

if [ ! -f "$DATA_DIR/.master.key" ] && [ -z "${AGENT_CORE_MASTER_KEY:-}" ]; then
  umask 077
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32 > "$DATA_DIR/.master.key"
  else
    dd if=/dev/urandom bs=32 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n' > "$DATA_DIR/.master.key"
    echo >> "$DATA_DIR/.master.key"
  fi
  chmod 600 "$DATA_DIR/.master.key" 2>/dev/null || true
fi

if [ ! -f "$DATA_DIR/agent-core.db" ]; then
  printf '%s\n' '{"version":1,"secrets":[],"providers":[],"subagents":[],"runs":[]}' > "$DATA_DIR/agent-core.db"
  chmod 600 "$DATA_DIR/agent-core.db" 2>/dev/null || true
fi

export AGENT_CORE_DATA="$DATA_DIR"
export AGENT_CORE_WEB_ROOT="$WEB_ROOT"
export PORT

cd /app
exec node --import tsx packages/deploy/src/cli.ts
