# Workflow: Documentation Refresh

**Goal:** Reconcile docs/memory with reality; fix drift without bloat.

**Triggers:** after stack/command changes, monthly, or when docs look stale.

**Agents:** Orchestrator → Documentation (lead) → Reviewer.

## Phases
1. **Context scan** *(required)* — `README.md`, `docs/cursor-*.md`, `AGENTS.md`, `CLAUDE.md`, `APP_FUNCTIONALITY_PLAN.md`, `.cursor/README.md`, `package.json`.
2. **Plan** — list drift (stale commands/paths/claims).
3. **Implementation** — fix factual drift; keep concise; reference not duplicate.
4. **Self-review** — spot-run documented commands to confirm they exist/work.
5. **Verification** — `npm run typecheck`/`build` on any documented command touched.
6. **Specialist review** — Reviewer.
7. **Docs / memory** — update `validation-history.md` if commands changed.
8. **Final report** — see template.

**Implementation boundaries:** docs only; no product/app code; no secrets; don't invent features/commands; don't rewrite domain docs wholesale.

**Validation commands:** spot-run (`npm run typecheck`, `npm run build`); secret scan on diff.

**Evidence required:** what was stale + what changed.

**Stop conditions:** docs match reality; no duplication introduced.

**Human approval gates:** none (docs), but flag if a doc reveals a real bug/blocker.

**Final report template:** Drift found → changes made → commands confirmed → remaining doc debt.

**Durable memory updates:** none unless a durable fact was corrected.
