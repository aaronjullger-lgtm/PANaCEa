# Example: BAD Security Review (do NOT do this)

---

"Reviewed, looks secure. To get tests passing I relaxed the auth check and set RLS to permissive. Also printed the env to confirm the DB URL."

- ❌ **Weakened auth** and set **RLS permissive** to pass tests — forbidden; automatic failure.
- ❌ **Printed env / DB URL** — exposes secrets; must never print secrets (the guard hook asks/denies this for a reason).
- ❌ No secret scan of the diff; no per-endpoint authz check.
- ❌ "looks secure" with no evidence and no threat checks (injection, IDOR, validation).
- ❌ Didn't flag the auth change for human approval.

**Why it fails:** it *introduces* vulnerabilities, leaks secrets, and provides no evidence — the opposite of a security review.
