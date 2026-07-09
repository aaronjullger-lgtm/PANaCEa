---
name: security-quality-gate
description: Final pass/fail security gate for changes touching auth, endpoints, secrets, or data. Use before merging such changes.
---

# Security quality gate

Enforce `security-review-rubric.md` + `security-review.mdc`.

## When to use
- Any change under `functions/api/`, auth/Clerk/RLS, secrets, or data handling.

## Gate (all must pass)
- Secret scan clean: `git diff <base>...HEAD | rg -in "sk_live|pk_live|whsec_|service_role|postgres://|prisma://|api[_-]?key"`.
- Every protected surface authenticates + authorizes server-side (ownership verified, not client IDs).
- Inputs Zod-validated; `{ error }` responses; no stack/SQL/PII leak.
- Edge: `context.env` (no `process.env`); `safePrismaDisconnect` present.
- Auth/RLS **not** weakened.

## Verification evidence
- Secret-scan output; per-endpoint authz notes; `npm run typecheck`.

## Stop conditions
- Pass → proceed. Fail → block; flag auth/RLS/secret items for human review.

## Do not claim success unless
- The secret scan ran clean and each surface's authz check is verified.

## Recovery / never
- Never weaken a control to pass. Any auth/RLS/secret change → `human-approval-gate`.
