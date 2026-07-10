# DevOps & Production-Readiness Reconciliation (Phase 8)

**Guide:** `audit_devops_production.md` (graded C+). **Rules:** safe repo-only improvements; no deploy, no cloud resources, no secret changes.

---

## 1. Reconciled state (verified)
- **CI (`ci.yml`)**: install → `prisma validate`/`generate` → `typecheck:ci` → `lint` → `build` → bundle-size → `test:critical` (gate) → `test` → coverage (advisory) → **`npm audit` (advisory, added this mission)** → artifact upload; plus `secret-scan` (Gitleaks) and blocking `e2e-a11y` gate. 16 workflows total (verified present).
- **Deploy (`deploy.yml`)**: on CI success → migrate deploy → build (+Sentry maps) → **`wrangler pages deploy` now with explicit `--branch/--commit-hash/--commit-message` (—commit-dirty removed)** → health check → advisory Lighthouse.
- Baseline gates verified **green locally** this mission (typecheck/lint/build/test:critical/audit:prisma/audit:zod).

## 2. Changes shipped (safe, repo-only)
| Change | File | Why |
|---|---|---|
| Remove `--commit-dirty=true`; add explicit commit metadata | `.github/workflows/deploy.yml` | Deploy traceability to reviewed SHA; safe (build artifacts gitignored → clean tree). |
| Add advisory `npm audit --audit-level=high` | `.github/workflows/ci.yml` | Surface dependency regressions in CI without wedging on the dev-tooling baseline. |
| Restore red gates to green | `renderStructuredRationale.ts`, `nccpa-question-weighting.ts`, `medicalComplianceService.ts` | typecheck + lint gates were failing on HEAD. |

## 3. Confirmed gaps (documented; owner/approval-gated — NOT actioned)
- **No LICENSE / SECURITY.md / dependabot.yml** → `docs/license-decision-needed.md` (owner picks; SECURITY/dependabot proposed).
- **No staging/preview gate; health check tolerates 503; hardcoded migration-recovery id** → plan in `docs/staging-and-deploy-safety-plan.md`.
- **Dependency vulns** → `docs/security-hardening-report.md` (audit-fix blocked by ERESOLVE; gated).
- **259 remote branches** (hygiene) → deletion approval-gated; weekly hygiene workflow exists but under-keeping-pace.
- **Coverage thresholds 35-40%; full E2E manual-only; no load testing; no structured logging/metrics/SLOs/log-drain** → post-launch backlog (repo already has Sentry + runtime-sanity cron).

## 4. Manual production release checklist (repo reference)
```
[ ] CI green on the release commit (build, typecheck:ci, lint, test:critical, test, secret-scan, e2e-a11y)
[ ] npm audit reviewed (no NEW prod critical/high)
[ ] Pending Prisma migrations reviewed + approved by owner (additive/reversible)
[ ] Deploy to PREVIEW env first (see staging plan); run test:e2e:production-smoke → green
[ ] Secrets set in Cloudflare Dashboard (Prod+Preview): CLERK_SECRET_KEY, DATABASE_URL, GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY
[ ] Promote to production (workflow_dispatch) — deploy tied to reviewed SHA (no --commit-dirty)
[ ] Post-deploy health = 200 (tighten from 503); smoke pass; watch Sentry
[ ] Rollback ready: wrangler pages deployment rollback + docs/ROLLBACK.md
```

## 5. Net
DevOps foundation is strong (matching the audit's "surprisingly mature"). This mission tightened two concrete safety items (deploy traceability + CI audit visibility) and restored green gates; the remaining C+ blockers are legal/ops items that are owner-decisions or require live resources, all documented and gated.
