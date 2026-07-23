Reconstruct working context from repo state + last session handoff.

Follow the `session-resume` skill:

1. Read `.claude/handoff.md` if it exists — extract branch, changed files, pending work, next steps
2. Run `git branch --show-current`, `git status --short`, `git log --oneline -5`
3. Check pending migrations: `npx prisma migrate status 2>&1 | head -20`
4. Check for half-done work: `git diff | grep -E 'TODO|FIXME|WIP' | head -5`
5. Quick test pulse: `npx vitest run --reporter=dot 2>&1 | tail -5`

Produce a 30-second orientation:
```
📍 Branch: <branch> (<sync status>)
📝 Last work: <last commit>
🔄 Uncommitted: <N files>
⚠️ Pending: <migrations / failing tests / blockers>
▶️ Next: <the single most important next action>
```

Do NOT re-read files that haven't changed. Do NOT recap completed work.
