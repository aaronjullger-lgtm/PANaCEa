# Workflow: Database Change Review

**Goal:** Safely review Prisma/Supabase schema & migration changes. **Applying migrations / touching real data requires human approval.**

**Triggers:** edits to `prisma/schema.prisma`, new migrations, DB access changes.

**Agents:** Orchestrator → Database Safety (lead) → Security → Reviewer → Documentation.

## Phases
1. **Context scan** *(required)* — read `supabase-security.mdc`, `.cursor/training/supabase-prisma-safety-primer.md`, schema, migrations.
2. **Plan** — describe schema delta + RLS + rollback.
3. **Implementation** — edit `schema.prisma` / draft migration SQL (additive, reversible) — **do not apply**.
4. **Self-review** — relations both sides, `@@index` on hot fields, RLS for user-scoped tables.
5. **Verification** — `npm run db:generate` → `npm run typecheck` → `npm run db:validate`.
6. **Specialist review** — Security (RLS/exposure); Reviewer.
7. **Docs / memory** — note the change + approval status.
8. **Final report** — see template.

**Implementation boundaries:** **never** run `prisma migrate reset`/`db push --force-reset`/`DROP`/`TRUNCATE`; never point at prod; migrations additive/reversible only.

**Validation commands:** `npm run db:generate` · `npm run typecheck` · `npm run db:validate`.

**Evidence required:** schema compiles; migration additivity check; RLS coverage.

**Stop conditions:** stop at "ready to apply" — do not apply.

**Human approval gates (required):** applying any migration, data backfill, RLS change, prod DB access.

**Final report template:** Schema delta → integrity/RLS assessment → additivity/rollback → "requires human approval to apply".

**Durable memory updates:** record schema decisions + pending-approval items.
