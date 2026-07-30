# MCP Server Configuration

> 4 MCP servers configured in `.mcp.json` (project-scoped, travels with the repo)

---

## Active MCP Servers

### 1. AIDesigner (pre-existing)

| Field | Value |
|-------|-------|
| **Config** | `.mcp.json` → `aidesigner` |
| **Transport** | HTTP (`https://api.aidesigner.ai/api/v1/mcp`) |
| **Auth** | None (API key handled by AIDesigner platform) |
| **Scope** | Project |
| **What it does** | AI-powered frontend design generation |
| **Can touch** | Generates design artifacts via AIDesigner API |
| **Cannot touch** | No direct code/filesystem/database access |
| **Revoke** | Remove `aidesigner` entry from `.mcp.json` |

### 2. Context7 (NEW)

| Field | Value |
|-------|-------|
| **Config** | `.mcp.json` → `context7` |
| **Transport** | stdio (`npx -y @upstash/context7-mcp`) |
| **Auth** | None required |
| **Scope** | Project |
| **What it does** | Pulls version-specific library documentation into context |
| **Can touch** | Reads public documentation from npm packages |
| **Cannot touch** | No filesystem, database, or network write access |
| **Revoke** | Remove `context7` entry from `.mcp.json` |
| **Security** | ✅ No credentials. Read-only HTTP. Publisher: Upstash (verified). |

**Why:** PANaCEa uses Prisma 7.7, React 19.2, Vite 6.2, Cloudflare Pages — all fast-moving APIs. Context7 prevents stale-knowledge bugs.

### 3. Sentry (NEW)

| Field | Value |
|-------|-------|
| **Config** | `.mcp.json` → `sentry` |
| **Transport** | HTTP (`https://mcp.sentry.dev/mcp`) |
| **Auth** | `SENTRY_AUTH_TOKEN` (from `.env`, already existed) |
| **Scope** | Project |
| **What it does** | Pull production error reports, stack traces, search issues |
| **Can touch** | Read Sentry issues, traces, events |
| **Cannot touch** | No write/resolve capability (read-only by design) |
| **Revoke** | Remove `sentry` entry from `.mcp.json` |
| **Security** | ✅ Uses existing token. Read-only. Publisher: Sentry (first-party). |

**Why:** Solo developer with no QA — seeing production errors directly lets Claude trace bugs to code without a round-trip.

### 4. Supabase (NEW)

| Field | Value |
|-------|-------|
| **Config** | `.mcp.json` → `supabase` |
| **Transport** | HTTP (`https://mcp.supabase.com/mcp`) |
| **Auth** | OAuth flow (project-scoped, manual approval per session) |
| **Scope** | Project |
| **What it does** | SQL queries, schema introspection, RLS policy audit, migration management |
| **Can touch** | Database schema, queries, RLS policies |
| **Cannot touch** | Configured for **staging/dev only** — never connect to production |
| **Revoke** | Remove `supabase` entry from `.mcp.json` + revoke OAuth at supabase.com/dashboard |
| **Security** | ⚠️ **Read the warning below.** |

**⚠️ Supabase MCP Security Warning:**

Per [Supabase's own guidance](https://supabase.com/blog/defense-in-depth-mcp) (Sep 2025):
- **NEVER connect to production data** — prompt injection attacks can exfiltrate data even with RLS enabled
- Use **read-only mode** when available
- Use a **staging/branch database** — not your production Supabase project
- Keep **manual approval enabled** — never auto-approve Supabase MCP tool calls
- The hosted endpoint (`mcp.supabase.com`) uses OAuth project-scoping, which is safer than raw service-role keys

**Aaron:** When you first connect, Supabase MCP will walk you through an OAuth flow. Select your **dev/staging project**, NOT the production one. If you only have one project, consider creating a branch via `supabase db branch create` first.

---

## Removed/Dead Entries

| Server | Reason |
|--------|--------|
| `Claude_Preview` | Ghost permission entry, no MCP config. Removed from settings.local.json. |
| `Control_Chrome` | Ghost permission entry, no MCP config. Removed. |
| `chrome-devtools-mcp` (4 entries) | Ghost permission entries for cached-but-uninstalled plugin. Removed. |
| `context7` (2 entries) | Ghost permission entries. Now properly configured as MCP server. |

---

## Token Cost Analysis

| MCP | Tool Schema Size | When Loaded |
|-----|-----------------|-------------|
| AIDesigner | ~300t | On-demand (when design generation is invoked) |
| Context7 | ~500t | On-demand (when docs lookup is invoked) |
| Sentry | ~800t | On-demand (when error introspection is invoked) |
| Supabase | ~1,500t | On-demand (when DB queries are invoked) |
| **Total on-demand** | **~3,100t** | **Zero always-on cost** |

All MCPs are **on-demand only** — tool schemas are not loaded into context until the agent decides to call them. This means zero always-on token overhead from MCPs.
