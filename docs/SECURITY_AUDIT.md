# Security Audit (Sprint 5)

## Admin protection

- **RBAC:** Admin role resolved via `User.role` (DB) or `ADMIN_USER_IDS` / `SUPERADMIN_USER_IDS` (env).
- **Middleware:** `withAdminRole()` and `adminAuthenticatedEndpoint` return **403** for non-admin users.
- **Audit:** All `/api/admin/*` routes (except `/api/admin/check-access`) use `adminAuthenticatedEndpoint` or `withAdminRole`.  
  `check-access` remains authenticated-only so any user can check whether they have admin access.

## Auth audit

- Protected API routes use `authenticatedEndpoint` or `adminAuthenticatedEndpoint`; auth is enforced via `withAuth()` and Clerk JWT verification in `functions/api/_shared/auth.ts`.
- No secret keys are passed from client; `CLERK_SECRET_KEY` is server-only.

## Zod validation

- POST/PUT handlers use Zod schemas via `withValidation(schema, { source: 'body' })` or equivalent.  
  New endpoints should continue to validate body/query with Zod before use.

## Secrets

- **Do not use `VITE_` prefix for server secrets.**  
  `VITE_*` is embedded in the client bundle at build time. Only use it for non-sensitive, client-safe values (e.g. `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`).
- **Server-only:** `CLERK_SECRET_KEY`, `GEMINI_API_KEY`, `DATABASE_URL`, etc. must be set in Cloudflare env (or wrangler secrets), never as `VITE_*`.
- **Client-side:** Avoid browser-exposed Gemini keys and `VITE_TODOIST_CLIENT_SECRET` in production; prefer server-proxy or backend-only usage.

## RLS (Supabase / Postgres)

- **Planned:** Enable Row Level Security (RLS) on user-facing tables in Supabase so that rows are filtered by `auth.uid()` or equivalent.  
- **Tables to consider:** `User`, `ReviewLog`, `UserProgress`, `OsceResult`, and other per-user data.  
- **Implementation:** Add RLS policies via Supabase dashboard or SQL migrations; ensure Prisma/Accelerate connection uses a role that respects RLS.
