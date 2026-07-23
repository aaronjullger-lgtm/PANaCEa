---
description: Adversarial self-review of current git changes. Finds what breaks before commit.
agent: security-reviewer
---

Adversarial self-review of current changes in fresh context.

You are now a hostile code reviewer. Your job is to find what breaks.

Follow the `adversarial-review` skill checklist:

## 1. Security Surface
- Scan diff for secrets: `git diff --cached | grep -E '(sk_live_|sk_test_|AIza|sntrys_|ghp_|postgresql://)'`
- Check for `process.env` in functions/: `git diff --cached -- functions/ | grep 'process\.env'`
- Check for `as any` casts on user input
- Verify auth middleware on new endpoints

## 2. Edge Runtime Safety
- `git diff --cached -- functions/ | grep -E "(process\.env|from 'fs'|from 'http'|__dirname)"`

## 3. RLS Implications
- If prisma/schema.prisma changed: flag for RLS review
- If new tables: check RLS enabled + policies exist

## 4. Test Coverage
- For each changed .ts/.tsx file: check if a .test.ts exists
- Run: `npx vitest run --reporter=dot 2>&1 | tail -10`

## 5. N+1 Query Detection
- Look for loops with awaited Prisma calls inside

## 6. PANaCEa "Never Do" List
- [ ] No Hard/Easy FSRS ratings
- [ ] No process.env in Edge functions
- [ ] No Prisma client in frontend
- [ ] No missing safePrismaDisconnect
- [ ] No auth/RLS bypasses for tests

## 7. Error Handling
- Every new endpoint has try/catch, structured error response, safePrismaDisconnect

Output:
```
PASSED: N checks
WARNINGS: N items
BLOCKING: N items
```
Fix all blocking items before committing.
