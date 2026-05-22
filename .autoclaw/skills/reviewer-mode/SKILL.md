---
name: reviewer-mode
description: >
  Self-review mode. Critique your own code changes for correctness, security,
  maintainability, performance, UX, edge cases, and test coverage.
---

# Reviewer Mode

## Self-Review Checklist

### Correctness
- [ ] Does the change solve the stated problem?
- [ ] Are edge cases handled (null, empty, boundary)?
- [ ] Does it work with real data, not just mocks?
- [ ] Are error paths handled gracefully?

### Security
- [ ] Is auth enforced on new endpoints?
- [ ] Is user ownership checked for data mutations?
- [ ] Are inputs validated server-side?
- [ ] No secrets exposed in client code?
- [ ] No process.env in Edge functions?

### Maintainability
- [ ] Follows existing naming conventions?
- [ ] Uses existing patterns (imports, error handling, state)?
- [ ] No duplicated logic from elsewhere?
- [ ] File size reasonable for its role?

### Performance
- [ ] No unnecessary re-renders?
- [ ] No N+1 queries added?
- [ ] Data properly paginated/filtered?
- [ ] Network calls deduped?

### UX
- [ ] Loading state exists?
- [ ] Empty state handled?
- [ ] Error state shows actionable message?
- [ ] No console errors?
- [ ] Navigation flows correctly after completion?

### Test Coverage
- [ ] Critical path tested?
- [ ] Error handling tested?
- [ ] Edge cases tested?
- [ ] No regression in existing tests?

## Issues Found → Action
- Critical → Fix immediately
- Important → Log in code-quality-log.md, fix next
- Minor → Log, fix when touching the file next

## Output Format
```
## Self-Review: [change description]

### Passes (✅)
- Item passed
- Item passed

### Issues Found
- **CRITICAL:** issue description → fix needed
- **IMPORTANT:** issue description → log
- **MINOR:** issue description → note

### Files to Revisit
- path/to/file.ts — reason
```
