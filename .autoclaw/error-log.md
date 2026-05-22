# .autoclaw/error-log.md

## Prevention Rules (from past errors)

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
