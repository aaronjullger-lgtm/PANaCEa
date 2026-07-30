---
description: Show current project status at a glance — branch, dirty tree, recent commits, test state.
agent: orchestrator
---

Show current project status.

1. Run `git status` — show branch, clean/dirty state, untracked files
2. Run `git log --oneline -5` — show recent commits
3. Check for pending migrations: `npx prisma migrate status 2>&1 | head -10`
4. Report concisely — no paragraphs, just the facts
