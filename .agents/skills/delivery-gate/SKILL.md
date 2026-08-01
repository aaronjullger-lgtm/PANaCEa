---
name: delivery-gate
description: Session-level quality gate that runs before declaring work done. Checks for stale dependencies, uncommitted work, missing tests, console.log residue, and rationalization patterns. Use at end of sessions, before commits, or when Aaron says "done" or "ship it".
---

# Delivery Gate

Adapted from ECC's delivery-gate skill. Prevents half-finished work from being declared complete.

## When to Use

- End of a coding session
- Before committing changes
- Before declaring a task "done"
- Before deploying
- When Aaron says "ship it", "done", "wrap up"

## Gate Checks

Run ALL of these before declaring done. Any failure = not done.

### 1. Uncommitted Changes Check

```bash
git status --short
```

**PASS:** Clean tree or all changes explicitly staged with intent.
**FAIL:** Untracked files or unstaged changes that were forgotten.

### 2. Test Gate

```bash
# Critical path tests
npm run test:critical 2>&1 | tail -5

# If services changed, run focused tests
npx vitest run lib/services/ --reporter=verbose 2>&1 | tail -10
```

**PASS:** All critical tests green.
**FAIL:** Any test failure in changed code paths.

### 3. Type Check (Scoped)

```bash
# Don't run full tsc (OOMs) — use scoped check
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit --pretty 2>&1 | grep -E "^src/|^lib/|^functions/" | head -10
```

**PASS:** No new type errors in changed files.
**FAIL:** Type errors introduced by this session's changes.

### 4. Console.log / Debugger Residue

```bash
git diff --cached --name-only | xargs grep -l "console\.\(log\|debug\)\|debugger" 2>/dev/null
```

**PASS:** No console.log or debugger in staged changes.
**FAIL:** Debug statements left in production code.

### 5. Security Scan

```bash
node scripts/security-scan.js
```

**PASS:** No critical issues.
**FAIL:** Secrets, process.env in Edge, or Prisma in frontend.

### 6. Build Verification

```bash
npm run build 2>&1 | tail -5
```

**PASS:** Build succeeds.
**FAIL:** Build fails (usually missing imports or type errors).

### 7. Rationalization Check

Self-assess honestly:
- [ ] Did I skip writing tests because "it's just a small change"?
- [ ] Did I mark something as done without verifying it works?
- [ ] Did I leave TODO comments instead of implementing?
- [ ] Did I disable a test to make the suite pass?
- [ ] Did I bypass auth/RLS "just for testing"?

Any "yes" = NOT DONE. Go back and fix.

## Gate Verdict

```
ALL CHECKS PASS → ✅ Ready to commit/ship
ANY CHECK FAILS → ❌ Not done. Fix the failing checks.
```

## PANaCEa-Specific Overrides

- `npm run typecheck` OOMs — use `typecheck:ci` or scoped checks
- Full test suite takes 10+ min — use `test:critical` for the gate
- Some admin components have known TS errors — don't block on pre-existing errors
- Build can be slow — acceptable to skip if only non-build files changed (docs, tests)
