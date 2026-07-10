# PANaCEa Audit Stabilization — Implementation Expansion Pass

> ## Continuation pass (Phases 5–10) — update
> Real code/test work completed after the initial pass:
> - **Phase 5 (security/deps):** added `.github/dependabot.yml` (npm + github-actions, grouped, react-router-dom major gated). SECURITY.md, CI `npm audit`, secret-scan + import-boundary guards already existed.
> - **Phase 6 (a11y):** full-impact axe scan found + fixed a landing `heading-order` violation (`components/landing/Hero.tsx`: decorative preview `<h3>`→`<p>`). Post-fix `/`, `/study`, `/practice`, `/progress` = **0 axe violations at every severity**. Added `scripts/qa/axe-all.mjs`.
> - **Phase 7 (dashboard truthfulness):** verified all fallback datasets are tagged `source:'mock'` and widgets render visible mock/"calibrating"/"Mock review" indicators; added `commandCenterMockData.truthfulness.test.ts` (6) as a regression guard. No unlabeled mock data.
> - **Phase 8 (refactor):** removed the dead/misleading `dev:server:legacy` npm script (`server.ts` imports a missing `./routes` and cannot run); tidied retirement notice + runbook.
> - **Phase 9 (devops):** CI now runs the headless UI smoke (landing render + protected-route gating) in the a11y job, reusing Chromium + built dist on a separate port.
> - **Phase 10 (validation):** typecheck 0 errors · lint 0 errors · build ✅ · full suite **538 files / 9933 passed / 0 failed** · npm audit 25 (gated).
>
> Files changed: `.github/dependabot.yml`, `components/landing/Hero.tsx`, `scripts/qa/axe-all.mjs`, `components/dashboard/adaptive/page/commandCenterMockData.truthfulness.test.ts`, `package.json`, `scripts/dev/express-retired.mjs`, the local-dev runbook, `.github/workflows/ci.yml`.
> Blocked/gated: `npm audit fix` (ERESOLVE peer conflict), dependency majors, RLS DB policies, LICENSE, authenticated browser QA (needs Clerk/DB test creds).



**Branch:** `cursor/panacea-audit-stabilization-efdd` (continues the prior run; base after prior final report `3faf8d7e`).
**Constraints honored:** no prod connections; no secrets; no migrations/backfills; no auth/RLS/validation/type/test/security weakening; no removed tests; **no explicit FSRS confidence/rating buttons** (implicit/behavioral only); ≤2 repair attempts/failure-class.

## 1. Executive summary
This pass moved from documentation to **implementation**: 3 API endpoints hardened, 2 new architectural regression guards, a new reusable a11y primitive with a real consumer, an honest-labeling a11y fix, a read-only DevOps hygiene tool, and a dashboard response-contract test — **~27 new tests, all green**. It also verified (against code) that several remaining audit items are **stale/already-correct** (toast, orphan files, prescription/readiness widgets), avoiding pointless churn. Full suite grew 529→**532 files / 9860→9887 tests, 0 failures**.

## 2. Why the previous run was insufficient
The prior run was verification-heavy: it restored two red gates and shipped ProgressRing/chart ARIA + deploy/CI safety, but otherwise produced reports. It left concrete, safe implementation on the table — endpoint bound/`.strict()` hardening, architectural import guards, an a11y primitive with a consumer, and a hygiene tool — which this pass delivers.

## 3. Code clusters implemented
1. **API validation hardening** (Phase 4) — bounded lengths + finite/range numerics + `.strict()` unknown-field rejection on 3 high-risk mutation schemas; schemas exported for direct unit testing.
2. **Architectural import guards** (Phase 5/8) — `tests/import-boundaries.test.ts`: production edge functions must not import `express`/`lib/middleware/*` (legacy dev sanitizer); production source must not import `_trash/`.
3. **Accessibility** (Phase 6) — new `components/a11y/VisuallyHidden` primitive, consumed by `TrendIndicator` to announce trend direction (glyph now `aria-hidden`); honest `aria-label` for coming-soon training modes (Phase 3).
4. **Security repo-local** (Phase 5) — `SECURITY.md`; `docs/dependency-vulnerability-triage.md`.
5. **DevOps** (Phase 9) — read-only `scripts/repo/branch-hygiene-report.mjs` + `npm run repo:branch-hygiene`.
6. **Core-loop contract** (Phase 2) — `/api/srs/due` dashboard response-contract tests.

## 4. Files changed (16)
Code: `functions/api/push/subscribe.ts`, `functions/api/analytics/soap-note.ts`, `functions/api/reviews/second-chance.ts`, `components/a11y/VisuallyHidden.tsx`, `components/a11y/index.ts`, `components/ui/Sparkline.tsx`, `components/dashboard/TrainingMenu.tsx`, `scripts/repo/branch-hygiene-report.mjs`, `package.json`, `SECURITY.md`.
Tests: `functions/api/__tests__/validation-hardening.test.ts` (new), `tests/import-boundaries.test.ts` (new), `components/a11y/VisuallyHidden.test.tsx` (new), `components/ui/viz-a11y.test.tsx` (extended), `functions/api/srs/due.test.ts` (extended).
Docs: `docs/dependency-vulnerability-triage.md`, this report.

## 5. Tests added/updated (~27 new, all green)
- validation-hardening: 16 · import-boundaries: 3 · VisuallyHidden: 2 · TrendIndicator direction: 3 · due dashboard-contract: 3.

## 6. Commands run
`npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:critical`, `npm test`, `npm audit --audit-level=moderate`, `npm run repo:branch-hygiene`, focused `vitest` runs per cluster, `npm audit fix --dry-run` (ERESOLVE — gated).

## 7. Before / after validation
| Gate | Before (this pass) | After |
|---|---|---|
| typecheck (prod) | ✅ | ✅ |
| lint | ✅ 0 err | ✅ 0 err |
| build | ✅ | ✅ |
| test:critical | ✅ 143 | ✅ 143 |
| full `npm test` | 529 files / 9860 | ✅ **532 files / 9887 / 0 failed** |
| npm audit | 25 vulns | 25 vulns (gated; unchanged) |

## 8. Mock/stub surfaces fixed/gated/hidden
- **Verified already-honest (no misleading surfaces):** readiness/timeline/prescription widgets use real data when available and render a visible `mock` badge otherwise; "coming soon" drills/study-groups/institutional features are labeled or hidden.
- **Fixed:** coming-soon training-mode cards now announce an honest `aria-label` ("… coming soon, not yet available") instead of "Open …" (they already blocked navigation via `disabled`).

## 9. API endpoints hardened
- `POST/DELETE /api/push/subscribe` — URL/key length caps + `.strict()`.
- `POST /api/analytics/soap-note` — caseId length, finite/bounded score, `.strict()` body.
- `POST /api/reviews/second-chance` — scopeFilter bounds + `.strict()` (top-level + nested).
- Verified already-hardened (no change): `grand-rounds/submit`, `scribe/soap/extract`, `knowledge/upload` — consistent with `audit:zod` 0-fail.
- **Contracts:** full request/response shapes for these and other changed routes are in [`docs/api/API_OVERVIEW.md`](api/API_OVERVIEW.md).

## 10. Security improvements
- Import-boundary test guarantees the legacy regex sanitizer (`lib/middleware/*`) and `express` can never reach production edge functions.
- `SECURITY.md` (private disclosure via GitHub advisories; no fabricated contacts).
- Dependency triage doc + advisory CI `npm audit` (from prior pass). `npm audit fix` remains blocked by a `wrangler`/`@cloudflare/workers-types` ERESOLVE → gated with an exact precondition fix.

## 11. Accessibility improvements
- `VisuallyHidden` primitive (audit-requested) + real consumer.
- `TrendIndicator` trend direction now screen-reader announced; decorative glyph hidden.
- Honest coming-soon `aria-label`. (Prior pass: ProgressRing + Sparkline/EpistemicGauge/AnimatedCounter.)

## 12. Feature-wiring improvements
- Verified the study-prescription/readiness widgets are **already real-data-backed when available with honest mock labeling** and proper empty/`aria-busy` states — the target behavior. Deeper persistence wiring needs an approval-gated migration (`StudyPrescription`/persistence table); not fabricated.

## 13. Code-quality refactors
- Import-boundary guards (functions + `_trash`).
- Verified **stale**: `lib/sessionInterleaving.ts` / `services/core/enhancedQuestionPool.ts` are already deleted; `lib/toast.ts` already delegates to `useToastStore` (correct imperative API for non-React callers) → no migration/churn.

## 14. DevOps improvements
- `scripts/repo/branch-hygiene-report.mjs` (read-only; 260 branches / 199 stale >120d surfaced) + npm script. No deploys, no external resources, no branch deletion.

## 15. What remains approval-gated
Dependency upgrades (align `@cloudflare/workers-types@^5` → `npm audit fix` → patch react-router-dom/@clerk→js-cookie/nodemailer); LICENSE choice; secret/anon-key rotation; Prisma migrations/backfills (incl. prescription persistence table); staging env; branch deletion; DOMPurify direct dep; #239 live rollout (needs GEMINI/DATABASE/CLERK).

## 16. What remains too large for this PR
App.tsx decomposition; full route-level code splitting; raising coverage thresholds; promoting full E2E/a11y suites to blocking; structured logging/metrics/SLOs; deleting `_trash/` wholesale.

## 17. Next recommended implementation PRs
1. `deps:` type-align + `npm audit fix` + prod-dep patches (tests).
2. `feat(db):` propose `StudyPrescription` persistence table → wire prescription widget to real persisted plan.
3. `ci:` add dependabot; promote a11y/API-contract subset to blocking once stable.
4. `a11y:` document OKLCH contrast ratios; mobile axe project.
5. `chore(hygiene):` owner-approved stale-branch prune using the new report.
