# Phase 1 — Research: MCPs, Plugins, Hooks, Skills (Scored)

> All scores based on live web research conducted 2026-07-20. URLs and dates verified.
> Scoring rubric: each criterion scored 0–5, then multiplied by weight. Max possible = 75.

---

## Scoring Rubric

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Stack fit | ×3 | React/TS/Vite/Cloudflare/Prisma/Supabase/Clerk/Gemini |
| Solves named pain point | ×3 | Maps to pain points #1–#5 |
| Token/context cost | ×2 | Always-loaded is expensive; on-demand is cheap |
| Maintenance signal | ×2 | Last commit, issue responsiveness, publisher |
| Security posture | ×2 | Credential scope, write access, namespace |
| Redundancy with existing | ×2 | Negative score if overlaps `.claude/skills/` or `.agents/skills/` |

---

## A. MCP Server Candidates

### 1. Context7 (Upstash) — `@upstash/context7-mcp`

**Source:** [github.com/upstash/context7](https://github.com/upstash/context7) | **Available in:** `claude-plugins-official` marketplace (already cached locally)
**Transport:** `npx -y @upstash/context7-mcp` (stdio)
**Auth:** None required (free tier)
**Last updated:** Active development, weekly releases

**What it does:** Pulls version-specific documentation and code examples from source repositories into LLM context. Resolves library names, queries docs.

**Why it matters for PANaCEa:** The codebase uses Prisma 7.7, React 19.2, Vite 6.2, Cloudflare Pages Functions — all fast-moving APIs where training data is stale. Context7 solves the "AI uses deprecated API" problem.

| Criterion | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| Stack fit | 5 | 15 | Directly serves React, Prisma, Vite, Cloudflare docs |
| Pain point | 4 | 12 | Addresses #2 (stale knowledge causing edge-runtime bugs) |
| Token cost | 5 | 10 | On-demand only — zero always-on cost. Tool schemas ~500t |
| Maintenance | 5 | 10 | Upstash-maintained, active, widely adopted |
| Security | 5 | 10 | No credentials, read-only, no write scope |
| Redundancy | 4 | 8 | cf-edge-api skill covers patterns but not live docs |
| **Total** | | **65/75** | |

**Security read:** No credentials requested. No write access. Read-only HTTP fetch of public docs. Safe.

---

### 2. Supabase MCP — `mcp.supabase.com/mcp`

**Source:** [supabase.com/docs/guides/getting-started/mcp](https://supabase.com/docs/guides/getting-started/mcp) | **Available in:** `claude-plugins-official` marketplace
**Transport:** HTTP (`https://mcp.supabase.com/mcp`)
**Auth:** Supabase access token (scoped per-project)
**Last updated:** Active development by Supabase team

**What it does:** Run SQL queries, manage migrations, inspect RLS policies, manage storage/auth. Supports read-only mode, project-scoped mode, feature groups.

**Why it matters for PANaCEa:** Pain point #1 (99 tables with unenforced RLS). The Supabase MCP can list tables without RLS, inspect policy definitions, and audit `SECURITY DEFINER` functions. Critical for the guardrail the task demands.

**Security concern:** Supabase published ["Defense in Depth for MCP Servers"](https://supabase.com/blog/defense-in-depth-mcp) (Sep 2025) explicitly warning: "Never connect AI agents directly to production data." A documented prompt-injection attack vector exists where malicious text in DB rows can trick the LLM into exfiltrating data. **Mitigation:** Use read-only mode + staging/dev database only. Never service-role key against production.

| Criterion | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| Stack fit | 5 | 15 | PANaCEa is built on Supabase PostgreSQL |
| Pain point | 5 | 15 | Directly addresses #1 (RLS enforcement) |
| Token cost | 4 | 8 | On-demand, but tool schemas ~1.5Kt (many tools) |
| Maintenance | 5 | 10 | First-party, Supabase team maintained |
| Security | 3 | 6 | Read-only mode available; service-role key = root. Must scope carefully |
| Redundancy | 3 | 6 | `prisma-data-integrity` + `supabase` skill cover patterns but not live introspection |
| **Total** | | **60/75** | |

**Security read:** Must use read-only mode. Must NOT use `SUPABASE_SERVICE_ROLE_KEY` against production. Recommend: connect to a staging/dev Supabase project only. The hosted MCP endpoint (`mcp.supabase.com`) uses OAuth project-scoping, which is safer than raw key.

---

### 3. Sentry MCP — `getsentry/sentry-mcp`

**Source:** [github.com/getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp) | **Available in:** `claude-plugins-official` marketplace
**Transport:** HTTP (Sentry hosted) or stdio
**Auth:** `SENTRY_AUTH_TOKEN` (already in `.env`)
**Last updated:** Active, Sentry team maintained

**What it does:** Pull error reports, stack traces, search issues by fingerprint, analyze production errors. Claude Code plugin provides auto-delegation subagent.

**Why it matters for PANaCEa:** Pain point #2 (shipping something broken). Sentry is already in the stack (`@sentry/react` 10.34). The MCP lets Claude pull real production errors and trace them to code.

| Criterion | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| Stack fit | 4 | 12 | Sentry already integrated in the codebase |
| Pain point | 4 | 12 | Addresses #2 (shipping broken code) — see prod errors directly |
| Token cost | 4 | 8 | On-demand, ~800t tool schemas |
| Maintenance | 5 | 10 | First-party, Sentry team |
| Security | 4 | 8 | Read-only by default; auth token already exists in .env |
| Redundancy | 4 | 8 | No existing coverage for production error introspection |
| **Total** | | **58/75** | |

**Security read:** Uses existing `SENTRY_AUTH_TOKEN`. Read-only operations (listing issues, traces). No write scope needed. Safe.

---

### 4. Chrome DevTools MCP — `chrome-devtools-mcp`

**Source:** [github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | **Available in:** `claude-plugins-official` marketplace (already cached)
**Transport:** `npx chrome-devtools-mcp@latest` (stdio)
**Auth:** None
**Last updated:** v0.19.0, active (Google/Chrome team)

**What it does:** Browser automation, DOM inspection, screenshots, JavaScript execution, performance profiling. Connects to Chrome via DevTools Protocol.

**Why it matters for PANaCEa:** Debug visual bugs, test responsive layouts, inspect runtime errors in the browser. Already has permission entries in `settings.local.json`.

| Criterion | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| Stack fit | 3 | 9 | Useful for any web app, not stack-specific |
| Pain point | 3 | 9 | General debugging — not a named pain point |
| Token cost | 3 | 6 | Tool schemas ~1.2Kt, loaded on-demand |
| Maintenance | 5 | 10 | Google/Chrome DevTools team maintained |
| Security | 5 | 10 | No credentials, local Chrome instance only |
| Redundancy | 4 | 8 | Playwright already used for E2E; but DevTools gives live inspection |
| **Total** | | **52/75** | |

**Security read:** No external credentials. Launches local Chrome. Safe but heavy for the value.

---

### 5. Prisma MCP — `prisma/mcp`

**Source:** [github.com/prisma/mcp](https://github.com/prisma/mcp) | **Available in:** MCP registry
**Transport:** HTTP (Prisma hosted) or stdio
**Auth:** Prisma API key (for Prisma Postgres)
**Last updated:** Active, Prisma team

**What it does:** Introspect Prisma Postgres databases, manage migrations, spin up instances. **Note: designed for Prisma Postgres (their hosted service), not arbitrary PostgreSQL.**

**Why it's NOT recommended for PANaCEa:** PANaCEa uses Supabase PostgreSQL with Prisma ORM — not Prisma Postgres. The Prisma MCP introspects Prisma Postgres instances by ID, which doesn't apply here. Supabase MCP is the correct choice.

| Criterion | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| Stack fit | 2 | 6 | Uses Prisma ORM but not Prisma Postgres (hosted) |
| Pain point | 2 | 6 | Migration management useful, but doesn't match our DB host |
| Token cost | 3 | 6 | On-demand |
| Maintenance | 5 | 10 | First-party Prisma |
| Security | 3 | 6 | Requires Prisma API key — another credential |
| Redundancy | 2 | 4 | `prisma-data-integrity` skill covers patterns |
| **Total** | | **38/75** | **REJECT** |

---

### 6. PostgreSQL MCP (crystaldba/postgres-mcp) — `postgres-mcp`

**Source:** [github.com/crystaldba/postgres-mcp](https://github.com/crystaldba/postgres-mcp)
**Transport:** stdio
**Auth:** `DATABASE_URL` (read-only mode configurable)
**Last updated:** Active

**What it does:** Read-only PostgreSQL schema introspection and SQL execution. Configurable read/write access.

**Why it's NOT recommended over Supabase MCP:** PANaCEa's database is on Supabase. The Supabase MCP already provides SQL execution + RLS policy inspection + migration management. Adding a raw Postgres MCP would be redundant and would require a separate `DATABASE_URL` credential. The `supabase` skill already covers RLS audit patterns.

| Criterion | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| Stack fit | 4 | 12 | PostgreSQL is the DB |
| Pain point | 3 | 9 | Schema introspection useful |
| Token cost | 3 | 6 | On-demand |
| Maintenance | 4 | 8 | Community-maintained (crystaldba) |
| Security | 3 | 6 | Requires DATABASE_URL — prod connection string risk |
| Redundancy | 1 | 2 | Supabase MCP + prisma-data-integrity skill cover this |
| **Total** | | **43/75** | **REJECT** (redundant with Supabase MCP) |

---

### 7. Cloudflare MCP — `cloudflare/mcp-server-cloudflare`

**Source:** [github.com/cloudflare/mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare)
**Transport:** stdio (local Docker-based servers)
**Auth:** Cloudflare API token
**Last updated:** Active, Cloudflare team

**What it does:** Read Cloudflare account configurations, Workers, KV, R2, D1, analytics. Multiple sub-servers for different Cloudflare services.

**Why it's a MAYBE:** Useful for inspecting production KV namespaces, Workers analytics, deployment status. But requires a Cloudflare API token with read scope. The value is moderate — most Cloudflare debugging is done via `wrangler` CLI which is already available.

| Criterion | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| Stack fit | 5 | 15 | Cloudflare Pages is the deploy target |
| Pain point | 3 | 9 | Helps debug edge issues, but wrangler CLI already covers most |
| Token cost | 3 | 6 | On-demand, but multiple server schemas |
| Maintenance | 5 | 10 | First-party Cloudflare |
| Security | 3 | 6 | Requires CF API token; moderate scope |
| Redundancy | 2 | 4 | cf-edge-api skill + wrangler CLI cover patterns |
| **Total** | | **50/75** | **DEFER** — useful but not urgent; wrangler CLI covers 80% |

---

### 8. GitHub MCP — `github.com/Copilot`

**Source:** `claude-plugins-official` marketplace | [github.com](https://github.com)
**Transport:** HTTP (`api.githubcopilot.com/mcp/`)
**Auth:** `GITHUB_PERSONAL_ACCESS_TOKEN`
**Last updated:** Active, GitHub team

**What it does:** Repository management, issues, PRs, code search, reviews.

**Why it's a MAYBE:** Solo developer — `gh` CLI already covers most GitHub operations. The MCP would add PR search and code search across repos. But the repo doesn't have many PRs (solo dev), and `gh` is already in the toolchain.

| Criterion | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| Stack fit | 3 | 9 | Uses GitHub for repo |
| Pain point | 2 | 6 | Not a named pain point |
| Token cost | 3 | 6 | On-demand |
| Maintenance | 5 | 10 | First-party GitHub |
| Security | 3 | 6 | Requires PAT — user doesn't have one yet |
| Redundancy | 2 | 4 | `gh` CLI already covers most operations |
| **Total** | | **41/75** | **DEFER** — `gh` CLI sufficient for now |

---

## B. Plugin Candidates

### 1. Context7 Plugin (from `claude-plugins-official`)

**Already cached** at `~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/context7/`
**MCP config:** `npx -y @upstash/context7-mcp`

Installing the plugin would: register the MCP server, add slash commands for doc lookup, and enable auto-discovery. Simplest path to getting Context7 working.

**Recommendation:** Install via plugin system rather than manual `.mcp.json` edit.

### 2. Superpowers Plugin (from `superpowers-marketplace`)

**Already cached** at `~/.claude/plugins/marketplaces/superpowers-marketplace/superpowers/6.1.1/`
**Author:** Jesse Vincent (obra) — well-known in the Claude Code ecosystem

**What it provides:** TDD enforcement, systematic debugging, subagent-driven development, brainstorming, writing skills. Has a `SessionStart` hook that teaches the agent the methodology.

**Overlap analysis:** Many of its skills (TDD, debugging, code review) overlap with `.agents/skills/` equivalents:
- `sp-test-driven-development` ↔ existing TDD patterns
- `sp-systematic-debugging` ↔ `debug-reproduce-isolate`
- `sp-requesting-code-review` / `sp-receiving-code-review` ↔ no equivalent (GAP)
- `sp-writing-plans` ↔ `sprint-pipeline`
- `sp-finishing-a-development-branch` ↔ no equivalent (GAP)

**Token cost:** Superpowers loads a `using-superpowers` skill on every SessionStart. ~2Kt always-on overhead.

**Recommendation:** **DEFER.** The always-on overhead is real, and much of the content overlaps with existing skills. The code-review skills are the only unique value, and those can be authored as a lightweight skill instead.

### 3. Sentry Plugin (from `claude-plugins-official`)

Bundles the Sentry MCP + a subagent that auto-delegates on Sentry-related queries. Would be simpler than manually configuring the MCP.

**Recommendation:** Install if Sentry MCP is approved.

---

## C. Hook Patterns Researched

### Claude Code Hook System (2026-07-20)
**Source:** [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)

Key findings:
- Hooks fire at: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`, `PreCompact`, `PostCompact`, `FileChanged`
- `PreToolUse` can return `permissionDecision: "deny"` to block tool calls
- The `if` field pre-filters before spawning: `Bash(rm *)` only fires for matching commands
- Input arrives as JSON on stdin with `tool_name`, `tool_input` fields
- Hooks are configured in `.claude/settings.json` (committed) or `.claude/settings.local.json` (local)
- `jq` is the standard tool for JSON parsing in hook scripts
- `async: false` ensures blocking hooks complete before proceeding

### Session Handoff Patterns
**Source:** [allaboutcoding.ghinda.com](https://allaboutcoding.ghinda.com/adding-session-handoff-to-superpowers-ruby/), [github.com/anthropics/claude-code/issues/11455](https://github.com/anthropics/claude-code/issues/11455)

- Best practice: Use `Stop` or `SessionEnd` hook to write a structured markdown handoff
- Handoff should capture: git state, changed files, half-done work, next command to run
- Read handoff in `SessionStart` hook for context reconstruction
- The existing `session-start.sh` script does half this job (git sync + recent commits) but isn't wired

### Dependency Hallucination Defense
**Source:** [github.com/anthropics/claude-code/issues/39421](https://github.com/anthropics/claude-code/issues/39421), [safedep.io](https://safedep.io/malicious-npm-packages-claude-code-hooks)

- Pattern: `PreToolUse` hook intercepts `npm install <pkg>` commands
- Queries npm registry API (`registry.npmjs.org/<pkg>`) to verify package exists
- Blocks if package not found or has suspiciously low downloads
- Real attack vector documented: "openmatrix" package injected Claude Code commands via postinstall

---

## D. Skill Gap Analysis

Evaluated against the 6 gaps in the task spec, cross-referenced with Phase 0 inventory:

| Gap | Exists in `.claude/skills/`? | Exists in `.agents/skills/`? | Verdict |
|-----|-----|-----|---------|
| Session handoff | `session-orchestration` (session flow, not handoff) | `wrap-up` (session end handoff) | **PARTIAL** — `wrap-up` covers end-of-session but not reconstruction. Need a `/resume` skill/command. |
| Migration safety | No | `panacea-prisma-data-integrity` (covers schema patterns) | **GAP** — No hook or skill that mechanically blocks schema.prisma changes without migration files |
| Edge-runtime lint | `cf-edge-api` (patterns) | `panacea-edge-endpoints` (patterns) | **GAP** — No mechanical detection of Node-only APIs in `functions/` |
| Secret-shape detection | No | `security-and-privacy-audit` (general security) | **GAP** — No skill/hook for Clerk/Supabase/Gemini key format recognition (though safety-guard.sh has patterns) |
| Scoped typecheck | No | `panacea-verify` (chooses commands) | **GAP** — No tool to typecheck only changed files + dependents. The existing command runs full-project (OOM risk) |
| Sprint resumption | `sprint-pipeline` | `panacea-session-pipeline` | **PARTIAL** — Both cover sprint execution but not resumption from incomplete state |

---

## E. Rejected Candidates

| Candidate | Score | Reason Rejected |
|-----------|-------|-----------------|
| Prisma MCP (`prisma/mcp`) | 38/75 | Designed for Prisma Postgres hosted, not Supabase. Doesn't match our DB host. |
| PostgreSQL MCP (`crystaldba/postgres-mcp`) | 43/75 | Redundant with Supabase MCP. Another DATABASE_URL credential. |
| GitHub MCP | 41/75 | `gh` CLI already covers operations. User has no PAT yet. |
| Cloudflare MCP | 50/75 | Wrangler CLI covers 80%. Defer to backlog. |
| Superpowers plugin | N/A | Always-on token overhead (~2Kt). 60% overlap with existing skills. Code-review skills are only unique value. |
| Playwright MCP | 45/75 | Playwright already configured in the project for E2E. MCP would add browser automation but not worth the overhead. |
| Vercel MCP | 35/75 | Cloudflare Pages is primary deploy target. Vercel is "also in play" but not actively used. |
| Linear/Asana/Jira MCPs | 25/75 | Solo developer with no project tracker. |
| Slack/Discord/Telegram MCPs | 20/75 | No team communication needs. |

---

## F. Final Recommendations Summary

### Install (3 MCPs):
1. **Context7** — score 65/75, zero-cost docs lookup, no credentials
2. **Supabase MCP** — score 60/75, read-only, RLS audit capability (pain point #1)
3. **Sentry MCP** — score 58/75, production error introspection (pain point #2)

### Defer (2 MCPs):
4. Cloudflare MCP — backlog item
5. Chrome DevTools MCP — backlog item (already has permission entries)

### Don't install:
- Prisma MCP, PostgreSQL MCP, GitHub MCP, Superpowers plugin

### Skills to author (6):
1. `session-resume` — context reconstruction from repo state
2. `migration-safety` — schema.prisma → migration file tripwire patterns
3. `edge-runtime-guard` — Node-only API detection in `functions/`
4. `secret-detector` — Clerk/Supabase/Gemini key format patterns
5. `scoped-typecheck` — changed-files-only typecheck workflow
6. `adversarial-review` — solo-dev self-review checklist

### Skills to retire/merge:
- RETIRE: `desktop-commander-deploy` (unused tool)
- MERGE: `sprint-pipeline` + `panacea-component-sprint` → unified `sprint-workflow`
