---
description: Write session handoff note for context recovery. Captures what was done, blockers, next steps.
agent: orchestrator
---

Write a handoff note to `.opencode/handoff.md` for the next session.

## Handoff format
```markdown
# Handoff — <date>

## What was done
- <concise list of changes>

## Blockers / open questions
- <anything unresolved>

## Exact next command
1. <step 1>
2. <step 2>

## Files touched
- <list of modified files>
```

Also update `.opencode/knowledge/session-log.md` with a summary row.
