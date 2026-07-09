# Cursor MCP Setup (Local & Cloud Agents)

How to enable Model Context Protocol (MCP) servers for this repo safely. Templates live in `.cursor/mcp.example.json`. **No real credentials are committed** — copy what you need into a gitignored `.cursor/mcp.json` (local) or configure them in the Cursor dashboard (Cloud Agents).

## Golden rules

- Never commit tokens/keys. `.cursor/mcp.json` is gitignored; `.cursor/mcp.example.json` is a template with `${VARS}` placeholders only.
- Prefer **read-only** and **dev/non-production** scopes for anything that touches data.
- Only enable MCP servers you trust. Do not install random/unvetted servers.

## Recommended servers

| Server | Purpose | Local vs Cloud | Secrets needed | Notes |
|--------|---------|----------------|----------------|-------|
| **GitHub** | Issues/PRs/code context | Both | `GITHUB_MCP_PAT` (fine-grained, least-privilege, read-only where possible) | Remote URL server; put the token in the Cursor dashboard for Cloud Agents. |
| **Supabase (dev, read-only)** | Inspect dev schema/data | Both | `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DEV_PROJECT_REF` | **Never point at production.** Use `--read-only` and a dev/branch `--project-ref`. |
| **Playwright / browser** | In-browser verification, visual/responsive/a11y QA | **Local-only** | none | Drives a real browser; best on a local/interactive session. |
| **Figma** (optional) | Design-to-code | Both | `FIGMA_API_KEY` | Only if doing design work; otherwise omit. |
| **Context7** (optional) | Up-to-date library/API docs | Both (cloud-safe) | `CONTEXT7_API_KEY` (optional) | Read-only docs grounding. |

## Local setup (Desktop/IDE)

1. Copy the servers you want from `.cursor/mcp.example.json` into `.cursor/mcp.json` (create it; it is gitignored).
2. Replace `${VARS}` with real values via your shell environment, or let Cursor prompt/read them. Do **not** hardcode secrets in the file.
3. Restart Cursor; open Settings → MCP to confirm the server is connected.

## Cloud Agent setup (dashboard)

Cloud Agents run in an isolated VM and **cannot read your local `.cursor/mcp.json` secrets**. For each MCP that needs a credential:

1. Open the Cursor dashboard → your team/project → **Cloud Agents / Secrets** (a.k.a. the Secrets panel next to the agent chat).
2. Add each secret by name (e.g. `GITHUB_MCP_PAT`, `SUPABASE_ACCESS_TOKEN`, `FIGMA_API_KEY`, `CONTEXT7_API_KEY`). These are injected as environment variables into the agent VM.
3. Configure/enable the MCP server for Cloud Agents in the dashboard MCP settings (this is a **manual dashboard step** — it cannot be fully committed from the repo).
4. Keep production credentials out entirely: only add dev/read-only tokens.

> Manual step summary: **secrets and Cloud-Agent MCP enablement are configured in the Cursor dashboard**, not in git. The repo only carries the safe template and this documentation.

## Which are cloud-safe vs local-only

- **Cloud-safe:** GitHub (read-only PAT), Supabase (dev, read-only), Context7, Figma (read).
- **Local-only (recommended):** Playwright/browser MCP — it needs a browser/display and is best run in an interactive/local session. For Cloud Agents, prefer the built-in browser testing capability instead.

## Keeping production credentials out of the repo

- `.cursor/mcp.json` is gitignored (see `.gitignore`). Never rename it into a tracked file.
- Use dev/branch databases and least-privilege, read-only tokens.
- If a secret is ever committed by accident, rotate it immediately and remove it from history. The repo also has a commit-time secret scanner — do not bypass it.
