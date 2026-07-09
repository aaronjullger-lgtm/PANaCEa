# Clerk Auth Primer

Auth is Clerk (`@clerk/clerk-react` frontend, `@clerk/backend` server). Authoritative: `.cursor/rules/security-review.mdc`, `architecture-boundaries.mdc`.

## Model
- Protected Edge endpoints authenticate with the shared middleware (`functions/api/_shared/auth.ts`) and authorize via RBAC (`UserRole`).
- Verify **server-side** that the caller owns the resource; never trust client-supplied user IDs.
- Client publishable key is `VITE_CLERK_PUBLISHABLE_KEY` (public). Secret key `CLERK_SECRET_KEY` is server-only — never exposed/committed.

## Local dev
- Dev auto-login URL is documented in `.cursorrules` (`?dev_auth=...`) and still calls real Clerk. **Never** use production credentials; never hardcode test creds in code.
- E2E uses `@clerk/testing` sign-in tokens (bypasses MFA) via `e2e/auth.setup.ts`.

## Non-negotiables / approval
- Never weaken/bypass auth middleware to make code or tests pass.
- Any change to auth middleware, session handling, or RBAC → human approval (route via `security-agent`).
