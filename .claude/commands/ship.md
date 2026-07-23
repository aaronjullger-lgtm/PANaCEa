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

## 3. Full Test Suite (time permitting)
```bash
npx vitest run --reporter=dot 2>&1 | tail -10
```

## 4. Migration Status
```bash
npx prisma migrate status 2>&1 | head -20
```
All migrations must be applied. Flag any pending.

## 5. Environment Variable Parity
Check that all required env vars are set in `.env`:
```bash
grep -c 'CLERK_SECRET_KEY\|DATABASE_URL\|GEMINI_API_KEY\|SUPABASE_SERVICE_ROLE_KEY\|SENTRY_AUTH_TOKEN' .env
```
Should output 5+ matches.

## 6. Cloudflare Compatibility
```bash
# Quick scan for Node-only APIs in production code
grep -rn 'process\.env' functions/ --include='*.ts' | grep -v node_modules | head -5
```
Must return zero results.

## 7. Bundle Size
```bash
npm run build:check-size 2>&1 | tail -5
```

## 8. Type Check (scoped, not full project)
```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit -p tsconfig.production.json 2>&1 | head -10
```

## Output Format
```
🚢 SHIP READINESS REPORT
━━━━━━━━━━━━━━━━━━━━━━━━
Build:          ✅/❌
Critical tests: ✅/❌ (N/N)
Full tests:     ✅/❌ (N/N)
Migrations:     ✅ all applied / ⚠️ N pending
Env vars:       ✅ all present / ❌ missing: <list>
Edge compat:    ✅ clean / ❌ N violations
Bundle size:    ✅ under limit / ⚠️ <size>
Type check:     ✅ clean / ❌ N errors

READY TO DEPLOY / BLOCKED — fix blocking items first
```
