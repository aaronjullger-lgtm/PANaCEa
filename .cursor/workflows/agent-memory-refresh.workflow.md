# Workflow: Agent Memory Refresh

**Goal:** Keep `.cursor/memory/` and durable docs accurate, deduped, and non-bloated.

**Triggers:** weekly, after complex tasks, or when memory feels stale/contradictory.

**Agents:** Orchestrator → Documentation (lead) → Reviewer.

## Phases
1. **Context scan** *(required)* — read all `.cursor/memory/*.md`, `AGENTS.md`, `APP_FUNCTIONALITY_PLAN.md`; skim recent PRs/commits.
2. **Plan** — identify stale/duplicated/unconfirmed entries.
3. **Implementation** — consolidate duplicates; correct stale facts; demote unconfirmed "truths"; add confirmed lessons (`repo-learning-loop`, `repo-memory-update`).
4. **Self-review** — entries dated, evidence-backed, concise; no secrets/PII/huge logs.
5. **Verification** — secret scan; re-read cold for resumability.
6. **Specialist review** — Reviewer.
7. **Docs / memory** — this workflow IS the memory update.
8. **Final report** — see template.

**Implementation boundaries:** memory/docs only; never record secrets, personal data, or unconfirmed one-off failures as permanent truths.

**Validation commands:** `git diff | rg -i "sk_live|pk_live|postgres://|prisma://|api[_-]?key"` → none.

**Evidence required:** what was added/removed/consolidated + why.

**Stop conditions:** memory is accurate, deduped, and small.

**Human approval gates:** none; flag conflicting durable guidance for a human decision.

**Final report template:** Entries added/updated/removed → dedupe actions → open questions.

**Durable memory updates:** the point of the workflow — keep entries short and dated.
