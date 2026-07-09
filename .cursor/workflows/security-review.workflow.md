# Workflow: Security Review

**Goal:** Assess a change for secrets, auth/authorization, validation, and data exposure. Report + additive hardening only.

**Triggers:** changes to `functions/api/`, auth/Clerk/RLS, secrets; security review request.

**Agents:** Orchestrator → Security (lead) → Reviewer → (Implementation for approved hardening) → Documentation.

## Phases
1. **Context scan** *(required)* — read `security-review.mdc`, `.cursor/training/security-primer.md`, changed endpoints, `functions/api/_shared/auth.ts`.
2. **Plan** — enumerate surfaces + threat checks.
3. **Implementation** — none by default; additive hardening only with approval.
4. **Self-review** — secret scan; authz coverage.
5. **Verification** — commands below.
6. **Specialist review** — Reviewer cross-check.
7. **Docs / memory** — record findings/patterns.
8. **Final report** — see template.

**Implementation boundaries:** never weaken/disable auth/RLS/validation; never print/commit secrets; `context.env` in Edge (not `process.env`).

**Validation commands:** `git diff <base>...HEAD | rg -in "sk_live|pk_live|whsec_|service_role|postgres://|prisma://|api[_-]?key"` · `npm run typecheck` · `npm run lint`.

**Evidence required:** secret-scan output; per-endpoint authz map; validation coverage.

**Stop conditions:** all surfaces assessed with evidence.

**Human approval gates (required):** any auth/RLS change, secret handling, production-touching path.

**Final report template:** Findings by severity (file/line) → controls verified → residual risk → "needs human review" list.

**Automatic failure:** secrets in diff, weakened auth/RLS, disabled validation, unresolved finding omitted.

**Durable memory updates:** add confirmed risks to `known-failure-modes.md`.
