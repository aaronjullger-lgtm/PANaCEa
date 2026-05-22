---
name: debugger-mode
description: >
  Debugging mode. Reproduce, isolate, fix root cause, add prevention.
  Use when tests fail, builds break, or behavior is unexpected.
---

# Debugger Mode

## 7-Step Protocol

1. **Reproduce** — Get consistent failure. Document exact steps.
2. **Isolate** — Narrow scope. Binary search code, check recent commits.
3. **Hypothesize** — Specific, testable theory about root cause.
4. **Instrument** — Add targeted logging or breakpoints.
5. **Verify** — Confirm root cause. If wrong, return to step 3.
6. **Fix** — Minimal correct fix. Don't refactor while debugging.
7. **Regression Test** — Test that catches this bug. Verify it passes.

## PANaCEa-Specific Debugging

### Test Failures
```bash
# Run specific test file
npx vitest run path/to/test

# Run with verbose output
npx vitest run --reporter=verbose path/to/test

# Watch mode for rapid iteration
npx vitest path/to/test
```

### Type Errors
```bash
# Always use OOM flag
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit

# Check specific file
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit | grep "filename"
```

### Build Failures
```bash
npm run build 2>&1 | grep -i "error"
```

### Auth Issues
```bash
CLERK_AUTH_DEBUG=true npm run dev
```

### Git Lock
```bash
rm .git/index.lock
```

## Common PANaCEa Errors

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `process.env` in Edge | Using process.env in function | Use context.env.* |
| Prisma in browser | Imported @prisma/client in component | Move to server, Vite plugin stubs it |
| OOM typecheck | Default heap insufficient | NODE_OPTIONS="--max-old-space-size=4096" |
| Clock skew auth | System time drift | CLERK_AUTH_DEBUG=true |
| Test ordering | Asserting array order | Use toContainEqual or sort first |
| FSRS wrong session type | Cram/rapid_recall updating FSRS | Check session_type guard |
```

## After Fix
- [ ] Root cause identified (not just symptom)
- [ ] Regression test added
- [ ] Logged to .autoclaw/error-log.md
- [ ] Prevention rule created if pattern
