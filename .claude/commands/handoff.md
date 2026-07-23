Force a clean stopping point. Write a structured handoff for the next session.

This is the manual trigger for the `session-handoff.sh` hook.

## Steps

1. **Commit or stash current work** — don't leave half-written code uncommitted
   ```bash
   git status --short
   ```
   If there are changes worth keeping, commit them. If experimental, stash: `git stash push -m "WIP: <description>"`

2. **Write handoff note** (the Stop/SessionEnd hook does this automatically, but do it explicitly now):
   ```bash
   # Capture current state
   BRANCH=$(git branch --show-current)
   LAST_COMMIT=$(git log --oneline -1)
   DIRTY=$(git status --porcelain | head -10)
   ```

3. **Write to `.claude/handoff.md`**:
   ```markdown
   # Handoff — $(date -u +"%Y-%m-%dT%H:%M:%SZ")

   ## What I was doing
   <one paragraph — the task in progress>

   ## What's done
   - <completed items>

   ## What's half-done
   - <partially complete items>

   ## What breaks next
   - <known issues that will surface>

   ## Exact next command
   <the single command to resume work>
   ```

4. **Report to Aaron**:
   ```
   📍 Stopped on: <branch>
   📝 Committed: <hash> — <message>
   📋 Handoff: .claude/handoff.md
   ▶️ Next: <one-line description of what to do next session>
   ```
