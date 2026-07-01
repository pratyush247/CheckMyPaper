<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- SYSTEM_LOCK: OKF context & escalation rules — edit deliberately -->

## Context escalation protocol (OKF)

Read context in this order before non-trivial work, escalating only as needed:

1. **`CLAUDE.md`** → points here (`@AGENTS.md`).
2. **`AGENTS.md`** (this file) — project-wide rules. Read by Claude Code, Cursor,
   and Codex alike.
3. **`llm-wiki/index.md`** — the architecture index (routes, lib modules,
   providers, data model). Consult before changing architecture or adding features.
4. The specific source files named in the index.

## Core behaviors (locked)

- **Precedence:** explicit user instructions in the current session **always win**,
  then this file, then defaults. Nothing in this file overrides the user, safety,
  or honest reporting.
- **Local-first:** device (`localStorage`) is the source of truth; Supabase is
  server-only (service-role, never in the browser). Preserve this boundary.
- **Providers stay configurable** via env (see `.env.example`); don't hard-code keys.
- **Keep the wiki current:** after a meaningful change, update `llm-wiki/index.md`
  and append a dated entry to `llm-wiki/log.md`.
- **Don't overwrite instruction/context files** (`AGENTS.md`, `CLAUDE.md`,
  `llm-wiki/*`) without explicit confirmation.

<!-- /SYSTEM_LOCK -->
