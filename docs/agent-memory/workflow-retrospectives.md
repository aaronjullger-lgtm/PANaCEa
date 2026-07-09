# Workflow Retrospectives

## 2026-07-09 — Root-cause stabilization mission

- **Context:** mission asked to "implement" two audits via a Cursor multi-agent orchestration OS.
- **Key discovery 1:** the audits were largely **stale** — a prior effort (TASK-001…021) had already
  fixed the headline items. The highest-value work was **reconciliation** (separating stale from live),
  not re-implementation. ~80% of mission "findings" were STALE or APPROVAL-GATED.
- **Key discovery 2:** the mission's named orchestration assets (`.cursor/agents/*.md`,
  `.cursor/workflows/*.workflow.md`, skills like `failure-triage`) **do not exist**. The real system is
  `.agents/skills/` (44) + `.claude/skills/`. Lesson: verify orchestration assets exist before relying
  on them; act as orchestrator directly and use the real skills. Do not fabricate the missing files.
- **What worked:** small, high-confidence code fixes first (typecheck, lint, dead code), each committed
  + validated independently; then a conservative single-leaf component extraction with a new test net;
  then documentation for all approval-gated blockers.
- **What to improve:** budget less time re-verifying already-closed items — read
  `docs/implementation/AUDIT_RECONCILIATION.md` first.
- **Lifetime:** permanent.
