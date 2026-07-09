---
name: auditing-security
description: Run a focused security audit of a change or subsystem — secrets, auth/RLS, input validation, and data exposure. Use for PR security review or auth/endpoint/secret work.
---

# Auditing security

Systematic, read-first security review. Pair with `.cursor/rules/security-review.mdc`.

## When to use

- Security review of a diff or endpoint.
- Any change touching auth, RLS, secrets, or user/clinical data.

## Instructions

1. **Secrets:** scan the diff for leaked secrets/keys/connection strings.
   ```bash
   git diff | rg -in "sk_live|sk_test|pk_live|whsec_|service_role|postgres://|prisma://|api[_-]?key|authorization: bearer"
   ```
   Any real secret must be removed and read from env instead. Do not bypass the commit secret scanner.
2. **Auth/authorization:** confirm protected Edge endpoints use the shared Clerk middleware and check `UserRole`; verify server-side resource ownership (never trust client-supplied user IDs). Confirm no auth/RLS/middleware was weakened.
3. **Input validation:** every external input validated/coerced with Zod at the boundary; errors return `{ error: string }` (no stack traces/SQL leaked).
4. **Data exposure:** no secrets/PII in logs; `select` only needed fields; sanitized HTML for `rehype-raw`; no SSRF on user-supplied URLs.
5. **Edge correctness:** `context.env` (not `process.env`), `safePrismaDisconnect` in `finally`.
6. **AI safety:** no diagnosis claims in AI output; keys stay server-side.

## Verification

- Secret scan returns nothing sensitive.
- Each protected surface has an explicit authz check; RLS unchanged or strengthened.
- `npm run typecheck` + `npm run lint` pass. Note residual risks that need human review.

## Failure recovery

- Found a committed secret → remove it, rotate it out of band (flag to the user), reference env instead.
- Can't prove a control is safe → do not claim it is; recommend human review for auth/RLS/secret changes.

## Never

- Never weaken auth/RLS or disable validation to make something pass. Never connect to production services during an audit.
