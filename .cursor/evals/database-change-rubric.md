# Rubric: Database Change

Grades a Prisma/Supabase change (used by Database Safety agent + `database-safety-gate`).

## Pass criteria (all required)
- Schema compiles: `npm run db:generate` + `npm run typecheck` pass.
- Migration is **additive/reversible** (no data loss); rollback noted.
- Relations defined both sides; `@@index` on hot query fields; timestamps present.
- RLS enabled/scoped for user-scoped tables; not weakened.
- Connection strings/keys from env only (no hardcoding); correct URL (`DIRECT_DATABASE_URL` for CLI).
- Migration **drafted, not applied**; application deferred to human approval.

## Scoring (0–5)
- 5: additive, safe, RLS-correct, approval-gated. 3: minor index/relation gaps. 1: risky patterns. 0: any automatic failure.

## Evidence required
- `db:generate`/`typecheck`/`db:validate` output; additivity assessment; RLS notes.

## Automatic failure conditions
- Any destructive op (`migrate reset`, `db push --force-reset`, `DROP`/`TRUNCATE`) or applying a migration without human approval.
- Pointing at production; weakening/disabling RLS.
- Hardcoded connection string/secret.

## Examples of unacceptable claims
- "Ran the migration on the DB to confirm it works."
- "Disabled RLS temporarily."

## Must be reported
- Schema delta, integrity/RLS assessment, additivity/rollback, explicit "requires human approval to apply".
