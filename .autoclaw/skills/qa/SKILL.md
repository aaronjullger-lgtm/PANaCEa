---
name: autoclaw-qa
description: Verify PANaCEa features end-to-end. Check real user paths, data persistence, error handling, and auth. Use before declaring any task complete.
mode: qa
---

# QA Mode — End-to-End Verification

## Purpose
Prove the feature works through the full user path before claiming done.

## When to Use
- After Builder + Reviewer complete
- Before marking any task as done
- When verifying sub-agent output

## Verification Checklist

### User Path
- [ ] Feature accessible through normal navigation (not URL hacking)?
- [ ] User can complete the primary action?
- [ ] Success feedback shown after completion?
- [ ] Navigation after completion is sensible?

### Data Integrity
- [ ] Data persists in database after action?
- [ ] Data retrievable on page reload?
- [ ] Data scoped to correct user (not leaking across users)?
- [ ] Related data updated consistently?

### States
- [ ] Loading state shown during async operations?
- [ ] Empty state intentional (not broken UI)?
- [ ] Error state shows user-actionable message?
- [ ] Edge cases handled (no data, max input, rapid clicks)?

### Auth & Security
- [ ] Unauthenticated users cannot access protected routes?
- [ ] Users cannot access other users' data?
- [ ] Input validated before persistence?
- [ ] Rate limiting considered where abuse possible?

### Regression
- [ ] No unrelated functionality broken?
- [ ] Existing tests pass?
- [ ] Build passes?
- [ ] No new console warnings?

## Output Format
```
## QA: {feature/task}

### User Path
✅ / ⚠️ / ❌ {step description}

### Data Integrity
✅ / ⚠️ / ❌ {check}

### States
✅ / ⚠️ / ❌ {state check}

### Issues Found
1. {issue} — {severity} — {how to reproduce}

### Verdict
✅ Ready / ⚠️ Ship with known issues / ❌ Blocked
```

## Coordination
- **Receives from:** Reviewer (approved changes), Builder (completed sprints)
- **Hands off to:** Orchestrator (task complete signal), Debugger (if issues found)
- **Final gate:** QA is the last check before a task is "done"

## Pre-Flight
```bash
npm test                    # Full suite must pass
npm run build               # Production build must succeed
npm run typecheck           # Clean typecheck
```

## Common Pitfalls
- **Skipping auth checks:** Always verify unauthenticated users can't access protected data
- **Trusting memory:** Verify data persistence by actually querying — don't assume
- **Shallow verification:** Run the full user flow, not just the changed code path
