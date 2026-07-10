# Code Quality & Architecture Cleanup Map (Phase 7)

**Guide:** `audit_code_quality.md`. **Rules:** no broad rewrites; no deletions without proving zero callers; prefer small deprecations/import fixes/proposals; verify against code.

---

## 1. Fixes already shipped this mission (baseline restoration)
- **Production typecheck** unblocked (`lib/study/renderStructuredRationale.ts` — `cleanText` param `unknown`). commit `611e115f`.
- **Lint gate** unblocked (3 `no-empty` in `nccpa-question-weighting.ts` + `medicalComplianceService.ts`). commit `6cbafe53`.

These were real gate failures on HEAD; fixing them is prerequisite to any "green baseline" claim.

## 2. Triage of audit code-quality findings (verified)

| Finding | Verified | Recommendation (no risky action taken) |
|---|---|---|
| **Orphaned `lib/sessionInterleaving.ts`** | Only referenced in `docs/*` + `HYGIENE-TODO.md`; **no source import** found. | Likely safe to delete, but **deletion deferred** — recommend a dedicated hygiene PR that re-greps then removes. Not deleted here (mission: prove + prefer deprecation; avoid risky deletion). |
| **Orphaned `services/core/enhancedQuestionPool.ts`** | Same — docs-only references, no source import. | Same: hygiene-PR candidate; not deleted. |
| **`lib/toast.ts` deprecated (→ `useToastStore`)** | **~14 live callers** confirmed (e.g. `AppLayout`, `ClinicalReferenceLibrary`, `useDrillFSRS`, several modes). **Not** orphaned. | Real migration debt; scoped follow-up PR to migrate callers, then remove. Not done here (touches 14 files = not "reviewable-small", risk of regressions). |
| **`App.tsx` god component (900+ lines)** | Confirmed large, many imports. | Decomposition = large refactor → follow-up proposal; **not** attempted (mission: no broad rewrites). |
| **tsconfig fragmentation (10+ files)** | Confirmed (base/ci/production/slice configs). | Intentional (CI scoping); consolidation is low-value/risky → leave; document rationale. |
| **`noUnusedLocals/noUnusedParameters: false`** | Confirmed. | Enabling would surface many warnings-as-errors → gated cleanup PR; not flipped. |
| **`skipLibCheck: true`** | Confirmed. | Standard for large TS projects; leave. |
| **`_trash/` directory in repo** | Present (legacy routes/tests). | Recommend removal in a hygiene PR (prove no imports — legacy `lib/middleware/validation.ts` importers were only `_trash` + dev `server.ts`). Not deleted here. |
| **Dual auth (Clerk prod vs Express dev)** | Confirmed: `functions/api/_shared/*` (prod) vs `server.ts`+`lib/middleware/*` (dev). | By design (dev-only Express); document; retire `server.ts` per `deployment/README.md` in a follow-up. |
| **Dual data access (Prisma + Supabase client)** | Confirmed. | Intentional (edge Prisma + client Supabase w/ RLS); document; no change. |

## 3. Why no deletions/refactors were performed
Per mission + design-system rules and "keep changes reviewable": deletions require a dedicated hygiene PR with a fresh full-repo import scan and CI green; large refactors (App.tsx, toast migration) exceed the "small, focused, reviewable" bar and risk regressions. All are captured here as **scoped follow-up PR recommendations**.

## 4. Recommended follow-up PRs (owner-prioritized)
1. `chore(hygiene): remove proven-orphan files + _trash/` (re-verify no imports first).
2. `refactor(toast): migrate 14 callers lib/toast.ts → useToastStore, then remove`.
3. `refactor(app): extract App.tsx providers/routing into composable shells` (parked `wip/quizview-refactor-parked` context applies).
4. `chore(ts): enable noUnusedLocals/noUnusedParameters + clean warnings`.
