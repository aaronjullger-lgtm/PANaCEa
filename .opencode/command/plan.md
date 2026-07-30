---
description: Task breakdown and planning. Decomposes approved specs into small, verifiable tasks with acceptance criteria and dependency ordering.
agent: orchestrator
---

Plan implementation for:

$ARGUMENTS

## Process
1. Load the `planning-and-task-breakdown` skill
2. Read the spec document from `.opencode/specs/`
3. Decompose into tasks:
   - Each task is 2-5 minutes of work
   - Each task has exact file paths, acceptance criteria, verification steps
   - Tasks are ordered by dependency (shared models first, then consumers)
4. Present the plan for approval

## Task format
```markdown
### Task N: <description>
- Files: path/to/file.ts
- Accept: <observable behavior>
- Verify: npx vitest run path/to/test.ts
- Depends on: Task <N-1>
```

## Output
Save plan to `.opencode/plans/<name>.md`
