# Root-Cause Stabilization Plan

**Date:** 2026-07-09
**Branch:** `cursor/panacea-root-cause-stabilization-72c0`
**Source material:** `UNFINISHED_WORK_MASTER_AUDIT.md` (2026-04-16), `pancea-deep-research-report-2026-05-22.md`
**Prior reconciliation this builds on:** `docs/implementation/AUDIT_RECONCILIATION.md`, `docs/implementation/IMPLEMENTATION_QUEUE.md` (TASK-001…TASK-021, already merged into this branch's history).

> This document is **additive**. It does not rewrite the audits or the prior reconciliation. It
> records the verified current baseline, classifies each mission finding as LIVE / STALE /
> APPROVAL-GATED against current code, and states exactly what this run fixes vs. documents.

---

## 1. Current validation baseline (verified 2026-07-09)

| Check | Command | Before this run | After Phase 1 |
|---|---|---|---|
| Type safety (prod) | `npm run typecheck` (`tsconfig.production.json`) | **2 errors** (`lib/study/renderStructuredRationale.ts`) | **0 errors** ✅ |
| Lint | `npm run lint` (`eslint . --max-warnings 2000`) | **3 errors**, 254 warnings | **0 errors**, 251 warnings ✅ |
| Build | `npm run build` | pass (~17s) | pass (~17s) ✅ |
| Unit/integration tests | `npm test` | 9,850 pass / 1 skip / **0 fail** (527 files) | 9,850 pass (+1 new) / 0 fail ✅ |
| Critical tests | `npm run test:critical` | 143 pass | 143 pass ✅ |
| Zod validation audit | `npm run audit:zod` | 202 PASS / 2 WARN (out-of-band) / **0 FAIL** | unchanged ✅ |
| Prisma disconnect audit | `npm run audit:prisma` | **All pass** | unchanged ✅ |
| Loading-state audit | `npm run audit:loading` | 1 content-spinner remnant | 1 remnant |
| Service consolidation audit | `npm run audit:services` | 15 files (target 15-20) — advisory | advisory |

**Known, out-of-scope, non-CI-gating:** `npm run typecheck:all` (full strict `tsc`) reports ~1,151
error lines concentrated in `services/optimizer/*`, `services/imageOptimizationService.ts`, and
`functions/api/admin/refinery/action.ts`. These are pre-existing and **not** gated by CI (CI uses
`tsconfig.ci.json` / `tsconfig.production.json`). They are documented in `docs/cursor-followup-issues.md`,
not fixed in this run (too broad, unrelated to the stabilization clusters).

---

## 2. The dominant root cause: documentation drift

Both source audits are **substantially stale**. The repository advanced well past both the 2026-04-16
audit and the 2026-05-22 deep-research report. A prior agent effort (TASK-001…TASK-021, present in
this branch) already fixed the headline findings. Treating the audits as a live backlog would reopen
closed work — explicitly forbidden by the mission. This plan therefore:

1. Verifies each finding against current code.
2. Fixes only the small set of **genuinely live, safe** issues.
3. Documents the **approval-gated** production blockers as proposals.

---

## 3. Finding-by-finding classification (audit → current code)

Legend: **STALE** = already fixed / false positive; **LIVE-FIXED** = real & fixed this run;
**LIVE-DEFERRED** = real but risky/large, progressed conservatively or documented;
**APPROVAL-GATED** = needs human sign-off (schema/data/prod/product/deps).

| # | Audit finding | Classification | Evidence |
|---|---|---|---|
| 1 | OSCE bogus `queueAnswer({ questionId: sessionId })` write | **STALE** | Removed by TASK-001 (`0e0fed16`). Not present in `PatientEncounterMode.tsx`; only `updateConditionSchedule(...)` @985 remains (correct condition-level SRS artifact). |
| 2 | API Zod validation — "145 endpoints fail" | **STALE** | Was a detection bug in `scripts/audit-zod-validation.ts` (didn't recognize the 7 middleware wrappers). Fixed; today `audit:zod` = 202 PASS / 0 FAIL. |
| 3 | Prisma disconnect — "18 files fail" | **STALE** | False positives; today `audit:prisma` reports all pass. |
| 4 | Deprecated `functions/api/questions/review.ts` | **STALE** | Retired (410 tombstone / removed) by TASK-010; clean caller inventory. |
| 5 | Loading-state normalization inconsistent | **STALE (mostly)** | TASK-012…021 = 72 migrations across 67 files. `audit:loading` now = 1 remnant. |
| 6 | 2 production `tsc` errors (`renderStructuredRationale.ts`) | **LIVE-FIXED** | Root cause: unsafe `keyof` indexed access. Fixed with narrowed `WhyIncorrectKey` type + test. |
| 7 | 3 `no-empty` lint errors | **LIVE-FIXED** | `lib/nccpa-question-weighting.ts` (×2), `services/medicalComplianceService.ts` (×1). Documented with comments. |
| 8 | Dead/unreachable `OSCEResultsView` branch in PatientEncounterMode | **LIVE-FIXED** | Second `viewState === 'results'` branch unreachable (prior branch returns first). Removed + orphaned import + unused `aar` binding. |
| 9 | PatientEncounterMode monolith — active-view extraction | **LIVE-DEFERRED** | ~990 inline lines. A prior monolithic `EncounterActiveView.tsx` (1,267 lines, `8b270979`) was created then **backed out** (`2af22271`). Progressed conservatively; see §5. |
| 10 | `functions/api/srs/submit.ts` narrowing / `SRSItem` drop | **APPROVAL-GATED** | Active caller `SrsFlashcardView`; model drop = migration. Documented in `docs/fsrs-legacy-retirement-plan.md`. |
| 11 | Express-to-Edge retirement | **APPROVAL-GATED** | Documented in `docs/express-to-edge-retirement-map.md`. |
| 12 | Push reminders + `NotificationLog` | **APPROVAL-GATED** | Migration + `web-push` dep + scheduler. Documented in `docs/push-reminder-runtime-plan.md`. |
| 13 | Study-groups/social, disabled admin endpoints, placeholder AI | **APPROVAL-GATED** | Documented in `docs/hidden-and-placeholder-feature-inventory.md`. |
| 14 | Source identity migration | **APPROVAL-GATED** | `docs/source-identity-migration-proposal.md`. |
| 15 | Runtime smoke tests | **APPROVAL-GATED (partly prep-able)** | `docs/runtime-smoke-test-plan.md`. |
| 16 | Atomic durable review writes | **APPROVAL-GATED** | `docs/atomic-review-write-plan.md`. |
| 17 | Embedding backfill/versioning | **APPROVAL-GATED** | `docs/embedding-versioning-plan.md`. |

---

## 4. Orchestration-asset reconciliation (mission vs. repo)

The mission enumerates `.cursor/agents/*.md`, `.cursor/workflows/*.workflow.md`, and skills like
`failure-triage`, `agent-orchestration`, etc. **None of these exist in the repository.** The real
agent system is:

- `.agents/skills/` — 44 skills (`panacea-navigator`, `panacea-session-pipeline`, `panacea-fsrs-guardrails`, …)
- `.claude/skills/` — Claude-Code-specific skills (`cf-edge-api`, `fsrs-domain`, `auth-policy-review`, …)
- `.cursor/` — `commands/`, `plans/`, `rules/` only (no `agents/`, `workflows/`, or `memory/`).

**Decision:** per the mission ("do not merely add rules, skills, docs, or agent infrastructure"), the
missing `.cursor/agents/*` and `.cursor/workflows/*` files are **not** fabricated. This run acts as
the orchestrator directly and uses the real skills. Only `.cursor/memory/*` (explicitly requested by
Phase 9) is created.

---

## 5. Root-cause clusters & work items (ranked by safety × impact × dependency)

1. **Documentation drift** (root cause of most "backlog") → reconcile-and-record (this doc + §3). *Done.*
2. **Type-safety leak at dynamic-key boundary** → `renderStructuredRationale.ts`. *LIVE-FIXED.*
3. **Lint hygiene (`no-empty`)** → 3 sites. *LIVE-FIXED.*
4. **Dead code** → OSCEResultsView branch. *LIVE-FIXED.*
5. **PatientEncounterMode monolith** → conservative, incremental sub-panel extraction, behavior-preserving,
   one commit per sub-panel, `typecheck`+`test:critical` between each. Stop + document if prop-drilling
   explodes (heuristic: > ~15 props or requires lifting refs). *LIVE-DEFERRED (conservative).*
6. **Split-brain backend / legacy compatibility** (Express/routes, SRS submit) → inventory + document,
   no blind removal. *APPROVAL-GATED.*
7. **Built-but-not-operational systems** (push reminders, library enrichment, embeddings, source
   identity, atomic writes, smoke tests) → proposal docs with concrete contracts. *APPROVAL-GATED.*

---

## 6. What this run fixes vs. only documents

**Fixes (code, this run):**
- `renderStructuredRationale.ts` type errors + regression test.
- 3 `no-empty` lint errors.
- Dead `OSCEResultsView` branch removal.
- Conservative PatientEncounterMode sub-panel extraction (behavior-preserving), or a documented design
  deferral if too risky.
- (Optional) remaining loading-state remnant cluster; leaf-level design-token conversions only where obvious.

**Documents only (approval-gated):** Express-to-Edge map; FSRS/SRS legacy retirement plan; push-reminder
runtime plan + `NotificationLog` migration proposal; hidden/placeholder feature inventory; source-identity,
runtime-smoke-test, atomic-review-write, and embedding-versioning proposals; repo memory + follow-up issues
+ final report.

---

## 7. Human approval gates (STOP and ask)

Schema migrations · data backfills · production DB writes · RLS/auth/Clerk changes · push-reminder
scheduler activation · production deployment · deleting large feature areas · paid/external services ·
adding credentials · billing changes · broad dependency upgrades · removing compatibility endpoints
with possible active callers.

## 8. Stop conditions

- Any approval-gated item reached → stop, request approval, do not proceed on that item.
- PatientEncounterMode sub-extraction prop-drilling exceeds threshold → stop, document the required
  state/context refactor.
- Any full-gate command fails after **2** repair attempts per failure class → stop, document exact
  error + paths. Never hide failures; never delete tests or weaken checks to pass.
- Scope creep beyond §3 LIVE items → stop, add to `docs/cursor-followup-issues.md`.

## 9. Validation protocol

- After each meaningful change: `npm run typecheck` + `npm run test:critical`.
- Before final report (full gate): `npm run typecheck`, `npm run lint`, `npm run build`,
  `npm run test:critical`, `npm test`, plus relevant `audit:*`.
