# Workflow Retrospectives (durable)

Short retrospectives after complex/multi-agent tasks so the system improves. Add one after any task that hit friction, looped, or produced a reusable insight. Keep to a few lines. No secrets/PII/logs.

Format:
```
### YYYY-MM-DD — <task> (<workflow used>)
- What went well:
- What went wrong / friction:
- Root cause:
- Lesson → where recorded (known-failure-modes / do-not-repeat / a new rule?):
- Follow-up:
```

### 2026-07-09 — Build the agent orchestration system (documentation-refresh + memory-refresh)
- What went well: batched file creation; validated frontmatter/JSON structurally; reused existing skills instead of duplicating.
- What went wrong / friction: the secret scanner blocked commits on common words matching secret values; new `.cursor/` subdirs were initially ignored by `.gitignore`.
- Root cause: broad `.cursor/` ignore + value-based secret scanning.
- Lesson → recorded in `agent-lessons-learned.md` and `.gitignore` negations updated.
- Follow-up: none; both mitigations are documented.
