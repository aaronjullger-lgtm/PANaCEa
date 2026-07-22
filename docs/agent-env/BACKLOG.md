# Agent Environment Backlog

> Items deliberately deferred during the 2026-07-20 build. Ranked by ROI.

---

## Tier 1 — High ROI, Do Next

### 1. GitHub MCP Server
**Why deferred:** Aaron has no GitHub PAT yet. `gh` CLI covers most operations.
**When to do:** When PR review workflow becomes a bottleneck or when working across multiple repos.
**Setup:** Generate PAT at github.com/settings/tokens (repo scope), add to `.env` as `GITHUB_PERSONAL_ACCESS_TOKEN`, add to `.mcp.json`.
**Score:** 41/75 in research — low priority but easy to add later.

### 2. Cloudflare MCP Server
**Why deferred:** Wrangler CLI covers 80% of use cases. Moderate credential scope.
**When to do:** When debugging production KV/R2/Workers issues that wrangler can't surface.
**Setup:** `cloudflare/mcp-server-cloudflare`, requires CF API token with read scope.
**Score:** 50/75 — useful but not urgent.

### 3. Chrome DevTools MCP
**Why deferred:** Playwright already handles E2E. DevTools MCP adds live inspection but is heavy.
**When to do:** When debugging runtime browser issues that Playwright can't catch.
**Setup:** Already cached in `~/.claude/plugins/`. Just needs enabling.
**Score:** 52/75.

---

## Tier 2 — Medium ROI, Contextual

### 4. Stale Multi-Agent System Cleanup
**What:** `.claude/multi-agent/` is stale (last activity April 2026). Contains Python orchestrator with providers for Gemini/OpenAI/Claude/DeepSeek/Perplexity/Zhipu.
**Why deferred:** It's git-tracked and harmless. Removal requires Aaron's approval since it might have sentimental/experimental value.
**Action:** `git rm -r .claude/multi-agent/` when Aaron confirms.

### 5. settings.local.json Permission Pruning
**What:** 90 permission entries, many one-off commands from past sessions (perl mass-edits, specific mv commands, etc.).
**Why deferred:** Low harm, high effort to audit each entry. The 8 ghost MCP entries were the important ones (already removed).
**Action:** Periodically review and prune stale entries.

### 6. Superpowers Plugin (Re-evaluation)
**What:** Plugin cached at `~/.claude/plugins/marketplaces/superpowers-marketplace/`. Provides TDD, debugging, code review workflows.
**Why deferred:** ~2Kt always-on overhead. 60% overlap with existing skills.
**When to re-evaluate:** If Aaron finds the adversarial-review skill insufficient and wants structured TDD enforcement.
**Action:** `/plugin install superpowers` if desired.

---

## Tier 3 — Low ROI, Nice to Have

### 7. Vercel MCP
**Why deferred:** Cloudflare Pages is primary deploy target. Vercel is "also in play" but not actively used.
**Score:** 35/75 — skip unless Vercel becomes the primary deploy target.

### 8. husky/lefthook Native Git Hooks
**What:** Replace Claude Code hooks with git-native hooks (pre-commit, pre-push).
**Why deferred:** Claude Code hooks fire at the agent level (before tool execution), which is earlier and more contextual than git hooks. Git hooks would be redundant.
**When to do:** If Aaron starts using other tools (not just Claude Code) and wants the same guardrails.

### 9. Context7 Enhanced Integration
**What:** Currently Context7 is a raw MCP. Could add a slash command `/docs <library>` that wraps the MCP call.
**Why deferred:** The MCP is already callable. A command is convenience, not capability.

### 10. Automated RLS Audit Cron
**What:** A script that runs the RLS audit from `panacea-prisma-data-integrity` skill on a schedule and reports tables missing RLS.
**Why deferred:** Requires Supabase MCP to be connected first. Can be built once Aaron completes the OAuth flow.

---

## Rejected (Not Pursuing)

| Item | Reason |
|------|--------|
| Prisma MCP | Designed for Prisma Postgres hosted, not Supabase. Doesn't match DB host. |
| PostgreSQL MCP (crystaldba) | Redundant with Supabase MCP. Another DATABASE_URL credential. |
| Playwright MCP | Playwright already configured in project for E2E. |
| Slack/Discord/Telegram MCPs | Solo developer, no team communication needs. |
| Linear/Asana/Jira MCPs | No project tracker in use. |
| Stock skill packs (aris-*, baoyu-*, etc.) | 1,216 junk dirs removed. These were noise. |
