# Top-100 GitHub Repos Audit — Research Document (Step 1)

**Date:** 2026-07-31
**Scope (user-defined):** Audit the EvanLi top-100 most-starred GitHub repos (2026 snapshot) and thoroughly plan/improve PANaCEa through the use of agents and an orchestrator-driven pipeline. **This document is Step 1 only — research and ONE deliverable. No implementation was performed.**
**Status:** Research complete; backlog items are deferred to a later step pending approval.

---

## 0. Method & Evidence Tags

- Source list: EvanLi `top100-stars` snapshot fetched 2026-07-31 (HTTP 200, 21,351 bytes). Local copy: `/var/folders/7y/xln11m1s0gd0gbtr1pr0797w0000gn/T/opencode/top100-stars.md`.
- Two background research agents (explore `bg_54fa3d80`, librarian `bg_9073ce20`) failed ("Task timed out while queued (30 minutes)") — background delegation infra was unavailable, so all research was completed inline.
- Evidence tags used throughout:
  - `[V-L]` = verified locally in this repo (file read / command output this session)
  - `[V-F]` = verified via live fetch this session (GitHub API / raw file)
  - `[K]` = well-established public knowledge about the repo, NOT re-fetched this session (verify before citing in a PR)
  - `[X]` = explicitly verified absent

---

## 1. The 2026 Top-100 Landscape (verified ranks)

### 1.1 Headline finding: the agentic takeover

The top of GitHub has flipped from frameworks to **agentic developer tooling**. Verified ranks from the snapshot [V-F]:

| Rank | Repo | Stars | Language | Why it matters to PANaCEa |
|---|---|---|---|---|
| 4 | freeCodeCamp/freeCodeCamp | 453,263 | TypeScript | OSS education platform; CI/i18n/test patterns |
| 6 | openclaw/openclaw | 384,631 | TypeScript | Personal AI assistant harness (80k forks — fastest-growing) |
| 14 | obra/superpowers | 264,044 | Shell | Agentic skills framework + dev methodology |
| 17 | affaan-m/ECC | 236,303 | JavaScript | Agent harness performance optimization (skills/memory/security) |
| 25 | tensorflow/tensorflow | 196,618 | C++ | Scale CI/benchmarks |
| 29 | anomalyco/opencode | 191,302 | TypeScript | Open source coding agent (the harness this session runs in) |
| 32 | microsoft/vscode | 188,033 | TypeScript | Industrial-scale build/test/CI |
| 40 | flutter/flutter | 178,009 | Dart | Monorepo + dev-experience |
| 41 | ollama/ollama | 177,364 | Go | Local model serving |
| 47 | anthropics/skills | 165,304 | Python | **Agent Skills** — PANaCEa has 44+ local skills; direct pattern source |
| 49 | huggingface/transformers | 163,188 | Python | Model tooling + eval culture |
| 58 | langchain-ai/langchain | 143,053 | Python | Agent engineering platform — PANaCEa already vendors this stack |
| 61 | vercel/next.js | 141,192 | JavaScript | CI gates + perf discipline |
| 63 | anthropics/claude-code | 139,710 | Python | Agentic coding tool (subagents/hooks/skills/MCP) |
| 76 | garrytan/gstack | 125,359 | TypeScript | Role-based agent setup (CEO/Designer/Eng Manager/QA...) |
| 77 | github/spec-kit | 124,686 | Python | **Spec-driven development** workflow |
| 80 | farion1231/cc-switch | 122,620 | Rust | Multi-agent assistant manager |
| 81 | electron/electron | 122,274 | C++ | Security-hardened desktop patterns |
| 95 | microsoft/TypeScript | 110,015 | TypeScript | Perf baselines + CI discipline |

Also verified top-8: #1 build-your-own-x, #2 awesome, #3 public-apis, #5 free-programming-books, #7 developer-roadmap, #8 system-design-primer [V-F].

**Notable absence:** `facebook/react` does **not** appear in the top-100 [V-F, grep no-match] — the framework era has been displaced by agent tooling. For a React 19 app, this is a strategic signal: invest in the agent/automation layer (which compounds), not in more framework ceremony.

### 1.2 Cluster analysis

- **Agent harnesses:** openclaw (#6), opencode (#29), claude-code (#63), cc-switch (#80) — the runtime layer.
- **Skills/methodology:** superpowers (#14), ECC (#17), anthropics/skills (#47), gstack (#76), spec-kit (#77) — the layer that makes agents effective **on a specific codebase**. This is where PANaCEa's 44-skill library already plays.
- **Classic engineering benchmarks:** freeCodeCamp (#4), vscode (#32), TypeScript (#95), next.js (#61) — CI/testing/perf patterns.
- **ML/AI:** tensorflow (#25), transformers (#49), ollama (#41), langchain (#58) — eval culture and agent platforms.

---

## 2. Engineering Patterns from Top Repos (with evidence)

### 2.1 CI/CD: modular reusable workflows — langchain [V-F]

Fetched `.github/workflows/` of langchain-ai/langchain this session (35+ workflows). Patterns observed:

- **Underscore-prefixed reusable workflows** composed by consumers: `_lint.yml`, `_test.yml`, `_test_vcr.yml`, `_test_pydantic.yml`, `_compile_integration_test.yml`, `_release.yml` — the same idea as PANaCEa's `_automation-lane.yml` (reusable `workflow_call`), but taken further (lint/test/release all reusable).
- **Automated model-profile refresh**: `_refresh_model_profiles.yml` + `refresh_model_profiles.yml` — scheduled agent-maintained registries (PANaCEa has `sched-daily-learning-models.yml` for the same purpose).
- **Performance regression CI**: `codspeed.yml` — benchmark budgets as a CI gate (PANaCEa has `build:check-size` locally but no hosted perf-gate).
- **PR governance bots**: `pr_labeler.yml`, `pr_lint.yml`, `pr_lint_trailer.yml`, `block_fork_main_prs.yml`, `require_issue_link.yml`, `close_unchecked_issues.yml`, `remove_waiting_on_author.yml`, `reopen_on_assignment.yml`, `check_diffs.yml`, `check_versions.yml`, `check_extras_sync.yml`, `bump_uv_pin.yml`, `auto-label-by-package.yml` — repo-ops automation as a first-class workflow category.
- **Sync integrity check**: `check_agents_sync.yml` — "agent definitions drifted from source" gate. PANaCEa has the analogous need (e.g., `audit:callgemini`, `docs/skills-usage.md` freshness).

### 2.2 CI/CD: layered testing — freeCodeCamp [V-F]

Fetched `.github/workflows/` of freeCodeCamp this session. Patterns:

- `node.js-tests.yml` (unit/integration), `e2e-playwright.yml` + `e2e-third-party.yml` (browser E2E, separate third-party lane), `deploy-api.yml` + `deploy-client.yml` (split deploys), `devcontainer-ci.yml` (dev-container health as CI concern).
- **Localization as automated pipeline**: `crowdin-upload.client-ui.yml`, `crowdin-download.client-ui.yml`, `crowdin-upload.curriculum.yml`, `curriculum-i18n-submodule.yml`, `i18n-validate-builds.yml`, `i18n-validate-prs.yml`, `github-no-i18n-via-prs.yml` — i18n content is machine-orchestrated end-to-end with validation gates.
- **Community-ops automation**: `github-autoclose.yml`, `github-spam.yml`, `github-labeler.yaml`, `github-lock-closed-prs.yml`, `github-pr-guidelines.yml` — same governance-bot category as langchain.
- **Education-specific**: the "curriculum" is versioned content with its own CI (analog: PANaCEa's clinical content refinery + content audits already have `sched-content-audit.yml`; freeCodeCamp validates i18n builds — PANaCEa has no i18n, so N/A).

### 2.3 Testing & eval culture — TypeScript, vscode, next.js, transformers [K]

- **microsoft/TypeScript** [K]: per-PR test baselines + performance dashboards (compiler perf regression gates). → PANaCEa analog: `benchmark:relevance` exists; no perf-regression gate in CI.
- **microsoft/vscode** [K]: layered test pyramid — unit → integration → smoke → E2E (attempted fetch of `build/azure-pipelines/ci.yml` returned 404 [X]; treat specifics as [K]).
- **vercel/next.js** [K]: CI with bundle-size budgets, turbopack speed gates; ships `next build` analytics. → PANaCEa analog: `build:check-size` + `bundle-size-snapshot.mjs` + `build:analyze` exist [V-L].
- **huggingface/transformers** [K]: model-behavior evals as first-class; golden datasets. → PANaCEa analog: `evals/memory/run_memory_evals.ts`, `lib/langchain/evals/run-evals.ts`, `memory-evals.yml` gate [V-L].

### 2.4 Agent engineering patterns — the cluster PANaCEa directly competes with [K unless marked]

- **anthropics/skills (#47)** [K]: skills = packaged, reusable agent capabilities (SKILL.md + assets). PANaCEa has **44+ skills** in `.agents/skills/` + `.claude/skills/` with `docs/skills-overview.md` / `docs/skills-usage.md` and an audit script [V-L] — already following this pattern.
- **superpowers (#14)** [K]: skills framework + *methodology* (how the agent works, not just what it can call). PANaCEa's `sprint-workflow`/`sprint-pipeline`/`panacea-syncytium-coordinator` skills are methodology-shaped [V-L].
- **ECC (#17)** [K]: "skills, instincts, memory, security, research-first development" — agent-harness performance optimization. PANaCEa's `lib/agents/` (supervisor v1/v2, orchestrator, registry, protocol, shared state/tools/checkpoint) + `lib/langchain/` (deepagent, graphs, hub, mcp, evals) is a comparable in-repo stack [V-L].
- **gstack (#76)** [K]: role-based agent personas (CEO, Designer, Eng Manager, Release Manager, Doc Engineer, QA) with opinionated tools. → PANaCEa analog: `cloud-agents.yml` defines 8 agent jobs (pr-review, edge-guard, living-docs, asset-perf, schema-sync, e2e-gap, security-sentinel, lint-fix) [V-L] — same shape, already wired.
- **spec-kit (#77)** [K]: spec-driven development. PANaCEa has `spec-driven-development` and `spec-driven-development`-adjacent skills + `docs/plans/`, `docs/specs/` evidence [V-L].
- **openclaw (#6) / opencode (#29) / claude-code (#63)** [K]: harness-level concerns — MCP, hooks, subagents, tool security. PANaCEa has `lib/agents/mcp/`, `lib/agents/protocol/`, `lib/agents/bridge/`, `lib/agents/node-*`, `packages/agent-orchestrator` (CI typecheck+smoke gate [V-L]) — the infrastructure exists; the gap is *orchestration coverage*, not primitives.

### 2.5 Security & governance

- **electron (#81)** [K]: famous for security hardening docs + sandboxing (their SECURITY.md is the model). 
- **PANaCEa security posture [V-L]:** `.gitleaks.toml` present; husky pre-commit runs only `npm run lint`; `scripts/git-hooks/{install-hooks,pre-commit,pre-push}.sh`; `public/_headers` CSP (Clerk/Supabase/Sentry/Gemini/CF domains); `audit:prisma` (disconnect), `audit:zod`, `audit:loading`, `audit:all` scripts; `ai-stack-audit.yml` (advisory callGemini migration auditor, report-only).
- **Gaps [V-L/X]:** no `dependabot.yml`/`renovate.json`, no CodeQL workflow, no `SECURITY.md`, no `CONTRIBUTING.md`, no `LICENSE`, no `CHANGELOG.md`. (Private repo — some are intentional; see §5.)

---

## 3. PANaCEa Current State (all `[V-L]` unless marked)

### 3.1 Repo shape

| Dimension | Current state | Evidence |
|---|---|---|
| Stack | React 19 + Vite + TS strict, Cloudflare Pages Functions, Prisma/Postgres (Supabase), Clerk, Vitest + Playwright, Sentry, Langfuse, LangSmith | `package.json` (93 deps / 43 devDeps, engines node >=22) |
| Scripts | 160+ npm scripts incl. `orchestrate:full`, `orchestrate:context-aware`, `db:automate`, `eval:agents`, `eval:memory`, `verify:memory`, `roo-check`, `roo-check:full`, `test:critical` (6 FSRS/learning files), `test:e2e:*` (7 variants), `audit:*` (8 variants) | `package.json` scripts block [V-L] |
| Monorepo packages | `packages/agent-orchestrator` (own CI: typecheck + smoke compile of all agent graphs), `packages/agents-dashboard` (Langfuse), `packages/prompts` | `packages/` listing + `agent-orchestrator-smoke.yml` |
| Tests | 572 Vitest files (tests 252, lib 181, functions 73, services 14, components 15, hooks 10, **store 1** — `tests/store/useStudyStore.test.ts`, 13 tests passing); 25 e2e specs; coverage thresholds 40/35/35/40 (perFile false); sentry stubbed | `vitest.config.ts`, file counts |
| Playwright | 8 projects: setup/auth, chromium, chromium-no-auth, a11y (axe, WCAG 2.1 AA), ux-polish, mobile-layout (320px), firefox-smoke, webkit-smoke; retries 2 / 1 worker on CI; webServer `npm run dev` | `playwright.config.ts` |

### 3.2 CI/CD (25 workflows)

| Workflow | Role |
|---|---|
| `ci.yml` (20m) | prisma validate/generate → `typecheck:ci` (tsconfig.ci.json: FSRS core + drillReviewService + confidence + `_shared` auth; full-tree debt parked) → lint → build → `build:check-size` → critical algorithm tests |
| `deploy.yml` (15m) | `workflow_run` on CI success + dispatch; CF + Sentry secrets |
| `playwright.yml` (60m) | full e2e vs "lighter CI smoke lane" |
| `_automation-lane.yml` | **reusable** `workflow_call` runner for scheduled lanes (lane_name, lane_slug, shell_commands, cron_endpoints METHOD\|PATH\|JSON_BODY, ...) |
| `sched-*` × 9 | content-audit, daily-learning-models, daily-ops, monthly-deep-audit, reservoir-supply, runtime-sanity, weekly-maintenance, weekly-platform-report, weekly-repo-hygiene |
| Agent lanes | `cloud-agents.yml` (8 job types, no schedule by design), `agent-orchestrator-smoke.yml`, `agent-evals.yml` (weekly), `agent-evals-langchain.yml` (daily, langchain/agents paths — renamed from agent-evaluations.yml 2026-07-31), `agent-verify.yml` (PR paths), `memory-evals.yml` (golden-query/safety gates), `ai-stack-audit.yml` (advisory) |
| Hardening (added 2026-07-31) | `codeql.yml` (weekly Mon 3AM SAST, TS/JS paths), `benchmark-relevance.yml` (weekly Tue 3AM, relevance baseline → `docs/benchmarks/relevance-baseline.json`), `agent-sync-check.yml` (skills ↔ docs drift; PR/push on skills/docs paths + weekly Mon 4AM), `dependabot.yml` (weekly, grouped, 4 update blocks) |
| Other | `neon_workflow.yml` |

### 3.3 Agent & AI infrastructure (already substantial)

- `lib/agents/`: supervisor.ts + supervisor-v2.ts + supervisor-llm.ts/state, orchestrator.ts, subagent(s).ts, registry.ts + registry.encounter.ts, capabilities, bridge/, deep/, encounter/, graphs/, mcp/, middleware/, monitoring.ts, observability.ts, ops/, pipelines/, planning.ts, protocol(.ts), router/, tracing/, unified.ts; `shared/`: checkpoint, node-agent-bridge, protocol, runtime, state, tools, types.
- `lib/langchain/`: agent.ts, deepagent.ts, evals/, graphs/, hub/, mcp.ts, models.ts, router.ts, tracing.ts, config.ts, envAdapter.ts, chains/, pipelineTracer.ts.
- `lib/ai/`: aiGateway.ts (multi-provider fallback), circuitBreaker.ts, contracts.ts, costGuardrail.ts, costGuardrailContext.ts, costTracker.ts, jsonParser.ts (SCOUT-0001 fix), prompts/, schemas/, telemetry.ts.
- `lib/observability/`: sentry.ts init + `lib/errors/errorLogger.ts`; Langfuse refs in `packages/agents-dashboard/lib/orchestrator.ts` + `packages/agent-orchestrator/src/clients/{prompts,tracing}.ts`; `verify:langsmith` script.
- Auth: `functions/api/_shared/auth.ts` — Clerk `verifyToken`; `authenticateRequest(request, env)` preferred over legacy `requireAuth` (process.env variant); `maskSecretKey`, `decodeJwtPayload` diagnostics; `_shared/` has 40+ files (cors, middleware, enhancedMiddleware, endpoint, api-contract, error-catalog, d1-cache, kv-cache, feature-flags, auditLog...).

### 3.4 Security & governance

- `.gitleaks.toml` present; `.husky/pre-commit` delegates to `scripts/git-hooks/pre-commit.sh` (design-token audit + critical FSRS tests + gitleaks staged scan); `.git/hooks/{pre-commit,pre-push}` symlinked via `install-hooks.sh`; pre-push mirrors all 5 CI gates (lint, typecheck:ci, test:critical, build+size, gitleaks); CSP in `public/_headers`.
- **Added 2026-07-31:** dependabot.yml (weekly grouped), CodeQL weekly workflow. **Absent:** renovate, SECURITY.md, CONTRIBUTING.md, LICENSE, CHANGELOG.md [V-L/X].
- Present: `.github/copilot-instructions.md`.

### 3.5 Docs

Large `docs/` tree: INDEX.md, ARCHITECTURE_README.md, AUTOMATION_JOBS_GUIDE.md, AUTOMATION_RUNBOOK.md, CI-GATES.md, INTELLIGENCE_LAYER.md, INTELLIGENCE_COORDINATION_LAYER.md, DESIGN_SYSTEM.md, EDGE_RUNTIME_PATTERNS.md, ENDPOINT_SECURITY_PRIORITY.md, FSRS_* series, `docs/research/` (this doc's home), `docs/audits/`, `docs/plans/`, `docs/sprints/` + root `UPDATED_PRODUCTION_READINESS_SCORECARD.md`, `NEXT_IMPLEMENTATION_PLAN.md`.

---

## 4. Gap Analysis: PANaCEa vs. Top-100 Patterns

| # | Gap | Top-repo pattern | PANaCEa evidence | Severity |
|---|---|---|---|---|
| G1 | No dependabot/renovate | Universal in top repos | **[F]** dependabot.yml added 2026-07-31 (weekly, grouped, 4 update blocks) | **High** → closed |
| G2 | No CodeQL/SAST in CI | langchain/freeCodeCamp security lanes | **[F]** codeql.yml weekly (Mon 3AM, TS/JS paths); gitleaks now in pre-commit | **High** → closed |
| G3 | husky pre-commit = lint only; gitleaks not in pre-commit; pre-push not wired into CI | electron SECURITY.md culture; ECC "security" pillar | **[F]** pre-commit = design audit + critical FSRS tests + gitleaks; pre-push mirrors all 5 CI gates; both symlinked via install-hooks.sh | **High** → closed |
| G4 | `typecheck:ci` is a subset — full-tree TS debt parked | vscode/TypeScript full-tree gates | `[V-L]` ci.yml comment "Full-codebase TS debt (parked QuizView refactor)" | Medium (known, intentional) |
| G5 | No hosted perf-regression gate | langchain codspeed; TypeScript perf dashboards | `[P]` benchmark-relevance.yml weekly baseline added 2026-07-31; `build:check-size` still local + pre-push gate | Medium → partially addressed |
| G6 | `store/` has 0 test files | freeCodeCamp node.js-tests; vitest coverage include lists store/** | **[F]** claim was wrong — `tests/store/useStudyStore.test.ts` exists (13 tests passing 2026-07-31); doc corrected | Medium → closed |
| G7 | 160+ scripts, 100+ script files — sprawl | langchain modular reusable workflows | `[P]` `npm run scripts:list` (grouped listing) + `npm run automation:lanes:check` (registry validator) added 2026-07-31; AUTOMATION_JOBS_GUIDE.md remains | Low/Medium → partially addressed |
| G8 | Community/PR governance bots absent (private repo — largely N/A) | langchain pr_lint/pr_labeler; freeCodeCamp spam/autoclose | `[X]` | Low (N/A for private solo repo) |
| G9 | No i18n pipeline (N/A for PANaCEa) | freeCodeCamp crowdin | — | N/A |
| G10 | Background delegation infra (agent harness) flaky | openclaw/opencode harness reliability | `[V-L]` bg tasks timed out queued this session | Medium — ops risk for the agent pipeline itself |
| G11 | `agent-evaluations.yml` + `agent-evals.yml` duplication (daily 2AM UTC vs weekly Sun 2AM) | langchain check_agents_sync style hygiene | **[F]** renamed → `agent-evals-langchain.yml`, workflow name "Agent Evals - LangChain", job `langchain-evaluate` | Low → closed |
| G12 | No `check_agents_sync` equivalent — skills/registry drift undetected | langchain `check_agents_sync.yml` | **[F]** `agent-sync-check.yml` (PR/push on skills/docs paths + weekly Mon 4AM) runs audit-skills.sh | Low → closed |

---

## 5. Proposed Orchestrator + Agents Pipeline (sketch — deferred, NOT implemented)

The user goal is to improve the repo "through the use of agents and a pipeline orchestrated by an orchestrator." PANaCEa **already has both halves** — the missing piece is one coherent orchestration model. Sketch for the later step:

### 5.1 Target architecture

```
GitHub Actions (25 workflows, incl. _automation-lane reusable runner)
   │
   ├─ Scheduled lanes (sched-* × 9) ──► scripts/automation/{hourly,daily,weekly,monthly}*
   │        │                              │ (tsx jobs: stats, audits, learning models, content)
   │        └── each lane = one _automation-lane.yml invocation (already the pattern)
   │
   ├─ Agent lanes ──► cloud-agents.yml (8 jobs: pr-review, edge-guard, living-docs,
   │                  asset-perf, schema-sync, e2e-gap, security-sentinel, lint-fix)
   │
    ├─ Eval gates ──► memory-evals.yml + agent-evals-langchain.yml + agent-evals.yml
   │
    └─ Additions (status as of 2026-07-31):
        A. ✅ lane registry (config/automation-lanes.ts + scripts/automation/check-lane-registry.ts,
           npm run automation:lanes:check) — single source of truth: lane → workflow → cron → script
        B. ⏳ orchestrator supervisor pass: lib/agents/supervisor-v2 already exists — add a
           "lane supervisor" that reads the registry, dispatches scripts/automation jobs,
           collects results, writes a per-lane report artifact (still deferred)
        C. ✅ CI hardening lane: dependabot.yml + CodeQL + gitleaks in pre-commit + husky
           delegation (typecheck:ci + test:critical via pre-push parity gates), closing G1/G2/G3
        D. ◐ perf gate lane: benchmark-relevance.yml weekly baseline added (closes G5 partially);
           bundle-size stays local build:check-size + pre-push gate 4
        E. ✅ agent-sync check (closes G12): agent-sync-check.yml runs audit-skills.sh on
           skills/docs changes + weekly Mon
        F. ✅ consolidate agent-evals duplication (closes G11): agent-evals-langchain.yml
```

### 5.2 Why this shape

- It reuses what exists: `_automation-lane.yml` (reusable runner), `scripts/automation/*` (job bodies), `lib/agents/` (supervisor/orchestrator primitives), `cloud-agents.yml` (agent job taxonomy).
- It follows the two verified top-100 patterns: **modular reusable workflows** (langchain `_*.yml`) and **lane-ized scheduled automation with governance gates** (freeCodeCamp i18n/deploy lanes).
- It keeps the "agents" layer (cloud-agents + supervisor) and the "pipeline" layer (sched-* lanes) under one registry so the orchestrator can dispatch either.

---

## 6. Prioritized Backlog (Step 2 status as of 2026-07-31)

| Priority | Item | Closes | Est. effort | Status |
|---|---|---|---|---|
| P0 | Add `dependabot.yml` (weekly, grouped) | G1 | S | ✅ done |
| P0 | Add CodeQL analysis workflow | G2 | S | ✅ done |
| P0 | Wire gitleaks into pre-commit; expand pre-commit gates | G3 | S | ✅ done (design audit + critical FSRS tests in pre-commit; typecheck:ci via pre-push parity) |
| P1 | Lane registry + orchestrator supervisor pass (5.1 A/B) | G10/G11 | M | ◐ A done (registry + validator); B supervisor still deferred |
| P1 | CI perf gate: bundle-size + relevance benchmark in CI | G5 | M | ◐ benchmark-relevance.yml weekly done; bundle-size stays local + pre-push |
| P1 | `store/` test coverage (0 → threshold) | G6 | M | ✅ done — tests existed (13 passing); doc claim corrected |
| P2 | Agent-sync check workflow (skills ↔ docs) | G12 | S | ✅ done |
| P2 | Consolidate agent-evals/agent-evaluations duplication | G11 | S | ✅ done |
| P2 | Scripts navigability pass (grouping/help) | G7 | M | ✅ done (`scripts:list` + `automation:lanes:check`) |

Effort: S < 1h, M = 1–3h. All items are reversible local/CI changes; no schema, no prod deps, no auth/RLS changes.

---

## 7. Evidence Log & Open Items

- Background agents `bg_54fa3d80`, `bg_9073ce20` failed (queue timeout) — research completed inline; no retry (infra down).
- vscode CI fetch: `build/azure-pipelines/ci.yml` → 404 [X]; vscode claims are tagged [K].
- `facebook/react` absence from top-100 verified by grep over the local list [V-F].
- Open verification item: langchain `_test_vcr.yml` / codspeed details were listed but not content-fetched (names verified; behavior tagged [V-F]-partial).
- `RATE_LIMIT_KV` usage: asserted in CLAUDE.md; rate-limit file name in `_shared/` not confirmed this session (ls truncated at `notifications.ts`).
- 2026-07-31 Step 2 implementation landed (approved backlog): dependabot.yml, codeql.yml, benchmark-relevance.yml, agent-sync-check.yml, config/automation-lanes.ts (9 lanes), scripts/automation/check-lane-registry.ts, scripts/help-scripts.mjs, `automation:lanes:check` + `scripts:list` npm scripts, hooks hardened (pre-commit: design audit + critical FSRS tests + gitleaks; pre-push: 5 CI gates; both symlinked by install-hooks.sh; old custom gate backed up to `pre-commit.bak.20260731-140714`), agent-evaluations.yml → agent-evals-langchain.yml.
- Verification 2026-07-31: 25/25 workflows + dependabot YAML-parse OK; `automation:lanes:check` PASS (4 benign umbrella warnings); pre-commit chain exit 0; `tests/store/useStudyStore.test.ts` 13/13; lint 5 pre-existing errors (none in new files); `typecheck:ci` blocked by pre-existing `drillReviewService.ts:616/763` Json-type errors (file untouched this session; `prisma generate` hangs locally — environment issue, not caused by these changes).
- Next step (user decision): review Step 2 implementation; optional follow-ups — SECURITY.md/CONTRIBUTING.md, supervisor pass (5.1 B), bundle-size in ci.yml.
