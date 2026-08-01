---
name: post-edit-verify
description: Automatically verify files after edits by running lint, typecheck, and security scan on changed files only. Use when setting up development workflow automation or when quality regressions slip through.
---

# Post-Edit Verification

Adapted from ECC's post-edit-verification hook. Runs quality checks after file edits without blocking the edit itself.

## How It Works

After each Edit/Write operation on `.ts`/`.tsx` files:
1. Run ESLint on the changed file (fast, ~1s)
2. Check for common mistakes (console.log, process.env in Edge)
3. Report findings as warnings (non-blocking)

## Manual Usage

Instead of waiting for CI, verify after edits:

```bash
# Lint a single file
npx eslint <file> --no-error-on-unmatched-pattern

# Type check a single file (scoped)
npx tsc --noEmit <file> 2>&1 | head -10

# Security scan changed files
node scripts/security-scan.js
```

## Hook Installation

### Git Pre-Commit Hook

```bash
# Install the pre-commit hook
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

This runs the security scanner + lint on staged files before each commit.

### OpenCode Hook (Future)

Add to `.opencode/opencode.json`:
```json
{
  "hooks": {
    "file.edited": [
      {
        "command": "node scripts/security-scan.js --path=$FILE_PATH"
      }
    ]
  }
}
```

## What Gets Checked

| Check | Scope | Block? |
|-------|-------|--------|
| Hardcoded secrets | All files | Yes (exit 2) |
| process.env in Edge | functions/** | Yes |
| Prisma in frontend | components/**, pages/** | Yes |
| Binary FSRS violation | fsrs, drill, review files | Yes |
| console.log residue | All .ts/.tsx | Warning |
| Missing safePrismaDisconnect | functions/** | Warning |
| ESLint errors | Changed files | Warning |

## PANaCEa Notes

- Full `tsc --noEmit` OOMs — never run in hooks
- Use `npx eslint <file>` for single-file checks (fast)
- Security scan on staged files takes <2s for typical commits
- Pre-commit hook is opt-in (copy to .git/hooks/)
