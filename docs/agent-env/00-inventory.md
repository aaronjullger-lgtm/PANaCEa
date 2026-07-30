# Phase 0 — Agent Environment Inventory

> Generated 2026-07-20. All facts from live filesystem inspection. No assumptions.

---

## 1. MCP Servers

### Configured & Active

| Server | Scope | Config Location | Transport | Status |
|--------|-------|----------------|-----------|--------|
| `aidesigner` | Project | `.mcp.json` | HTTP (`api.aidesigner.ai`) | **Active** — `enableAllProjectMcpServers: true` in settings |

### Referenced in Permissions but NOT Configured (Dead Entries)

| Server | Evidence | Problem |
|--------|----------|---------|
| `chrome-devtools-mcp` | `settings.local.json` has 4 permission entries (`mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`) | Not in `.mcp.json` — permissions are orphaned. Plugin exists in `~/.claude/plugins/cache/` but isn't enabled. |
| `context7` | `settings.local.json` has 2 permission entries (`mcp__plugin_context7_context7__*`) | Same — cached in plugins dir, not enabled. |
| `Claude_Preview` | `settings.local.json` has `mcp__Claude_Preview__preview_start` | No config anywhere. Dead. |
| `Control_Chrome` | `settings.local.json` has `mcp__Control_Chrome__execute_javascript` | No config. Dead. |

**Verdict:** 1 working MCP, 4 ghost permission sets for MCPs that don't exist in config.

---

## 2. Plugins & Marketplaces

### Marketplaces Cached

| Marketplace | Location | Plugins Available |
|-------------|----------|-----------------|
| `claude-plugins-official` | `~/.claude/plugins/marketplaces/claude-plugins-official/` | ~80+ plugins (supabase, github, context7, chrome-devtools, playwright, sentry, vercel, etc.) |
| `superpowers-marketplace` | `~/.claude/plugins/marketplaces/superpowers-marketplace/` | `superpowers` v6.1.1 (Jesse Vincent / obra) |

### Plugins Actively Enabled

**None.** The `pluginUsage` section in `~/.claude.json` shows all entries with `usageCount: 0` or `lastUsedNumStartups: 0`. No plugins are installed/active for this project.

### Cached but Unused

The full `claude-plugins-official` marketplace catalog is cached locally (~470KB of JSON). Several plugins are highly relevant to this stack (supabase, github, context7, chrome-devtools, playwright, sentry) but none are enabled.

---

## 3. Skills Inventory

### 3a. `.claude/skills/` — Claude Code Skills

**Total directories:** 1,243
**Git-tracked:** 27 (force-added via `git add -f`, surviving the `.gitignore` rule for `.claude/skills/`)
**Untracked junk:** ~1,216 directories from bulk marketplace/skill-pack installs

The untracked mass includes skill families: `aris-*` (54), `baoyu-*` (31), `clevel-*` (35), `eng-*` (68), `engteam-*` (58), `expo-*` (10), `jfa-*` (77), `jw-*` (72), `kit-*` (13), `mktg-*` (50), `orch-*` (88), `sci-*` (150+), `tob-*` (70+), `wsh-*` (110+), `wdl-*` (50+), `rufl-*` (90+), plus many standalone. **None of these are relevant to PANaCEa.** They're accumulated from `claude plugin install` and skill-pack experiments.

#### Git-Tracked Skills (27) — KEEP/MERGE/RETIRE Assessment

| Skill | Tokens | Verdict | Reasoning |
|-------|--------|---------|-----------|
| `panacea-dev` | 693t | **KEEP** | Core project architecture reference |
| `panacea-navigator` | 578t | **KEEP** | Codebase map — duplicated in `.agents/skills/` but different content |
| `panacea-verify` | 440t | **KEEP** | Verification command selection |
| `cf-edge-api` | 504t | **KEEP** | Cloudflare Edge patterns — unique to this repo |
| `fsrs-domain` | 631t | **KEEP** | FSRS v6 algorithm concepts |
| `fsrs-pipeline` | 807t | **KEEP** | Full submission flow — core differentiator |
| `panacea-fsrs-wiring` | 562t | **KEEP** | Hook-level drill→FSRS integration |
| `prisma-data-integrity` | 601t | **KEEP** | Schema, migrations, RLS — directly addresses pain point #1 |
| `session-orchestration` | 548t | **KEEP** | QuizView, DrillShell, reservoir, sync |
| `sprint-pipeline` | 1,581t | **MERGE** | Overlaps with `.agents/skills/panacea-session-pipeline` + AGENTS.md sprint routing. Consolidate. |
| `panacea-component-sprint` | 586t | **MERGE** | Overlaps with `sprint-pipeline` — same workflow at different granularity |
| `vitest-author` | 1,309t | **KEEP** | Test patterns specific to PANaCEa conventions |
| `ai-generation-safety` | 3,092t | **KEEP** | Gemini validation, fallbacks — largest skill, high value |
| `dashboard-trust` | 2,484t | **KEEP** | Metric accuracy, chart null-safety |
| `clinical-content-gen` | 2,285t | **KEEP** | PANCE blueprint, question schema |
| `clinical-library-search` | 1,193t | **KEEP** | Knowledge base, semantic search |
| `clinical-safety-review` | 1,519t | **KEEP** | Medical content accuracy tiers |
| `auth-policy-review` | 1,285t | **KEEP** | Endpoint auth audit, RLS — addresses pain point #1 |
| `async-state-hardening` | 1,356t | **KEEP** | Loading/error/empty/offline states |
| `model-routing-escalation` | 1,230t | **KEEP** | Gemini model selection, cost optimization |
| `osce-architect` | 1,614t | **KEEP** | OSCE simulation subsystem |
| `perf-bundle-edge` | 1,392t | **KEEP** | Bundle size, edge cold starts — addresses performance pain points |
| `react-refactor` | 2,087t | **KEEP** | Component decomposition patterns |
| `repo-hygiene` | 1,654t | **KEEP** | Duplicate code, dead files |
| `panacea-style-system` | 643t | **KEEP** | Typography, color, visual hierarchy |
| `ui-primitive-consolidation` | 1,244t | **KEEP** | Extract reusable UI primitives |
| `desktop-commander-deploy` | 1,008t | **RETIRE** | Desktop Commander MCP workarounds — this tool isn't in use anymore |

**Total tracked skill tokens:** ~32,934t (~131KB)
**After cleanup:** ~30,346t (retire desktop-commander, merge 2 sprint skills)

### 3b. `.agents/skills/` — Codex/OpenClaw Skills

**Total:** 44 skills, all git-tracked.
**Total tokens:** ~37,636t (~150KB)

These are well-organized and actively referenced by AGENTS.md routing rules. Key skills for this environment:

| Skill | Tokens | Role |
|-------|--------|------|
| `panacea-navigator` | 889t | Primary routing skill for unclear repo work |
| `panacea-verify` | 738t | Validation command selection |
| `panacea-prisma-data-integrity` | 820t | Schema/data-integrity primary |
| `panacea-fsrs-guardrails` | 847t | Safe FSRS scheduler changes |
| `panacea-session-pipeline` | 746t | Trace drill submissions |
| `panacea-auth-guard` | 930t | Auth/RLS guardrails |
| `panacea-deployment-guard` | 873t | Deploy safety |
| `panacea-edge-endpoints` | 859t | Edge function patterns |
| `security-and-privacy-audit` | 602t | Security surface audit |
| `release-readiness` | 578t | Production launch gate |
| `supabase` | 1,907t | Supabase-specific behavior |
| `skill-routing-and-usage` | 774t | Skill routing meta-skill |
| `repo-operating-system` | 656t | Repo-wide operations |
| `wrap-up` | 890t | Session end handoff |
| `panacea-regression-guard` | 928t | Regression prevention |
| `panacea-repo-hygiene` | 869t | Codebase hygiene |

**Verdict:** All 44 are KEEP. This library is curated and actively maintained.

### 3c. Cross-Library Overlap Analysis

| Topic | `.claude/skills/` | `.agents/skills/` | Action |
|-------|-------------------|-------------------|--------|
| Codebase navigation | `panacea-navigator` (578t) | `panacea-navigator` (889t) | Both kept — different content for different harnesses |
| Verification | `panacea-verify` (440t) | `panacea-verify` (738t) | Same — harness-specific variants |
| Prisma/data integrity | `prisma-data-integrity` (601t) | `panacea-prisma-data-integrity` (820t) | Same — different depth |
| Sprint workflow | `sprint-pipeline` + `panacea-component-sprint` (2,167t) | `panacea-session-pipeline` (746t) | **Merge** the two `.claude/` sprint skills into one |
| FSRS | `fsrs-domain`, `fsrs-pipeline`, `panacea-fsrs-wiring` (2,000t) | `panacea-fsrs-guardrails` (847t) | No overlap — different concerns (domain vs. guardrails) |

---

## 4. Hooks

### Active Hooks

| Hook | Event | Matcher | Script | Status |
|------|-------|---------|--------|--------|
| Safety Guard | `PreToolUse` | `Bash` | `.claude/hooks/safety-guard.sh` | **Active** — blocks destructive commands + secret scanning |

### Dead/Unwired Hooks

| Hook | Event | Script | Status |
|------|-------|--------|--------|
| Session Start | `SessionStart` | `.claude/hooks/session-start.sh` | **EXISTS BUT NOT WIRED** — not referenced in `settings.local.json`. Dead code. |

### Hook Gaps (Pain Point Mapping)

| Needed Hook | Pain Point | Status |
|-------------|-----------|--------|
| SessionStart context reconstruction | #4 (lost context) | Script exists but unwired |
| Migration tripwire (schema change → migration file) | #1 (uncontrolled DB changes) | **Missing** |
| PostToolUse format/lint on touched files | General quality | **Missing** |
| Pre-commit secret scan with PANaCEa-specific patterns | Secret leakage | Partially in safety-guard.sh but not as pre-commit |
| Dependency existence check | Hallucinated packages | **Missing** |
| Stop/SessionEnd handoff note writer | #4 (lost context) | **Missing** |
| Edge-runtime lint (Node-only APIs in functions/) | #2 (edge compat) | **Missing** |

---

## 5. Slash Commands

| Command | File | Purpose |
|---------|------|---------|
| `/audit` | `.claude/commands/audit.md` | Read files before modifying |
| `/sprint` | `.claude/commands/sprint.md` | Sprint implementation pipeline |
| `/status` | `.claude/commands/status.md` | Git status + test status |
| `/verify` | `.claude/commands/verify.md` | Typecheck + unit tests |
| `/aidesigner` | `.claude/commands/aidesigner.md` | AIDesigner frontend generation |

**Missing commands:** `/resume`, `/review`, `/ship`, `/handoff` — all needed for the bursty-session workflow.

---

## 6. Subagents

| Agent | File | Purpose |
|-------|------|---------|
| `aidesigner-frontend` | `.claude/agents/aidesigner-frontend.md` | Frontend generation agent |

**Missing:** Security reviewer, test author, migration reviewer subagents.

---

## 7. Multi-Agent System (`.claude/multi-agent/`)

A Python-based multi-agent orchestrator with providers for Gemini, OpenAI, Claude, DeepSeek, Perplexity, Zhipu.

**Status: STALE.** Last activity: 2026-04-06 (3+ months ago). Session state shows 8 messages dispatched, 0 consumed. Contains `__pycache__`, stale state files. This is abandoned experiment code that's git-tracked and adds noise.

**Recommendation:** Remove from git tracking or archive. It doesn't work and adds confusion.

---

## 8. Context Files (CLAUDE.md / AGENTS.md / .cursorrules)

### CLAUDE.md (471 lines)
- **Status:** Mostly current but has stale sections
- **Contradictions:** References "27 custom PANaCEa skills" (correct for `.claude/skills/`) and "44 OpenClaw agent skills" (correct for `.agents/skills/`) — but doesn't explain the relationship clearly
- **Stale:** "Current Priorities (2026-04-18)" section lists pending migrations that may have been applied since
- **Good:** Decision authority framework, tech stack table, FSRS pipeline documentation, common pitfalls table
- **References `~/Documents/Claude/CLAUDE.md`** for full decision framework — unverified if this file exists

### AGENTS.md
- **Status:** Current and authoritative
-- Covers product identity, design principles, visual system, tech stack, skill routing, safety constraints
- **Codex skill routing section** is well-structured with primary/secondary skill selection

### .cursorrules
- Exists, not inspected in detail (likely duplicates CLAUDE.md content for Cursor)

---

## 9. Repo Reality Check

| Item | Value |
|------|-------|
| **Package manager** | npm (no `packageManager` field in package.json) |
| **Node version** | `.node-version` = 22; running v24.11.1 |
| **npm** | 11.6.2 |
| **Typecheck** | `tsc --noEmit -p tsconfig.production.json` (OOM without `--max-old-space-size=4096`) |
| **Full typecheck** | `tsc --noEmit` (OOM risk — pain point #2) |
| **Lint** | `eslint . --max-warnings 2000` |
| **Format** | `prettier --write .` |
| **Test** | `vitest run` (3200+ tests, 205/213 files passing) |
| **Build** | `node scripts/inject-wrangler-env.js && vite build --mode production` |
| **E2E** | Playwright (multiple configs) |
| **Git hooks** | **None active** — only `.sample` files in `.git/hooks/` |
| **CI** | 17 GitHub Actions workflows |
| **Prisma migrations** | 90 migration directories |
| **Deploy** | Cloudflare Pages (`wrangler pages deploy`) |

### Scripts That Actually Exist (key ones)

```
dev, build, test, test:coverage, test:critical, test:e2e
typecheck, typecheck:all, typecheck:ci
lint, lint:fix, format, format:check
db:push, db:generate, db:migrate:dev, db:migrate:deploy, db:studio
deploy:local, pages:dev, pages:serve
roo-check, roo-check:full
```

---

## 10. Security Posture of Current Config

### `.gitignore` Coverage
- `.env*` patterns: ✅ Covered
- `*secret*`, `*credential*`: ✅ Covered
- `mcp_config.json`: ✅ Covered
- `.mcp.json`: ❌ **NOT gitignored** — it's committed (contains only the aidesigner URL, no secrets, so OK)

### settings.local.json
- **8.7KB** of accumulated permission grants — many one-off commands from past sessions
- Contains orphaned MCP permission entries for servers that don't exist
- **No deny rule for `prisma migrate reset`** or `prisma db push --force` — these could wipe production data
- `Bash(rm -rf:*)` is in deny list ✅
- `Bash(git push --force:*)` is in deny list ✅

### Hook Coverage
- PreToolUse Bash guard: ✅ Active, covers destructive commands + secrets
- No migration safety hook
- No pre-commit hook
- No dependency verification

---

## 11. Summary of Issues Found

| # | Issue | Severity | Pain Point |
|---|-------|----------|-----------|
| 1 | Session-start hook exists but is NOT wired | High | #4 (lost context) |
| 2 | ~1,216 untracked junk skill dirs in `.claude/skills/` | Medium | Token/file pollution |
| 3 | No migration tripwire hook | High | #1 (uncontrolled DB) |
| 4 | No Context7/docs MCP despite permission entries | Medium | Stale API knowledge |
| 5 | No Supabase MCP despite RLS pain point | High | #1 (RLS enforcement) |
| 6 | Multi-agent system is stale/abandoned | Low | Noise |
| 7 | settings.local.json has 8.7KB of accumulated cruft | Low | Maintenance debt |
| 8 | No `/resume`, `/review`, `/ship`, `/handoff` commands | High | #4 (lost context) |
| 9 | No PostToolUse format/lint hook | Medium | Quality drift |
| 10 | No SessionEnd/Stop handoff writer | High | #4 (lost context) |
| 11 | `desktop-commander-deploy` skill references unused tool | Low | Stale skill |
| 12 | Two overlapping sprint skills in `.claude/skills/` | Low | Redundancy |
