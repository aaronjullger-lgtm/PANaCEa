# .autoclaw/error-log.md

### CI Failures (2026-05-22)
**Symptom:** Two scheduled workflows failing repeatedly
**Root cause:**
1. Reservoir Supply: `PRODUCTION_URL` and `CRON_SECRET` missing from GitHub Actions secrets
2. Runtime Sanity: Prisma Accelerate TLS error — `self-signed certificate in certificate chain` on `prisma://accelerate.prisma-data.net/`
**Fix needed:**
1. Add `PRODUCTION_URL` and `CRON_SECRET` to GitHub repo secrets
2. Verify Prisma Accelerate API key is valid; consider switching to DIRECT_DATABASE_URL with sslmode=require
**Rule:** CI secrets must be audited when CI failures occur — check secrets availability before code
**Deprecation:** Node.js 20 actions deprecated — update before June 2, 2026 (set FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true)

### Config Patch Reverts
**Symptom:** Gateway config settings (web search, timeout, FS scope) reverted after restart
**Root cause:** Multiple sequential patches with intermediate restarts caused config loss
**Fix:** Apply ALL config changes in a single atomic config.patch
**Rule:** NEVER do multiple config.patch calls in sequence — batch all changes into one

### Memory Plugin Unavailable
**Symptom:** `plugins.slots.memory` rejects all non-"none" values
**Root cause:** No compatible memory plugin installed in this runtime
**Fix:** Use session-memory hook instead (saves context to memory/ on /new or /reset)
**Rule:** Don't retry enabling memory plugin — use hook-based workaround

### Typecheck OOM
**Symptom:** `tsc --noEmit` crashes with out-of-memory
**Root cause:** Large codebase exceeds default Node heap
**Fix:** Always use `NODE_OPTIONS="--max-old-space-size=4096"`
**Rule:** Prepend to all typecheck commands
