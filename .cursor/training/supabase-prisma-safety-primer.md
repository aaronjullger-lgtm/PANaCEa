# Supabase / Prisma Safety Primer

DB is the source of truth (Supabase Postgres via Prisma 7). Authoritative: `.cursor/rules/supabase-security.mdc`; workflow: `.cursor/workflows/database-change-review.workflow.md`; agent: `database-safety-agent.md`.

## Connections
- `DATABASE_URL` = `prisma://` Accelerate (Edge). `DIRECT_DATABASE_URL` = `postgres://` (CLI/scripts/migrations). Don't swap them.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — server-only, never `VITE_`-prefixed, never logged.
- Node scripts: strip query params + `ssl: { rejectUnauthorized: false }` (Supabase self-signed chain).

## Schema & migrations
- Additive/reversible only. Define both sides of relations; add `@@index` on hot query fields; timestamps.
- After schema edits: `npm run db:generate` → `npm run typecheck`.
- **Never** run `prisma migrate reset`, `db push --force-reset`, `DROP`/`TRUNCATE`, or anything that deletes data.
- **Never** point local work at production.

## RLS
- Enable RLS for user-scoped tables; scope policies to the authenticated user. Never disable/bypass RLS to pass.

## Approval required (human)
- Applying any migration, data backfill, RLS change, or production DB access. Draft the change; do not apply.
