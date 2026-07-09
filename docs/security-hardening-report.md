# Security Hardening Report (Phase 3)

**Method:** current code + `npm audit` on this branch. No prod connections; no secrets added/rotated. Findings reconciled against the audit bundle (`security_audit_report.md` 2025-01-21, `audit_code_quality.md`, `audit_devops_production.md`).

---

## 1. Overall posture (reconciled)

The bundle's older security audit and the newer specialists agree the security **core is mature**: Clerk JWT auth + 3-tier RBAC, Zod `.strict()` validation on all mutation endpoints (verified: `npm run audit:zod` → 202 endpoints, 0 fail), tiered Cloudflare-KV rate limiting, secret redaction/blacklist logging, no raw SQL (`$queryRaw`/`$executeRaw` absent), `safePrismaDisconnect` everywhere (`npm run audit:prisma` → 315 endpoints, 0 fail). The real, actionable gaps are dependency vulnerabilities, committed client-public config, and (legacy-only) sanitizer wording.

---

## 2. Dependency vulnerabilities (`npm audit`)

**Totals:** 25 (2 critical, 11 high, 10 moderate, 2 low).

### Classification
| Package | Severity | Prod/Dev | Notes |
|---|---|---|---|
| `shell-quote` (via `concurrently`) | critical | **dev** | dev script runner only |
| `react-router` / `react-router-dom` `^7.11` | high | **prod** | turbo-stream deserialization / protocol-relative open redirect |
| `@clerk/shared → js-cookie` | high | **prod** | cookie-attribute injection (auth surface) |
| `nodemailer` `^8.0.7` | high | **prod (server)** | CRLF header injection / jsonTransport bypass |
| `vite`, `esbuild`, `miniflare`, `wrangler`, `undici`, `ws`, `hono`, `@hono/node-server`, `@prisma/dev`, `protobufjs`, `@babel/core`, `brace-expansion`, `js-yaml`, `qs`, `body-parser`, `express`, `dompurify`(transitive) | high/mod/low | mostly **dev/build/transitive** | build tooling + legacy Express dev server |

### Remediation attempt & result
- `npm audit fix --dry-run` **fails with ERESOLVE**: `wrangler@4.110` requires `@cloudflare/workers-types@^5`, but the repo pins `^4`. Fixing therefore needs `--force` or `--legacy-peer-deps` → **broad/breaking → approval-gated** (not applied). *(1 repair attempt made; not retried with force per mission rules.)*
- **CI advisory added** (`ci.yml`): `npm audit --audit-level=high` (non-blocking) surfaces regressions without wedging CI on the dev-tooling baseline.

### Exact gated remediation (owner approval to run)
1. **Align Cloudflare types** so `audit fix` can resolve: bump `@cloudflare/workers-types` to `^5` (matches installed `wrangler@4.110`) — verify `functions/**` typecheck, then run `npm audit fix` (no `--force`).
2. **Prod-facing majors (test required):** `react-router-dom` patch/minor within `7.x` if available; else evaluate the security-patched release. `@clerk/*` bump to a release pulling patched `js-cookie`. `nodemailer` patch/minor.
3. Re-run `npm audit`; then tighten the CI step to `--omit=dev --audit-level=high` blocking.
4. Add `.github/dependabot.yml` (npm, weekly) — proposed, not added (repo-config change).

---

## 3. XSS sanitizer (reconciled — over-severity)

- **Flagged file `lib/middleware/validation.ts`** (regex `sanitizeString`, "dev-only" warning) is imported **only** by legacy `server.ts` (Express dev server, not deployed) and `_trash/old-routes/*`. It is **not** on the production Cloudflare path.
- Production input handling = `functions/api/_shared/validation.ts` (`sanitizeString` strips `<>`, `javascript:`, event handlers) **plus** Zod `.strict()` schemas on every mutation endpoint (0 audit:zod failures). React escapes output by default.
- **Implementation Expansion Pass (2026):** bounded length/range validation added to `POST/DELETE /api/push/subscribe`, `POST /api/analytics/soap-note`, and `POST /api/reviews/second-chance`; `GET /api/srs/due` dashboard response contract pinned in tests. See [`docs/api/API_OVERVIEW.md`](api/API_OVERVIEW.md).
- **DOMPurify migration:** `dompurify` is present only **transitively** (not a direct dependency), so adopting it directly is a **new production dependency → approval-gated**. Recommended IF/when any endpoint renders user-authored HTML: add `dompurify` (or `isomorphic-dompurify`), sanitize at render, and add adversarial (mXSS) tests. No production endpoint currently renders raw user HTML, so risk is low.
- **Action taken:** none required on the production path; documented. (Legacy `server.ts` is dev-only and slated for retirement per `deployment/README.md`.)

---

## 4. Deployment traceability (fixed)
- Removed `--commit-dirty=true` from `deploy.yml`; replaced with explicit `--branch`/`--commit-hash`/`--commit-message` tied to `github.sha`. Safe because build artifacts are gitignored (tree stays clean). Deploys are now traceable to the exact reviewed commit. **No deploy performed.** (Details: `docs/staging-and-deploy-safety-plan.md`.)

---

## 5. Residual / gated items
| Item | Status |
|---|---|
| Committed `pk_live_`/anon/DSN in `wrangler.toml` | Documented in `docs/wrangler-config-remediation-plan.md` (owner rotation) |
| No `SECURITY.md` / `dependabot.yml` | Proposed (repo-config; low risk) — owner to accept |
| Prod dep upgrades (react-router/clerk/nodemailer) | Approval-gated (breaking-risk) |
| No LICENSE | `docs/license-decision-needed.md` (owner picks) |

**Net:** security core confirmed mature; deploy traceability fixed; dependency remediation blocked by an unrelated peer conflict and correctly gated with exact steps. No secrets touched; no type/validation/auth weakening.
