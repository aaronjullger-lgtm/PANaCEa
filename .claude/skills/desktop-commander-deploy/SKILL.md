---
name: desktop-commander-deploy
description: >
  Workarounds and best practices for using Desktop Commander MCP to write code
  directly to the PANaCEa repo. Use this skill whenever you need to write files,
  read files, edit code, or run commands via Desktop Commander tools on Aaron's
  local machine. Also use when you encounter empty read_file results, git lock
  errors, write_file timeouts, or tsc OOM crashes. This skill prevents the most
  common Desktop Commander pitfalls that derail implementation sessions.
---

# Desktop Commander Repo Deployer

## Why this exists

Desktop Commander has several known quirks that cause silent failures or wasted
tool calls. This skill documents every workaround discovered through real
implementation sessions, so you don't lose time rediscovering them.

## Known issue: read_file returns empty content

`mcp__Desktop_Commander__read_file` frequently returns only metadata (fileName,
filePath, fileType) with no actual file content. This is the single most common
failure mode.

**Workaround**: Use `start_process` with `cat` or `head`/`tail`/`sed -n`:
```
mcp__Desktop_Commander__start_process({ command: "cat /path/to/file.ts", timeout_ms: 5000 })
mcp__Desktop_Commander__start_process({ command: "sed -n '100,200p' /path/to/file.ts", timeout_ms: 5000 })
mcp__Desktop_Commander__start_process({ command: "head -50 /path/to/file.ts", timeout_ms: 5000 })
```

Always try `read_file` first (it's faster when it works), but switch to
`start_process` + `cat` the moment you get empty content back.

## Known issue: write_file timeouts on large chunks

`write_file` with `mode: 'append'` can timeout after 60s on larger chunks,
especially on mounted/network volumes. This corrupts the file mid-write.

**Workaround**: Keep chunks to 25–30 lines maximum. For a 200-line file:
1. `write_file(path, first30lines, { mode: 'rewrite' })`
2. `write_file(path, next30lines, { mode: 'append' })`
3. Repeat until done

After a timeout, always check the file state with `tail -10` before continuing
to ensure the partial write didn't corrupt closing braces or syntax.

## Known issue: git index.lock / HEAD.lock

Stale lock files from prior processes cause git operations to fail with
"Unable to create '.git/index.lock': File exists".

**Workaround**: Remove lock files before git operations:
```
rm -f .git/index.lock .git/HEAD.lock
```

## Known issue: tsc --noEmit OOM crash

The 6,000+ file codebase exceeds Node's default heap for full type checking.
`tsc --noEmit` will crash with OOM.

**Workaround**: Don't run full tsc. Instead:
- Run targeted tests: `npx vitest run tests/specificFile.test.ts`
- Type-check specific files: `npx tsc --noEmit path/to/file.ts` (single file)
- Use `grep` to verify imports resolve correctly

## Best practices for writing to the repo

### Appending to existing files
When adding features to existing services (like adding drift detection to
retrievabilityCalibrationService), prefer appending rather than rewriting:
1. Read the end of the file with `tail` to know the current state
2. Append new code with `write_file mode: 'append'`
3. Verify the result with `tail -20` after writing

This avoids accidentally destroying the existing implementation.

### Editing existing code
Use `edit_block` for surgical replacements in existing files. Provide enough
context in `old_string` to uniquely identify the location.

### Git workflow
- Check `git status --short` before and after changes
- Stage specific files by name, never `git add -A` (avoids committing secrets)
- Use descriptive commit messages with sprint numbers
- Commit format: `feat: Sprint N — description of changes`

## Parallelizing reads

When you need to read multiple files, launch multiple `start_process` calls
in the same turn — they run concurrently:

```
// Good: parallel reads
start_process({ command: "cat file1.ts", timeout_ms: 5000 })
start_process({ command: "cat file2.ts", timeout_ms: 5000 })
start_process({ command: "grep -n 'pattern' file3.ts", timeout_ms: 5000 })
```
