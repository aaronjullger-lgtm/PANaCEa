Show current project status at a glance.

1. Run `git status` — show branch, clean/dirty state, untracked files
2. Run `git log --oneline -5` — show recent commits
3. Check for any failing tests: `npx vitest run --reporter=dot 2>&1 | tail -5`
4. Report concisely — no paragraphs, just the facts
