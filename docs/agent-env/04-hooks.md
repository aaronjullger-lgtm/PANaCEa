# Hooks — The Enforcement Layer

> 7 hooks configured in `.claude/settings.json`. All tested and verified.
> This is where the missing code reviewer gets replaced.

---

## Hook Summary

| # | Hook | Event | Matcher | Blocks? | Bypass |
|---|------|-------|---------|---------|--------|
| 1 | `safety-guard.sh` | PreToolUse | Bash | ✅ Exit 2 | `PANACEA_UNSAFE=1` |
| 2 | `migration-tripwire.sh` | PreToolUse | Bash | ✅ Exit 2 | `PANACEA_UNSAFE=1` |
| 3 | `dependency-check.sh` | PreToolUse | Bash | ✅ Exit 2 | `PANACEA_UNSAFE=1` |
| 4 | `edge-runtime-guard.sh` | PreToolUse | Edit\|Write\|MultiEdit | ❌ Warn only | N/A (informational) |
| 5 | `format-on-save.sh` | PostToolUse | Edit\|Write\|MultiEdit | ❌ Best-effort | N/A |
| 6 | `session-start.sh` | SessionStart | startup\|clear\|compact | ❌ Context only | N/A |
| 7 | `session-handoff.sh` | Stop + SessionEnd | * | ❌ Writes handoff | N/A |

---

## Detailed Hook Documentation

### 1. safety-guard.sh — PreToolUse (Bash)

**Rationale:** Prevents destructive commands and secret leakage before they execute.

**What it blocks:**
- `rm -rf /`, `rm -rf ~`, `rm -rf .`
- `sudo`
- `git push --force`, `git reset --hard`, `git clean -fd`
- `npm publish`, `npx wrangler delete`
- `DROP DATABASE/TABLE/SCHEMA`, `TRUNCATE`
- `prisma migrate reset`, `prisma db push --force`
- `curl | sh` (pipe-to-shell)
- `dd if=`, `mkfs`
- Secret patterns in echo/printf/cat commands (Clerk, Supabase, Gemini, Sentry, OpenAI, GitHub PAT, JWT)
- `cat .env` (leak risk)
- `git add .env` (staging secrets)
- Write operations against production Supabase connection strings

**Bypass:** Prefix command with `PANACEA_UNSAFE=1`

**Tested:** 8/8 test cases pass (4 block, 3 allow, 1 bypass)

---

### 2. migration-tripwire.sh — PreToolUse (Bash)

**Rationale:** Prevents the #1 pain point — uncontrolled DB schema changes. Blocks `prisma db push` (bypasses migrations) and `prisma migrate reset` (drops all data).

**What it blocks:**
- `prisma db push` — warns to use `migrate dev` instead
- `prisma migrate reset` — destructive, blocks hard
- `prisma migrate reset --force` — same

**What it allows:**
- `prisma migrate dev --name X` — correct workflow, with awareness note
- All non-Prisma commands

**Bypass:** `PANACEA_UNSAFE=1`

**Tested:** 4/4 test cases pass

---

### 3. dependency-check.sh — PreToolUse (Bash)

**Rationale:** Prevents AI-hallucinated package names from entering `package.json`. Real attack vector: malicious packages registered at names AI agents invent.

**What it does:**
- Intercepts `npm install <pkg>` commands
- Queries `registry.npmjs.org/<pkg>` to verify the package exists
- Blocks with exit 2 if package returns 404
- Warns (but allows) if package has <50 weekly downloads (typosquat signal)

**What it allows:**
- `npm install` (no package args)
- `npm install react` (real packages)
- Commands that fail to reach the registry (network error → warn, don't block)

**Bypass:** `PANACEA_UNSAFE=1`

**Tested:** 3/3 test cases pass

---

### 4. edge-runtime-guard.sh — PreToolUse (Edit|Write|MultiEdit)

**Rationale:** Catches Node-only APIs in Cloudflare Pages Functions before deploy, not after. Prevents runtime failures that only appear in production.

**What it detects (warns, doesn't block):**
- `process.env` in `functions/**` → should be `context.env.*`
- `import fs from 'fs'` → no filesystem in Edge
- `import http from 'http'` → use `fetch()` instead
- `__dirname` / `__filename` → not in ESM/Edge
- `new Buffer()` → use `Buffer.from()` with `nodejs_compat`
- Long `setTimeout()` → Edge CPU time limits

**Scope:** Only files matching `functions/**/*.ts` or `functions/**/*.js`

**Why warn not block:** The `nodejs_compat` flag makes some Node APIs available. The developer needs to make the judgment call.

**Tested:** 3/3 test cases pass

---

### 5. format-on-save.sh — PostToolUse (Edit|Write|MultiEdit)

**Rationale:** Keeps code formatted without manual `npm run format` runs. Scoped to the single touched file — never runs project-wide.

**What it does:**
- Runs `prettier --write` on the edited file (~0.5s)
- Runs `eslint --fix` on TS/JS files in source directories (~1s)
- Skips `node_modules/`, `dist/`, `coverage/`, generated files

**Scope:** `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.css`, `.md` files

**Why it never blocks:** Formatting is best-effort. Exit 0 always.

**Tested:** Passes (correctly skips non-existent files)

---

### 6. session-start.sh — SessionStart

**Rationale:** Eliminates the #1 pain point — losing context between sessions. Surfaces git state, pending migrations, and handoff notes immediately.

**What it shows:**
- Current branch + sync status (ahead/behind/in sync)
- Working tree state (unstaged/staged/untracked)
- Recent 5 commits
- Pending Prisma migrations (schema.prisma modified after last migration)
- Handoff note existence

**Previous state:** This script existed but was NOT wired in `settings.local.json`. Now properly configured in `settings.json`.

**Tested:** Passes — outputs formatted session context

---

### 7. session-handoff.sh — Stop + SessionEnd

**Rationale:** Forces a clean stopping point. Writes structured handoff for next session.

**What it writes to `.claude/handoff.md`:**
- Timestamp
- Git branch + dirty state
- Changed files (unstaged + staged)
- Pending migrations
- TODO/FIXME markers in recent diffs
- Last test result
- Next steps checklist

**File is gitignored** — never committed, purely local state.

**Tested:** Passes — creates `.claude/handoff.md` correctly

---

## Hook Design Principles

1. **Fast** — All hooks target sub-1s execution. The dependency-check has a 5s timeout and degrades gracefully.
2. **Scoped** — Hooks only fire on relevant operations. The `if` field pre-filters before spawning bash.
3. **Fail loud** — Blocking hooks print clear messages explaining what was blocked and how to bypass.
4. **Escape hatch** — Every blocking hook has `PANACEA_UNSAFE=1` bypass. Hooks without escape hatches get disabled at 11pm.
5. **Never block formatting** — PostToolUse hooks are always best-effort.
