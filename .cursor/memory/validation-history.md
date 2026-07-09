# Validation history

## 2026-07-09 — `cursor/app-stabilization-984e`

**Scope:** Typecheck, lint, missing dev imports, legacy routes restore.

| Command | Before | After |
|---------|--------|-------|
| `npm run typecheck` | 2 errors (`renderStructuredRationale.ts`) | **PASS** |
| `npm run lint` | 3 errors (`no-empty`), 251 warnings | **PASS** (0 errors, 251 warnings) |
| `npm run build` | (not recorded) | **PASS** |
| `npm run test:critical` | (not recorded) | **PASS** — 6 files, 143 tests |
| `npm test` | (not recorded) | **PASS** — 527 files, 9849 passed, 1 skipped |
| `npm run dev:server` | `Cannot find module './routes'` | **PASS** with `.env` — routes register, server listens :3001 |
| `npm run dev:wrangler` | Missing `tokenMatchCache` import | **Compiles Worker**; runtime needs `DATABASE_URL` in env |
| Module smoke: `routes/index.ts` | `ERR_MODULE_NOT_FOUND` via trash re-export | **PASS** after full `routes/` restore |
| Module smoke: `semantic-cache.ts` | Missing `@/lib/services/tokenMatchCache` | **PASS** |

**Files changed (app code):**

- `lib/study/renderStructuredRationale.ts`
- `lib/nccpa-question-weighting.ts`
- `services/medicalComplianceService.ts`
- `lib/services/tokenMatchCache.ts` (restored)
- `lib/services/tokenMatchCache.test.ts` (added)
- `routes/*` (restored from `_trash/old-routes/`)

**Agent infrastructure touched:** Documentation only (this file, `docs/cursor-followup-issues.md`).
