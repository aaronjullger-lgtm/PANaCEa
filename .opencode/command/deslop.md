---
description: AI slop cleanup pipeline. Detects and removes AI-generated artifacts (hallucinated imports, dead code, self-congratulatory comments, redundant guards) from recent changes.
agent: verify
---

Clean AI slop from recent changes.

$ARGUMENTS

## Detection Pipeline
Run these probes against `git diff` / `git diff --cached`:

### Category 1: Hallucinated Imports
- Imports to packages that don't exist in `package.json`
- Unused imports added alongside new code
- `import type` used for runtime values, or vice versa

### Category 2: Self-Congratulatory Comments
- "// This is a more robust solution"
- "// Handle edge case where..."
- "// Optimized version that..."
- "// Now we can safely..."
- Any comment that explains WHY the code was written instead of WHAT it does

### Category 3: Dead Code / Stubs
- `console.log("TODO:")`, `console.log("DEBUG:")`
- Empty catch blocks: `catch {}`, `catch (e) {}`
- `as any` or `@ts-ignore` added "to make it compile"
- Placeholder return values (`return ""`, `return null`, `return {} as any`)

### Category 4: Redundant Guards
- `if (someVar) { someVar.something }` when someVar is already guaranteed non-null
- Double null checks
- Defensive copies of objects that are never mutated

### Category 5: Wrong/Misleading Comments
- Comments that describe the intent but don't match the actual behavior
- Stale comments copied from similar code
- "// FIXME" or "// TODO" without a corresponding issue/task reference

## Certainty Levels
- HIGH: Detected by static analysis — auto-fix safe
- MEDIUM: Pattern match but needs context — flag for review
- LOW: Ambiguous pattern — add to review comments only

## Report format
```
DESLOP SCAN
HIGH: N fixed (imports:N | stubs:N | guards:N)
MEDIUM: N flagged (comments:N | edge-cases:N)
LOW: N noted
Total lines cleaned: N
```
