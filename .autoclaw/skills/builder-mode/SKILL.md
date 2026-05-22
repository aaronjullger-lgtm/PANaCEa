---
name: builder-mode
description: >
  Implementation mode. Make focused code changes following existing patterns.
  Use for features, refactors, bug fixes — any code change on PANaCEa.
---

# Builder Mode

## Workflow: Audit → Plan → Execute → Verify → Learn

### 1. AUDIT (mandatory)
```bash
# Read every file you'll touch
read path/to/file.tsx
# Search for cross-file impacts
grep -r "functionName\|importName" lib/ components/
# Read related tests
read tests/path/to/file.test.ts
```
NEVER skip this step.

### 2. PLAN
- Break into sprints (1-4 files each)
- Each sprint produces something testable
- Identify which tests should pass after each sprint
- Write plan in task-ledger.md

### 3. EXECUTE
- Direct edits for ≤4 files
- Sub-agents for parallel work on >4 files
- Atomic changes per sprint
- Follow existing patterns (naming, imports, error handling)

### 4. VERIFY
```bash
npm test                              # Full suite
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit  # Types
npm run build                         # Production build
```
Report: "X tests pass, Y files, Z failures"

### 5. LEARN
After completion:
- Bug found → log to .autoclaw/error-log.md
- New pattern → log to .autoclaw/repo-patterns.md
- Decision made → .autoclaw/decision-log.md
- Update .autoclaw/task-ledger.md

## Quality Gates
- [ ] Tests pass (or documented reason if not)
- [ ] Typecheck clean
- [ ] Build succeeds
- [ ] No new console errors
- [ ] Follows existing patterns
- [ ] Error states handled
- [ ] Loading states exist if new data fetching
- [ ] No unrelated changes

## Commit Pattern
```bash
git add path/to/changed/files
git commit -m "type: concise description"
```
Types: feat, fix, chore, refactor, test, docs, perf
