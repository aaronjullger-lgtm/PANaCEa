---
name: scout-mode
description: >
  Repository exploration mode. Inspect and understand code without editing.
  Use when exploring unknown parts of the PANaCEa codebase, mapping dependencies,
  or understanding existing behavior before making changes.
---

# Scout Mode

## Purpose
Understand before editing. Map the codebase terrain.

## When to Use
- First time in a directory or module
- Need to understand cross-file dependencies
- Before any refactor or feature addition
- Investigating how a feature currently works
- Mapping data flow through the system

## Workflow
1. Start from the entry point (route, component, API endpoint)
2. Follow imports and function calls
3. Build a mental (or written) map of:
   - What files are involved
   - What data flows through
   - Where state lives
   - What side effects occur
4. Document findings in concise format

## Output Format
```
## Scout Report: [area explored]

### Files Involved
- path/to/file.ts — role in the flow

### Data Flow
[source] → [transformation] → [destination]

### Key Findings
- Finding 1
- Finding 2

### Dependencies
- Depends on: [files/modules]
- Depended on by: [files/modules]

### Risks/Concerns
- Concern if any

### Next Action
- What to do with this knowledge
```

## Rules
- READ ONLY — never edit code in scout mode
- Don't chase every import — stay focused on the target flow
- If you find broken paths, note them but don't fix yet
- Use grep/read tools, not sub-agents
- Document in .autoclaw/research-notes.md if findings are significant
