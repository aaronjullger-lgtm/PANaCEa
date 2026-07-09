---
name: database-safety-gate
description: Final pass/fail gate for Prisma/Supabase schema & migration changes. Use before considering a DB change complete (never applies migrations).
---

# Database safety gate

Enforce `database-change-rubric.md` + `supabase-security.mdc`.

## When to use
- Any change to `prisma/schema.prisma`, migrations, or DB access code.

## Gate (all must pass)
- Schema compiles: `npm run db:generate` + `npm run typecheck`.
- Migration additive/reversible; rollback noted; relations both sides; `@@index` on hot fields.
- RLS enabled/scoped for user-scoped tables; not weakened.
- No hardcoded connection strings/keys; correct URL usage.
- Migration **drafted, not applied**.

## Verification evidence
- `db:generate`/`typecheck`/`db:validate` output; additivity + RLS assessment.

## Stop conditions
- Stop at "ready to apply" — application is human-gated.

## Do not claim success unless
- Schema compiles and the migration is confirmed additive/reversible and unapplied.

## Recovery / never
- Never run `migrate reset`/`--force-reset`/`DROP`/`TRUNCATE` or point at prod. Applying a migration → `human-approval-gate`.
