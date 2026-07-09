# Workflow: PR Review

**Goal:** Multi-lens review of a diff (scope, correctness, tests, security, arch, UI) with evidence and a clear verdict.

**Triggers:** PR opened/updated, review request.

**Agents:** Orchestrator → Reviewer (lead) → Security (if auth/data) → UI/UX QA (if UI) → Test/Debug (if failing checks).

## Phases
1. **Context scan** *(required)* — `git diff <base>...HEAD`, `--stat`, changed tests; read `pr-review-quality-gate.mdc` + `.cursor/evals/implementation-quality-rubric.md`.
2. **Plan** — which lenses apply.
3. **Implementation** — none (review-only unless asked to fix).
4. **Self-review** — dedupe findings; confirm each is reproducible.
5. **Verification** — run the ladder for the change type; secret scan.
6. **Specialist review** — Security/UI lenses as needed.
7. **Docs / memory** — note recurring review issues.
8. **Final report** — see template.

**Implementation boundaries:** don't edit code during review-only tasks; never suggest weakening a control to pass.

**Validation commands:** verification ladder per change type; secret scan `git diff <base>...HEAD | rg -in "sk_live|pk_live|whsec_|service_role|postgres://|prisma://|api[_-]?key"`.

**Evidence required:** command results; findings mapped to file/line.

**Stop conditions:** every applicable gate assessed with a verdict.

**Human approval gates:** merge decision is human; flag auth/RLS/secret/DB items.

**Final report template:** Verdict → checklist pass/fail → findings by severity → security/UI notes → required changes.

**Durable memory updates:** recurring review findings → `known-failure-modes.md` / candidate rule in `agent-lessons-learned.md`.
