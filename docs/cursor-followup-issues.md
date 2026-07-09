# Cursor follow-up issues

Tracking stabilization blockers and follow-up work from app-code PRs.

## Resolved in `cursor/app-stabilization-984e`

### Typecheck: `renderStructuredRationale.ts` union indexing

- **Files:** `lib/study/renderStructuredRationale.ts`
- **Error:** `TS2345` — `keyof StructuredRationaleInput` includes array/object fields passed to `cleanText(string)`.
- **Fix:** Added `getWhyIncorrectText()` with an exhaustive switch over option letters `A`–`E`.
- **Command:** `npm run typecheck` — **passes**

### Lint: three `no-empty` violations

- **Files:** `lib/nccpa-question-weighting.ts`, `services/medicalComplianceService.ts`
- **Fix:** Replaced empty example/stub blocks with intentional `void` usage and comments (no behavior change).
- **Command:** `npm run lint` — **0 errors** (251 pre-existing warnings remain)

### Missing module: `lib/services/tokenMatchCache.ts`

- **Symptom:** `npm run dev:wrangler` / `functions/api/_shared/semantic-cache.ts` failed to resolve `@/lib/services/tokenMatchCache`.
- **Root cause:** Pure helper module was removed; Edge wrapper still imported it.
- **Fix:** Restored `lib/services/tokenMatchCache.ts` from git history (`d135f6bc`) and added `lib/services/tokenMatchCache.test.ts`. Added `.gitignore` exceptions — the `*token*` secret pattern had been blocking these filenames.
- **Command:** `node --import tsx -e "import './functions/api/_shared/semantic-cache.ts'"` — **loads**

### Missing legacy Express routes (`./routes`)

- **Symptom:** `npm run dev:server` / `dev:all` failed — `server.ts` imports `./routes`, directory missing after trash move.
- **Root cause:** Route modules moved to `_trash/old-routes/`; relative imports (`../lib/prisma`) break when only re-exporting from trash.
- **Fix:** Restored full `routes/` directory from `_trash/old-routes/` (local dev only; production uses `functions/api/`).
- **Command:** `npm run dev:server` (with `.env` present) — **starts and registers routes**

---

## Open / environment blockers

### Local dev requires `.env`

- **Commands affected:** `npm run dev:server`, `npm run dev:all`, `npm run dev:wrangler`
- **Error:** `node: .env: not found` or Prisma `DATABASE_URL environment variable is not set`
- **Not an app-code bug:** Cloud/agent environments without secrets cannot fully boot DB-backed servers.
- **Follow-up:** Document required `.env` keys in onboarding; optional `.env.example` refresh PR.

### Legacy Express routes vs Cloudflare Functions drift

- **Path:** `routes/` (local) vs `functions/api/` (production)
- **Risk:** Legacy routes may lag Edge handlers in auth/features.
- **Follow-up:** Audit dormant routes (`/api/games`, `/api/pearls`, `/api/adaptive`) for deletion or explicit deprecation banner in `server.ts` startup log.

### Lint warnings (251 `no-restricted-syntax` hex color warnings)

- **Scope:** Pre-existing across pages/types/services
- **Follow-up:** Separate token-migration PR; out of scope for stabilization.

---

## Recommended next PRs

1. **`.env.example` sync** — list minimum vars for `dev:server`, `dev:wrangler`, and Vite.
2. **Legacy routes retirement plan** — delete or quarantine `_trash/old-routes/` once shim is canonical in `routes/`.
3. **Hex token lint cleanup** — migrate raw hex in pages/types to CSS variables / `lib/tokens`.
