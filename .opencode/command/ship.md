---
description: Pre-deploy verification gate for Cloudflare Pages. Run before any deploy.
agent: verify
---

Pre-deploy verification gate. Run this before any deploy to Cloudflare Pages.

Follow the `release-readiness` skill principles. Check every item:

## 1. Build
```bash
npm run build 2>&1 | tail -20
```
If build fails, STOP. Fix before proceeding.

## 2. Critical Tests
```bash
npm run test:critical 2>&1 | tail -10
```
Must pass 100%. These cover FSRS + learning stack.

## 3. Migration Status
```bash
npx prisma migrate status 2>&1 | head -20
```
All migrations must be applied. Flag any pending.

## 4. Environment Variable Parity
```bash
grep -c 'CLERK_SECRET_KEY\|DATABASE_URL\|GEMINI_API_KEY\|SUPABASE_SERVICE_ROLE_KEY\|SENTRY_AUTH_TOKEN' .env
```
Should output 5+ matches.

## 5. Cloudflare Edge Compatibility
```bash
grep -rn 'process\.env' functions/ --include='*.ts' | grep -v node_modules | head -5
```
Must return zero results.

## 6. Bundle Size
```bash
npm run build:check-size 2>&1 | tail -5
```

## 7. Type Check (scoped)
```bash
npm run typecheck:ci 2>&1 | tail -10
```

## Output Format
```
SHIP READINESS REPORT
Build:          PASS/FAIL
Critical tests: PASS/FAIL (N/N)
Migrations:     all applied / N pending
Env vars:       all present / missing: <list>
Edge compat:    clean / N violations
Bundle size:    under limit / <size>
Type check:     clean / N errors

READY TO DEPLOY / BLOCKED — fix blocking items first
```
