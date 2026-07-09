# Example: GOOD Security Review

Scoped, evidence-based, escalates correctly. (Illustrative.)

---

**Scope:** PR adds `functions/api/drills/export.ts` (new endpoint returning a user's drill history).

**Checks:**
1. ✅ Secret scan: `git diff main...HEAD | rg -in "sk_live|pk_live|whsec_|service_role|postgres://|prisma://|api[_-]?key"` → no matches.
2. ✅ Auth: endpoint wrapped in `authenticatedEndpoint`; uses `context.env` (not `process.env`); `safePrismaDisconnect` in `finally`.
3. ⛔ **Authorization gap:** query filters by `request.query.userId` (client-supplied) instead of the authenticated user's id → could export another user's data (IDOR). **Must fix:** derive userId from the Clerk session server-side.
4. ✅ Input validated with Zod; errors return `{ error }` (no stack trace).
5. ✅ No PII/secret logging.

**Verification:** `npm run typecheck` pass.

**Verdict:** **Block** until finding #3 is fixed. Auth-related → recommend human review of the fix. No secrets committed.
