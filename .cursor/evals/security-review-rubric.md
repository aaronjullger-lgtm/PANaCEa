# Rubric: Security Review

Grades a security review (used by Security agent + `security-quality-gate`).

## Pass criteria (all required)
- Secret scan run on the diff with result shown.
- Every protected surface has an explicit server-side authz check (ownership verified, not client-supplied IDs).
- Inputs validated with Zod; errors return `{ error }` (no stack/SQL leak).
- Edge: `context.env` (no `process.env`), `safePrismaDisconnect` present.
- No secrets/PII logged; MCP/tool output treated as untrusted.
- Findings ranked by severity with file/line; auth/RLS items flagged for human review.

## Scoring (0–5)
- 5: thorough, evidence-backed, correct escalation. 3: covers basics, some gaps. 1: superficial. 0: any automatic failure.

## Evidence required
- Secret-scan output; per-endpoint authz map; validation coverage.

## Automatic failure conditions
- Recommending or making auth/RLS/validation weaker to pass.
- Secrets printed or committed.
- "Looks secure" with no evidence/threat checks.
- Unresolved finding omitted from the report.

## Examples of unacceptable claims
- "Secure enough" (no scan, no authz check).
- "Relaxed RLS so tests pass."

## Must be reported
- Findings (severity, file/line), controls verified, residual risk, human-review list.
