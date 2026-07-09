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

## Curated recommendation table

Vet any server with the `mcp-safety-review` skill and `mcp-and-tool-safety.mdc` before enabling. The main risk across all of them is **prompt injection** (untrusted content an agent reads becoming instructions), so prefer read-only + least privilege, and don't chain untrusted reads into write actions.

| MCP | Useful for | Cloud-safe? | Dashboard setup? | Secrets/permissions | Key risks | Recommended default | Enable |
|-----|-----------|-------------|------------------|---------------------|-----------|---------------------|--------|
| **GitHub** (official) | PR/issue/code context, CI status | Yes | Yes (add token as Cloud secret) | Fine-grained PAT, **read-only** scopes | Over-broad token; injection from issue/PR text | Read-only PAT | **Now** |
| **Supabase** (`@supabase/mcp-server-supabase`, official) | Inspect dev schema/data | Yes (read-only) | Yes | `SUPABASE_ACCESS_TOKEN`, dev `--project-ref` | Writing/prod access if misconfigured | `--read-only`, **non-prod** project | **Now** (dev/read-only) |
| **Playwright / browser** (`microsoft/playwright-mcp`, official) | Browser/visual/responsive/a11y QA | **Local-only** (needs a browser) | No (local config) | none | Not a security boundary; can act on pages | Headless, local sessions | **Now** (local); use built-in browser testing for Cloud |
| **Context7** (docs/code search) | Up-to-date library/API docs to reduce hallucination | Yes (read-only) | Optional (key) | `CONTEXT7_API_KEY` (optional) | Low (read-only docs) | Read-only | **Now** (optional) |
| **Sequential Thinking** (`@modelcontextprotocol/server-sequential-thinking`, reference) | Structured multi-step planning scratchpad | Yes | No | none | None (does nothing on its own) | Default | **Optional now** |
| **Figma** (community) | Design-to-code when building from Figma | Yes | Yes (key) | `FIGMA_API_KEY` | Third-party token scope | Read | **Later** (only if design work) |
| **Mermaid** (community) | Render Mermaid diagrams for architecture/docs | Yes | Varies | usually none | Community maintenance/quality varies | N/A | **Later** (nice-to-have) |
| **Excalidraw / "Excalidraw Architect"** (community) | Architecture sketches / diagram canvases | Local-ish (canvas server) | Varies | some variants need API key | Community; some run a local server/websocket | Prefer security-hardened variant | **Later / evaluate** (vet with `mcp-safety-review`) |
| **Filesystem** (reference) | Local file access beyond the workspace | Depends | No | narrow allowed path | Broad FS access = high blast radius | Narrow path only | **Avoid unless needed** |
| Random community DB/browser/"do-everything" MCPs | varies | — | — | often write + secrets | Unvetted supply chain + injection + prod risk | — | **Avoid** |

Notes:
- Only **Sequential Thinking** is added to `.cursor/mcp.example.json` among the "extras" (it needs no secrets and can't take actions). Diagram MCPs (Mermaid/Excalidraw) are intentionally *not* templated to avoid implying endorsement — evaluate per `mcp-safety-review` first.
- "Enable **Now**" = safe to turn on with read-only/dev scope. "Later" = enable when the workflow needs it. "Avoid" = don't enable without a strong, reviewed reason.
- For Cloud Agents, browser work is better served by Cursor's built-in browser testing than by wiring a local Playwright MCP into the VM.
