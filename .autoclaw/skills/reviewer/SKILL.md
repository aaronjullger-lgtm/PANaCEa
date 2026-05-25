---
name: autoclaw-reviewer
description: Self-review PANaCEa code changes. Check correctness, security, maintainability, performance, UX, edge cases, and test coverage. Use after every Builder sprint.
mode: reviewer
---

# Reviewer Mode — Self-Critique

## Purpose
Critique your own work before calling it done. Catch issues the Builder missed.

## When to Use
- After every Builder sprint
- Before committing changes
- Before claiming a task is complete
- When reviewing sub-agent output

## Review Checklist

### Correctness
- [ ] Does it solve the stated problem?
- [ ] Are edge cases handled? (null, empty, error, boundary)
- [ ] Is auth/ownership checked for data mutations?
- [ ] Does data persist correctly?

### Security
- [ ] No secrets exposed in code or logs?
- [ ] No process.env in Edge functions?
- [ ] safePrismaDisconnect in finally blocks?
- [ ] Input validated before DB writes?
- [ ] User identity derived from auth, not client input?

### Maintainability
- [ ] Follows existing naming conventions?
- [ ] No duplicated logic from existing code?
- [ ] Imports clean (no unused)?
- [ ] File structure matches repo patterns?

### Performance
- [ ] No N+1 queries?
- [ ] No unnecessary re-renders in React?
- [ ] No blocking operations without loading states?

### UX
- [ ] Loading state for async operations?
- [ ] Empty state for no data?
- [ ] Error state with user-actionable message?
- [ ] Form submissions deduped?
- [ ] No console errors?

### Testing
- [ ] New behavior covered by tests?
- [ ] Edge cases tested?
- [ ] Existing tests still pass?
- [ ] No test ordering assumptions?

## Coordination
- **Receives from:** Builder (after every sprint), sub-agents (output verification)
- **Hands off to:** Builder (if fixes needed), QA (if approved), Security (if risky changes detected)
- **Sub-agent review:** Extra strict — verify build + tests, check import paths for wrong directory depth, check for missing `?.` on injected deps

## Sub-Agent Output Verification
```bash
npm run build          # Must pass
npm test               # 0 failures
rg "process\.env" functions/api/  # Edge hygiene check
rg "from '\.\.\/" --type ts | head -20  # Import depth sanity check
```

## Common Pitfalls
- **Rubber-stamping:** Review every dimension — don't skip security for "simple" changes
- **Missing Edge rules:** Always check for process.env, safePrismaDisconnect in new Edge code
- **Sub-agent trust:** Sub-agents produce wrong import paths — verify before accepting

## Output Format
```
## Review: {change description}
**Verdict:** ✅ Approved / ⚠️ Needs fixes / ❌ Blocked

### Issues Found
1. {issue} — {file:line} — {fix needed}

### Risk Assessment
- **Blast radius:** {files/features affected}
- **Data risk:** {data mutation concerns}
- **Rollback ease:** {easy/medium/hard}
```
