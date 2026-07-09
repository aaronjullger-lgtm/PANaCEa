# Known Failure Modes (durable)

Recurring/confirmed failure modes and how to avoid them. Only add **confirmed** patterns (not one-off flukes). Format: `### <short title>` + date, context, symptom, fix/avoidance, evidence, where it applies.

### Missing modules break the full-stack dev servers
- Date: 2026-07-09 · Where: `server.ts`, `functions/api/_shared/semantic-cache.ts`
- Symptom: `npm run dev:all`/`dev:server` → `ERR_MODULE_NOT_FOUND` (`./routes`); `npm run dev:wrangler` → Functions bundle fails on `@/lib/services/tokenMatchCache`.
- Cause: `routes/` and `lib/services/tokenMatchCache.ts` are absent on `main`.
- Avoidance: use `npm run dev` (frontend) for local runs; don't import these modules or invent stubs. Restoring them is a code-recovery task (human approval).

### Pre-existing typecheck errors
- Date: 2026-07-09 · Where: `lib/study/renderStructuredRationale.ts`
- Symptom: `npm run typecheck` exits non-zero with 2 errors (string vs string[] args).
- Avoidance: don't attribute to your change; don't "fix" by loosening types elsewhere. Separate app-code PR.

### Pre-existing lint errors
- Date: 2026-07-09 · Where: repo lint baseline
- Symptom: `npm run lint` → 3 `no-empty` errors (+ warnings under the 2000 gate).
- Avoidance: don't edit unrelated files to reach green; don't add new errors.

### `pg` SSL against Supabase
- Date: 2026-07-09 · Where: any Node DB script
- Symptom: "self-signed certificate in certificate chain".
- Fix: use `DIRECT_DATABASE_URL`, strip query params, `ssl: { rejectUnauthorized: false }`.

### Prisma stubbed in the browser
- Date: 2026-07-09 · Where: client bundle
- Symptom: importing `@prisma/client`/`lib/prisma` in client code breaks the build (Vite stubs it).
- Avoidance: never import Prisma/server code into `components/`, `src/`, or hooks.

### `process.env` in Edge functions
- Date: 2026-07-09 · Where: `functions/api/`
- Symptom: undefined at runtime on Cloudflare (works locally in Express).
- Fix: use `context.env.*`; always `safePrismaDisconnect(prisma)` in `finally`.
