# Workflow: Broken Import / Dead File Sweep

**Goal:** Find unresolved imports and dead-code candidates; fix clearly-broken imports, propose (not delete) dead files.

**Triggers:** after refactors, monthly, or "cannot find module" errors.

**Agents:** Orchestrator → Test/Debug (lead) → Implementation → Reviewer.

## Phases
1. **Context scan** *(required)* — read `anti-hallucination-imports.mdc`; note known-missing modules (`routes/`, `lib/services/tokenMatchCache.ts`).
2. **Plan** — scope directories to sweep (`src/`, `components/`, `lib/`, `functions/`).
3. **Implementation** — fix clearly-broken imports (`route-and-import-verification`); **do not delete files**.
4. **Self-review** — confirm fixes resolve; list dead-code candidates.
5. **Verification** — `npm run typecheck` · `npm run build`.
6. **Specialist review** — Reviewer.
7. **Docs / memory** — record dead-code candidates for a human decision.
8. **Final report** — see template.

**Implementation boundaries:** never delete files (propose only); never invent stub modules to force a green build.

**Validation commands:** `npm run typecheck` · `npm run build`; `rg "from ['\"]\.\.?/"` spot checks.

**Evidence required:** list of broken imports (fixed) + dead-file candidates (proposed).

**Stop conditions:** typecheck/build resolve import errors, or missing modules documented for follow-up.

**Human approval gates:** deleting any file; restoring known-missing modules.

**Final report template:** Broken imports fixed → unresolved/missing modules → dead-file candidates (proposed).

**Durable memory updates:** update `known-failure-modes.md` with missing-module notes.
