# Cloudflare Functions Primer (Edge)

Production API = Cloudflare Pages Functions in `functions/api/`. Authoritative: `.cursor/rules/architecture-boundaries.mdc`, `security-review.mdc`; workflow: `.cursor/workflows/cloudflare-functions-review.workflow.md`.

## Edge runtime rules
- **Forbidden:** Node built-ins (`fs`, `path`, `os`, `process.cwd()`) and `process.env`.
- Read env via `context.env.*`.
- Handlers export `onRequestGet` / `onRequestPost` (Pages Functions) — not Express `req/res`.
- Use the Edge Prisma singleton from `functions/api/_shared/prisma-edge.ts`; **always** `safePrismaDisconnect(prisma)` in `finally`.
- Validate input with Zod; return structured `{ error: string }` on failure (no stack traces).
- Protected endpoints use the shared Clerk middleware (`functions/api/_shared/auth.ts`) + RBAC (`UserRole`).

## Verifying Edge changes
- `npm run typecheck` · `npm run build`. Scan: `rg -n "process\.env" functions/api` (should be none).
- Note: `dev:wrangler` is **broken on `main`** (missing `lib/services/tokenMatchCache.ts` breaks the Functions bundle). Verify via typecheck/build + code review; flag if you need a live Functions run.

## Approval required
- Auth/RLS changes, secret handling, and any production deploy.
