# Supabase Audit

Date: 2026-05-02
Scope: Supabase configuration, Prisma/Supabase runtime contract, RLS migrations, storage buckets, Supabase clients, Clerk token/RLS assumptions, and deployment docs.

## Executive Summary

Overall grade: **D+ / serious production risk**

PANaCEa uses Supabase primarily as PostgreSQL and Storage, with Prisma as the main data access layer. The repository has useful foundations: Prisma migrations exist, the Cloudflare runtime is intentionally pointed at Prisma Accelerate, a newer two-bucket storage design exists, and the service-role client is separated from the public Supabase client.

The Supabase layer is not yet production-clean. The highest-risk problems are:

1. Some RLS policies use the wrong user identifier and will deny or mis-scope direct Supabase access.
2. RLS coverage is uneven across many user-owned tables.
3. Storage architecture is split between legacy `medical-images` flows and the newer `raw-source-vault` / `public-assets` model.
4. Runtime docs and examples still tell operators that Supabase transaction-pooler PostgreSQL URLs can be used in places where the Edge Prisma code only accepts Prisma Accelerate URLs.
5. Several Supabase clients are created at module load with empty-string fallbacks, which can cause import-time failures and hides configuration errors.

Official Supabase references used:

- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control): storage permissions are controlled through RLS policies on `storage.objects`; uploads require explicit `INSERT`, upserts also need `SELECT` and `UPDATE`.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): `UPDATE` requires a matching `SELECT` policy; views bypass RLS by default unless `security_invoker = true`; authorization data should come from app metadata rather than mutable user metadata.
- [Supabase API Keys](https://supabase.com/docs/guides/getting-started/api-keys): secret/service role access bypasses RLS and must only be used in backend-controlled components.

## Readiness Table

| Area | Grade | Severity | Evidence | Main Blocker | Recommended Fix |
|---|---:|---|---|---|---|
| Runtime DB connectivity | C | P1 | `functions/api/_shared/prisma-edge.ts:94-144`, `.env.example:24-36`, `DEPLOYMENT_CHECKLIST.md:22` | Docs/examples allow Supabase pooler URLs while Edge code rejects non-`prisma://` URLs. | Make Cloudflare runtime contract explicit: `DATABASE_URL` must be Prisma Accelerate; migrations use `DIRECT_DATABASE_URL`. Add env validation test. |
| RLS correctness | D | P1 | `prisma/migrations/20260418000000_enable_rls_student_reservoir_item/migration.sql:16`, `prisma/schema.prisma:4829` | Policies compare `auth.uid()` to internal `User.id`. | Replace direct comparisons with `userId IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)` or standardize IDs. |
| RLS coverage | D | P1 | `prisma/schema.prisma` has many `userId` models; selected searches found no RLS for `Card`, `UserTopicProgress`, `UserConditionAccuracy`, `UserPreferences`, `UserPearl`, `DailyStudyPlan`, `MediaAsset`. | User-owned tables are not uniformly protected for direct Supabase access. | Add an RLS inventory migration and CI check for exposed user-owned tables. |
| Storage model | D | P1 | `scripts/setup/supabase-storage-two-bucket.sql:16-31`, `functions/api/admin/media/[id].ts:35`, `services/domain/mediaStorageService.ts:17` | Legacy `medical-images` bucket still powers services while newer two-bucket model exists. | Choose one canonical storage model; migrate services and docs to it. |
| Raw media signed URLs | C | P2 | `functions/api/admin/refinery/media-signed-url.ts:21`, `functions/api/admin/refinery/media-signed-url.ts:46` | Any approver/admin can request any raw object path if known. | Require media asset ID, look up `rawStoragePath`, validate approval access, and sign only DB-backed paths. |
| Supabase client safety | C | P2 | `lib/supabase/client.ts:14-21`, `lib/supabase/client.ts:48`, `lib/supabase/admin.ts:19-32` | Top-level clients use empty env fallbacks and `process.env` in a module labeled UI-safe. | Lazily create clients after validated config; split browser and server modules. |
| Clerk/Supabase RLS integration | C- | P1 | `docs/security/SUPABASE_CLERK_INTEGRATION.md:71-89`, migrations mix `auth.uid()` and `auth.jwt()` patterns. | No single documented, verified identity contract between Clerk tokens, Supabase `auth.uid()`, and `User.clerkId`. | Write one identity policy helper/pattern and test with Supabase policy tester or SQL fixtures. |
| Deployment docs | D | P2 | `docs/security/SUPABASE_SETUP.md:79-82`, `docs/security/SUPABASE_SETUP.md:91-110` | Docs recommend `db push`/`migrate dev` and legacy public image bucket setup. | Replace with production migration flow and current bucket architecture. |
| Secret handling | B- | P2 | `wrangler.toml:29-30`, `wrangler.toml:52-60`, `lib/supabase/admin.ts:20` | No service key is committed, but real public project URL/anon key are committed and service-role use is broad. | Keep anon key only if owner accepts public exposure; use Supabase `sb_secret_*` where possible for server-side service access. |
| Verification | C | P2 | `npx prisma validate --schema prisma/schema.prisma` passes with one relation warning. | No automated RLS/storage policy regression tests were found. | Add SQL/RLS tests, storage policy tests, and route tests for service-role media flows. |

## Findings

### P1: Edge runtime documentation conflicts with actual Prisma client requirements

Evidence:

- `functions/api/_shared/prisma-edge.ts:94-98` says `DATABASE_URL` can be Prisma Accelerate or Supabase Transaction Pooler.
- `functions/api/_shared/prisma-edge.ts:130-144` rejects every URL that does not start with `prisma://` or `prisma+postgres://`.
- `.env.example:24-36` presents Supabase transaction-pooler PostgreSQL as the primary `DATABASE_URL`, then lists Accelerate as optional.
- `DEPLOYMENT_CHECKLIST.md:22` says `DATABASE_URL` can be Accelerate or a serverless-safe pooled Postgres URL.

Risk:

Cloudflare Pages Functions will fail at Prisma initialization if an operator follows the Supabase pooler instructions. This is a launch blocker for any environment configured from the current docs.

Fix:

- Update `.env.example`, `DEPLOYMENT_CHECKLIST.md`, and `docs/security/SUPABASE_SETUP.md` so Cloudflare runtime `DATABASE_URL` is always Prisma Accelerate.
- Keep Supabase session/direct URLs only for `DIRECT_DATABASE_URL` and migrations.
- Add a backend env validation test that rejects non-Accelerate `DATABASE_URL` when `CLOUDFLARE`/Pages runtime is active.

Verification:

- `npx prisma validate --schema prisma/schema.prisma`
- Unit test for `createEdgePrismaClient` URL validation.
- Wrangler smoke test with production-like env.

### P1: Several new RLS policies compare Supabase `auth.uid()` to internal `User.id`

Evidence:

- `prisma/schema.prisma:4829` shows `StudentReservoirItem.User` references `User.id`.
- `prisma/migrations/20260418000000_enable_rls_student_reservoir_item/migration.sql:16`, `:21`, `:26`, and `:32` compare `auth.uid()::text = "userId"`.
- `prisma/migrations/20260418120200_create_user_daily_insight/migration.sql:47-60`, `20260418120000_add_content_gap/migration.sql:65-81`, and `20260418120100_add_notification_log/migration.sql:68-81` use the same direct comparison.
- Older policies use the correct repository pattern, for example `prisma/migrations/20260104_add_rls_policies/migration.sql:48` and `prisma/migrations/20260309200000_add_rls_userprogress_savedquestion_dailystreak/migration.sql:18`, which map through `"User"."clerkId" = auth.uid()::text`.

Risk:

If Supabase receives a Clerk user ID in `auth.uid()`, direct policies against internal `User.id` will not match. Direct Supabase client reads/writes will fail or produce inconsistent behavior depending on whether a table stores Clerk IDs or internal IDs.

Fix:

- For tables whose `userId` references `User.id`, use:

```sql
"userId" in (
  select id from "User" where "clerkId" = (select auth.uid())::text
)
```

- Alternatively, standardize all Supabase-exposed tables on the same UUID/Clerk identifier, but that is a larger migration.
- Add a policy helper SQL function only if it is `security definer`, audited, and schema-qualified.

Verification:

- SQL fixture with two users and two rows per affected table.
- Test anon/authenticated SELECT/INSERT/UPDATE/DELETE for own-row and other-row cases.
- Confirm `UPDATE` has a matching `SELECT` policy, per Supabase RLS docs.

### P1: RLS coverage is not complete for user-owned tables

Evidence:

- `prisma/schema.prisma` contains many `userId`-owned models, including `Card`, `UserTopicProgress`, `UserConditionAccuracy`, `UserPreferences`, `UserPearl`, `DailyStudyPlan`, `UserQuestionSeen`, `UserDiagnosticPuzzleState`, `VisualizerGeneration`, and `MediaAsset`.
- Targeted migration search did not find `ENABLE ROW LEVEL SECURITY` or policies for several of those models.
- The repo has a direct browser Supabase hook in `hooks/useSupabase.ts:36-67`, so RLS is not merely theoretical.

Risk:

Any table in an exposed schema that is queried directly through Supabase needs RLS. Missing RLS can either block access unexpectedly once RLS is enabled later or expose rows if table permissions are granted without matching policies.

Fix:

- Generate an RLS inventory from `prisma/schema.prisma`: table name, `userId` semantics, exposed to Supabase REST, RLS enabled, SELECT/INSERT/UPDATE/DELETE policies.
- Add a migration to cover all user-owned tables that are exposed to anon/authenticated roles.
- Revoke anon/authenticated privileges on tables that should only be accessed through Prisma service endpoints.

Verification:

- Add a CI script that fails when a model with `userId` lacks an RLS decision record.
- Run Supabase Security Advisor in the project dashboard before launch.

### P1: Storage bucket architecture is inconsistent

Evidence:

- New storage setup creates `raw-source-vault` private and `public-assets` public in `scripts/setup/supabase-storage-two-bucket.sql:16-31`.
- Refinery approve copies media from `raw-source-vault` to `public-assets` in `functions/api/admin/refinery/action.ts:82-90` and `:154-157`.
- Legacy services still use `medical-images`: `services/domain/mediaStorageService.ts:17`, `services/domain/mediaApprovalService.ts:19`, `functions/api/admin/media/[id].ts:35`, `functions/api/visualizer/generate.ts:28`, `functions/api/srs/generate-visual.ts:24`, and many image scripts.
- Legacy docs still instruct creating `medical-images`: `docs/security/SUPABASE_SETUP.md:91-110`, `docs/deployment/SETUP_MEDIA_APPROVAL.md:44-80`, `docs/deployment/DEPLOYMENT_CHECKLIST_MEDIA.md:88-119`.

Risk:

Clinical media can land in different buckets with different public/private assumptions. Delete, approve, and display flows can orphan files or publish raw/unreviewed assets.

Fix:

- Canonicalize buckets:
  - `raw-source-vault`: private, service-role only, unverified source assets.
  - `public-assets`: public read, service-role write only, approved assets.
- Move legacy `medical-images` callers behind a single storage service that understands asset state.
- Add migration/backfill for `MediaAsset.rawStoragePath`, `storagePath`, and public URL fields.
- Archive or update legacy docs.

Verification:

- Route tests for ingest, signed preview, approve/copy, reject, delete.
- Storage policy test: anon cannot read raw, anon can read public, authenticated cannot upload unless explicitly intended.

### P2: Raw signed URL endpoint accepts unscoped storage paths

Evidence:

- `functions/api/admin/refinery/media-signed-url.ts:21` accepts arbitrary non-empty `path`.
- `functions/api/admin/refinery/media-signed-url.ts:46` signs that path in `raw-source-vault`.

Risk:

An approver/admin can sign any raw object path if they know or guess it. This is admin-gated, so it is not a public exposure, but it is broader than necessary for source material handling.

Fix:

- Change the endpoint to accept `mediaAssetId`.
- Look up the row, require `approvalStatus in ('pending', 'pending_review')`, and sign only its `rawStoragePath`.
- Add path format validation and max length.

Verification:

- Unit test: known media ID returns signed URL.
- Unit test: arbitrary path without DB row is rejected.

### P2: Public Supabase client module is not actually browser-safe

Evidence:

- `lib/supabase/client.ts:2-6` says it is safe for UI.
- `lib/supabase/client.ts:14-15` reads `process.env`, which is not a Vite browser API.
- `lib/supabase/client.ts:21` creates the client at module load even if URL/key are empty.
- `lib/supabase/client.ts:48` checks `.from('user')`; the Prisma model/table is `User`, not `user`.
- `lib/supabaseClient.ts:24-33` correctly uses `import.meta.env` for browser runtime.

Risk:

Any frontend import of `lib/supabase/client.ts` can fail in the browser or silently use invalid config. The health check is likely false-negative because of table naming.

Fix:

- Keep `lib/supabaseClient.ts` as the browser module.
- Make `lib/supabase/client.ts` server/Node-only or replace it with a lazy factory that uses `import.meta.env` in browser builds.
- Change health checks to a known public RPC/table or remove direct DB health checks from anon client code.

Verification:

- Vitest import test in a browser-like environment.
- Supabase config validation test for missing URL/key.

### P2: Service-role use is broad and should be narrowed

Evidence:

- `lib/supabase/admin.ts:19-32` creates a module-level service-role client.
- `functions/api/admin/media/[id].ts:193-198` manually sends `SUPABASE_SERVICE_ROLE_KEY` to Storage REST.
- Supabase docs state service/secret keys bypass RLS and must only be used in backend-controlled components.

Risk:

The code generally keeps service-role usage server-side, but broad module imports and manual REST calls make accidental exposure or logging mistakes more likely.

Fix:

- Prefer a narrow storage service with explicit methods: `copyRawToPublic`, `deletePublicAsset`, `signRawPreview`.
- Validate env before constructing clients.
- Do not log service URLs with query strings or keys. `functions/api/_shared/prisma-edge.ts:154` should stop logging the first 50 characters of DB URLs because Accelerate URLs can contain API keys.
- Consider newer Supabase `sb_secret_*` server keys where compatible.

Verification:

- Static scan for `SUPABASE_SERVICE_ROLE_KEY` outside server/functions/scripts.
- Unit test that service client cannot be imported from client bundles.

### P2: Setup docs are stale and potentially unsafe for production

Evidence:

- `docs/security/SUPABASE_SETUP.md:79-82` recommends `npx prisma db push` and `npx prisma migrate dev --name init_schema`.
- `package.json:33-37` exposes `db:push`, `db:migrate:deploy`, and `db:migrate:dev` without environment guardrails.
- `DEPLOYMENT_CHECKLIST.md:71-85` has a better production migration flow using `migrate deploy`.

Risk:

Operators can mutate production schema outside migration history or set up legacy storage policies.

Fix:

- Rewrite `docs/security/SUPABASE_SETUP.md` around `prisma migrate deploy`.
- Mark `db:push` as local-only in docs and consider renaming to `db:push:local`.
- Point media setup to `scripts/setup/supabase-storage-two-bucket.sql`.

Verification:

- Documentation grep has no production instructions for `db push`.
- Dry-run onboarding review from a clean environment.

## Verification Performed

Command:

```bash
npx prisma validate --schema prisma/schema.prisma
```

Result:

- Passed.
- Prisma reported one warning: a relation uses `onDelete: SetNull` while the referenced field is required. This is not Supabase-specific but should be cleaned up.

Not performed:

- Live Supabase Security Advisor review.
- Supabase policy tester.
- Live storage bucket policy test.
- Cloudflare Pages smoke test with production env.

## Recommended Implementation Order

1. Fix the RLS identity mismatch migrations for `StudentReservoirItem`, `UserDailyInsight`, `ContentGap`, and `NotificationLog`.
2. Generate a full RLS inventory and decide which user-owned tables are direct-Supabase exposed versus Prisma-only.
3. Canonicalize storage on `raw-source-vault` / `public-assets` and migrate `medical-images` callers.
4. Align `.env.example`, deployment docs, and setup docs with Prisma Accelerate for Cloudflare runtime.
5. Replace module-level Supabase client creation with lazy validated factories.
6. Add CI checks for RLS coverage, service-role import boundaries, and storage bucket naming.

## Open Questions

- Is browser-side Supabase access a required product path, or should all user data access go through Cloudflare Functions and Prisma?
- Should legacy `medical-images` assets be migrated into `public-assets`, or retained read-only during a transition?
- Is the Supabase project configured to validate Clerk JWTs in the exact shape expected by `auth.uid()` and `auth.jwt()` policies?
- Are anon/authenticated privileges currently granted on all Prisma tables, or only specific tables exposed through Supabase REST?
