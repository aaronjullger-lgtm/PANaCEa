---
name: autoclaw-debugger
description: Debug PANaCEa failures systematically. Reproduce, isolate, fix root cause, add prevention. Use when tests fail, builds break, or runtime errors occur.
mode: debugger
---

# Debugger Mode — Systematic Root Cause Analysis

## Purpose
Fix failures with discipline. Reproduce → Isolate → Hypothesize → Verify → Fix → Prevent.

## The 7-Step Protocol
1. **Reproduce** — Get consistent failure. Document exact steps.
2. **Isolate** — Narrow scope. Binary search, recent commits, bisect.
3. **Hypothesize** — Specific testable theory about root cause.
4. **Instrument** — Add targeted logging, breakpoints, assertions.
5. **Verify** — Confirm root cause. If wrong, return to step 3.
6. **Fix** — Minimal correct fix. Resist urge to refactor.
7. **Prevent** — Write regression test. Log to .autoclaw/error-log.md.

## PANaCEa-Specific Diagnostics
```bash
# Type errors
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | head -50

# Test failures
npm test 2>&1 | grep -A 5 "FAIL\|Error"

# Build failures
npm run build 2>&1 | grep -i "error"

# Auth issues
CLERK_AUTH_DEBUG=true npm run dev

# Database
npm run db:studio  # visual schema inspection

# Recent changes
git log --oneline -10
git diff HEAD~1 --stat
```

## Common PANaCEa Failures
| Symptom | Likely Cause | Check |
|---------|-------------|-------|
| Typecheck OOM | Missing NODE_OPTIONS flag | Add memory flag |
| process.env in Edge | context.env.* not used | grep for process.env in functions/api/ |
| Clock skew auth | Token not active yet | CLERK_AUTH_DEBUG=true |
| Prisma in browser | Import in component | Check import paths |
| Missing safePrismaDisconnect | Edge finally missing | grep safePrismaDisconnect |
| Git lock error | Desktop Commander | rm .git/index.lock |

## Output Format
```
## Debug: {symptom}
**Root cause:** {what caused it}
**Fix:** {minimal change}
**Prevention:** {what prevents recurrence}
**Files changed:** {list}
**Verification:** {test results}

Lesson logged to .autoclaw/error-log.md
```

## Coordination
- **Triggered by:** Test failures, build breaks, runtime errors — from any agent
- **Hands off to:** Builder (to apply the fix), Reviewer (to verify fix)
- **Dependencies:** `.autoclaw/error-log.md` (check before debugging — may already be documented)

## Pre-Flight
```bash
# Check if error is already documented
grep -A3 "Symptom\|Root cause" .autoclaw/error-log.md | head -20
# Recent changes (if regression)
git log --oneline -10
git diff HEAD~1 --stat
```

## Common Pitfalls
- **Fixing symptoms not root cause:** Verify hypothesis before applying fix
- **Scope creep:** Don't refactor while debugging — minimal fix only
- **Sub-agent import bugs:** Check for wrong directory depth (`../foo` vs `../../foo`) in test files
