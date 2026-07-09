# Repository Audit — Implementation Final Report

## 1. Executive summary
Implementation pass against the 17-finding `PANaCEa_Repository_Audit_Report.md`. Every itemized finding was verified against current code and **fixed**, **disproven with evidence**, or **approval-gated** — not merely documented. Highlights: a real FSRS parameter-safety bug (**CODE-001 `w[6]`**) fixed with validation + repair + 11 tests; both stale FSRS docs rewritten/quarantined to the implicit model + a docs guard (**DOC-001/002**); the broken Express local-dev path retired with a redirect to the working Cloudflare path (**FEAT-001/002**); and the security findings (**SEC-001..004**) verified and locked in with regression tests/guards. **~40 new tests; full suite 537 files / 9927 passed / 0 failed.**

## 2. Branch and commit
`cursor/panacea-audit-stabilization-efdd`, base `671bd417` → head at final report commit.

## 3. Uploaded audit file reviewed
`PANaCEa_Repository_Audit_Report.md` — not attached to the workspace, but the mission brief itemized 15 findings (DOC-001/002/003, CODE-001..004, SEC-001..004, FEAT-001..003, DEVOPS-001); 2 further findings in the "17" total were unspecified (recorded in the log).

## 4. Finding-by-finding status
| ID | Finding | Status |
|----|---------|--------|
| DOC-001 | Quick-ref uses stock 4-button FSRS | **Fixed** (rewritten) + guard |
| DOC-002 | Summary references stock ts-fsrs/Rust | **Fixed** (superseded banner) |
| CODE-001 | `w[6]` silently 0/undefined | **Fixed** (validate+repair) + 11 tests |
| DOC-003 | ReviewLog not written | **Stale** (wired; OSCE isolated) |
| SEC-001 | wrangler.toml secrets | **Stale** (public-only) + secret-scan guard |
| SEC-002 | admin unprotected | **Stale/false-positive** + 5 guard tests |
| SEC-003 | RLS/service-role bypass | **Partial**: import boundary added; RLS policy = gated |
| SEC-004 | unsafe innerHTML/XSS | **Stale** (all sanitized) + adversarial tests |
| CODE-002 | deprecated toast callers | **Stale/false-positive** (delegates to store) |
| CODE-003 | dead/orphan files | **Stale** (already removed) + `_trash` guard |
| CODE-004 | implicit-metrics under-tested | **Fixed** (+13 tests) |
| FEAT-001 | Express custom-session 404 | **Fixed** (Express retired→wrangler) |
| FEAT-002 | Express lab-cases 404 | **Fixed** (Express retired→wrangler) |
| FEAT-003 | behavioral signals not wired | **Stale/verified wired** |
| DEVOPS-001 | missing LICENSE | **Approval-gated** |
| (2 more) | unspecified in brief | Recorded; need source rows |

Tally: **5 fixed with code/docs** (DOC-001, DOC-002, CODE-001, FEAT-001, FEAT-002) · **1 fixed test-gap** (CODE-004) · **6 stale-but-hardened with new tests/guards** (DOC-003, SEC-001, SEC-002, SEC-003, SEC-004, CODE-003) · **2 stale/false-positive** (CODE-002, FEAT-003) · **1 approval-gated** (DEVOPS-001) · **2 unspecified**.

## 5. Findings fixed with code
- **CODE-001** `lib/fsrs.ts`: `isParamsOnCurrentScale` requires all weights finite; `normalizeParameters` repairs non-finite required weights from defaults.
- **FEAT-001/002** `package.json` + `scripts/dev/express-retired.mjs`: retired the broken Express dev path (redirect to `dev:wrangler`), where the flagged endpoints exist.
- **DOC-001/002** FSRS docs rewritten/corrected to the implicit model.
- **CODE-004** new implicit-metrics tests for previously-untested exports.

## 6. Findings disproven / stale (with evidence)
- **DOC-003**: `drillReviewService`→`reviewLogService` writes ReviewLog; sidecar filters `review_type:'real'`; OSCE writes none. 34 existing tests.
- **SEC-001**: `wrangler.toml` assignment lines are `VITE_*` public only.
- **SEC-002**: all admin routes wrapped in `<AdminRoute>` + server `adminAuthenticatedEndpoint`.
- **SEC-004**: all 3 `dangerouslySetInnerHTML` route through `sanitizeForRationale`.
- **CODE-002**: `lib/toast.ts` already delegates to `useToastStore` (not deprecated).
- **CODE-003**: orphan files already deleted.
- **FEAT-003**: `useImplicitMetrics` captures + posts behavioral signals across QuizView/drills.

## 7. Findings approval-gated
- **DEVOPS-001** LICENSE (owner must choose — `docs/license-decision-needed.md`).
- **SEC-003** RLS *policy* changes (DB migration — gated); import boundary added now.
- Dependency upgrades (ERESOLVE-blocked — `docs/dependency-vulnerability-triage.md`).

## 8. Files changed
`lib/fsrs.ts` · `docs/FSRS_V6_QUICK_REFERENCE.md` · `docs/FSRS_V6_IMPLEMENTATION_SUMMARY.md` · `package.json` · `scripts/dev/express-retired.mjs` · the local-dev runbook · `docs/repository-audit-implementation-log.md` · this report.

## 9. Tests added/updated (~40 new)
`tests/fsrs-param-validation.test.ts` (11) · `tests/fsrs-docs-guard.test.ts` (3) · `tests/sanitizeHtml.test.ts` (+5→8) · `components/auth/AdminRoute.test.tsx` (5) · `tests/wrangler-config-safety.test.ts` (2) · `tests/import-boundaries.test.ts` (+service-role guard) · `lib/implicit-metrics.extra.test.ts` (13).

## 10. Browser flows tested
**Blocked** (no Clerk/DB credentials; hard boundary = no prod services/secrets). `dev:wrangler` needs `CLERK_SECRET_KEY`/`DATABASE_URL`; authed routes need a Clerk test user. Component-level flows covered by RTL instead: AdminRoute (logged-out/non-admin/admin), sanitizer paths. Manual checklist (for an env with test creds): landing → auth → dashboard → study/review submit → drill → Lab Interpretation → Custom Study Builder → admin (logged-out/normal/admin) → toasts.

## 11. Screenshots/traces location
None generated (browser QA blocked). Automated evidence: `npm test` (9927 passing) + focused suites above.

## 12. Console/network findings
N/A (no browser session). No new console/network paths introduced; changes are backend/docs/test + dev-script redirect.

## 13. Security impact
No auth/RLS/validation weakened. New guards: service-role import boundary (SEC-003), wrangler secret-scan (SEC-001), XSS adversarial tests (SEC-004), AdminRoute tests (SEC-002). No secrets added/rotated.

## 14. FSRS / implicit-confidence impact
CODE-001 prevents silent difficulty-freeze / NaN from corrupt weights (defaults fallback; no semantics change for valid params). Docs now correctly describe the **implicit, behaviorally-derived, no-buttons** model; a guard prevents regression. No explicit rating UI added.

## 15. ReviewLog / data-isolation impact
Confirmed production writes + `review_type:'real'` optimizer isolation + OSCE non-pollution (no code change needed; evidenced).

## 16. Admin / RLS impact
Admin routes verified protected (client `<AdminRoute>` + server `adminAuthenticatedEndpoint`); regression tests added. Service-role client kept server/edge-only (runtime guard + new import boundary). RLS policy changes remain DB-gated.

## 17. XSS / sanitization impact
All production `dangerouslySetInnerHTML` sanitized via `sanitizeForRationale`; adversarial coverage added (protocols, mixed-case, rel enforcement, svg/img handlers). Legit medical formatting preserved.

## 18. Express / local-dev parity impact
Express dev path was broken (missing `./routes`). Retired with fail-fast redirect to `dev:wrangler` (full CF parity incl. custom-session + lab-cases); docs updated; raw legacy command preserved as `dev:server:legacy`.

## 19. Toast / dead-code cleanup impact
No churn: `lib/toast.ts` is the canonical imperative API (delegates to store); orphan files already removed. `_trash` import guard added.

## 20. Commands run
`npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:critical`, `npm test`, `npm audit --audit-level=moderate`, plus per-cluster `vitest` runs and `npm run dev:server` (verified the retirement guard).

## 21. Before/after validation
| Gate | Before | After |
|------|--------|-------|
| typecheck | ✅ | ✅ 0 errors |
| lint | ✅ | ✅ 0 errors (251 warns < cap) |
| build | ✅ | ✅ |
| full `npm test` | 532 files / 9887 | ✅ **537 files / 9927 / 0 failed** |
| npm audit | 25 vulns | 25 vulns (gated) |

## 22. Remaining blockers
LICENSE choice (owner); RLS DB policy hardening; dependency upgrades (ERESOLVE precondition); authenticated browser QA (needs Clerk/DB test creds); 2 unspecified audit findings (need source file).

## 23. Next recommended PRs
1. `deps:` align `@cloudflare/workers-types@^5` → `npm audit fix` → patch react-router-dom/@clerk/nodemailer (tests).
2. `db:` RLS policy review + coverage for user-scoped tables (approval-gated migration).
3. `legal:` add owner-chosen LICENSE.
4. `qa:` wire Clerk test creds in a safe staging env → run the authenticated browser checklist (§10).
5. Provide the 2 unspecified audit rows for triage.
