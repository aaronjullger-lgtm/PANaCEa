---
name: panacea-verify
description: "Verify PANaCEa code changes compile and pass safety checks. Use this skill after making any code changes to PANaCEa — component edits, new files, config updates, helper modifications, or any TypeScript/React work. Also trigger when the user says 'verify', 'check this compiles', 'does this build', 'run checks', 'make sure this works', or at the end of any implementation sprint. This skill should be the final step of every coding task."
---

# PANaCEa Verification

This skill runs verification checks on PANaCEa code changes. It exists because the full `tsc --noEmit` typecheck will OOM on the 6189-file codebase in constrained environments, so we use targeted per-file transpile checks instead. It also bundles a clinical safety grep for any files that render medical content.

## When to Run

Run verification after ANY code change, no exceptions. It takes 5-10 seconds and catches errors that would otherwise only surface at deploy time. Specifically:

- After completing an implementation step in a component sprint
- After editing any `.ts` or `.tsx` file
- After adding new shared helpers or components
- Before declaring any task "done"

## Step 1: Transpile Check

Run this Node script from the project root, substituting in all modified file paths:

```bash
cd /path/to/StudyPANaCEa && node -e "
const ts = require('./node_modules/typescript');
const fs = require('fs');
const path = require('path');

const files = [
  // List every modified file here, relative to project root
  'components/example/MyComponent.tsx',
];

let pass = 0, fail = 0;
for (const rel of files) {
  const src = fs.readFileSync(path.resolve(rel), 'utf8');
  const result = ts.transpileModule(src, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      esModuleInterop: true,
      strict: true,
    },
    fileName: rel,
  });
  const diags = result.diagnostics || [];
  if (diags.length > 0) {
    fail++;
    console.log('FAIL ' + rel);
    diags.forEach(d => console.log('  ' + ts.flattenDiagnosticMessageText(d.messageText, '\n')));
  } else {
    pass++;
    console.log('OK   ' + rel);
  }
}
console.log('\n' + pass + ' passed, ' + fail + ' failed out of ' + files.length + ' files');
if (fail > 0) process.exit(1);
"
```

**Important details:**
- Use `require('./node_modules/typescript')` — the `typescript` package is a devDependency, not globally installed
- `ts.transpileModule` catches syntax errors, JSX issues, and basic type annotation problems
- It does NOT catch cross-file type errors (e.g., wrong prop types, missing interface fields) — those require full tsc or runtime testing
- `jsx: ts.JsxEmit.ReactJSX` is required for React 19's automatic JSX transform
- Always include ALL modified files, not just the "important" ones — a typo in any file blocks the build

## Step 2: Clinical Safety Grep (conditional)

Run this step if ANY of the modified files are in:
- `components/library/` (reference configs, generic views)
- `components/toolkit/` (calculators, interpreters, quick ref)
- `components/knowledge/` (knowledge base views)
- `lib/constants/clinical-data.ts`
- Any file that renders medical information

```bash
# Find safety-relevant fields that might use the wrong rendering tier
grep -n "contraindic\|criticalValue\|emergency\|acuteManag\|decompensation\|redFlag\|whenNotTo\|blackBox\|complication" <modified-files> | grep -v "Critical\|critical" | head -20
```

What you're looking for:
- Any safety-relevant field name that's rendered with `detailSection()` instead of `detailSectionCritical()`
- Any safety field wrapped in a visibility toggle (behind `showAdvanced` or similar)
- Any safety content with `overflow: hidden`, `text-overflow: ellipsis`, or `max-height`

If the grep returns matches, manually verify each one uses the correct CRITICAL tier rendering.

## Step 3: Import Verification (conditional)

If new imports were added to any file, verify they resolve:

```bash
# Quick check: do the imported modules exist?
grep -h "^import" <modified-files> | grep "from '\.\." | sed "s/.*from '//;s/'.*//" | sort -u | while read mod; do
  # Check if the module resolves (approximate — checks common extensions)
  base=$(echo "$mod" | sed 's|@/||')
  found=0
  for ext in .ts .tsx .js .jsx /index.ts /index.tsx; do
    [ -f "${base}${ext}" ] && found=1 && break
  done
  [ $found -eq 0 ] && echo "WARN: import '$mod' may not resolve"
done
```

This is a best-effort check — path aliases (`@/`) and barrel exports can cause false positives. But it catches obvious mistakes like importing from a file you forgot to create.

## Step 4: Report

Present results concisely:

```
**Verification: N files, 0 failures** ✅
```

Or if there are failures:

```
**Verification: N files, M failures** ❌

- `path/to/file.tsx`: [error description]
- `path/to/other.tsx`: [error description]

Fixing...
```

Then fix the issues and re-run. Don't declare the task complete until verification passes.

## What This Does NOT Check

Be honest about the limits:
- **Cross-file type safety** — wrong prop types, missing required props, incorrect interface implementations. These need full `tsc` or runtime testing.
- **Runtime behavior** — the code compiles but might crash at runtime (null access, async race conditions, etc.)
- **Visual correctness** — the code works but might look wrong. Screenshot verification would catch this but requires browser access.
- **Data correctness** — API endpoints might return unexpected shapes. Integration tests would catch this.

For a more thorough check, the user can run `npm run typecheck` locally (with `NODE_OPTIONS="--max-old-space-size=4096"`) or `npm test` for unit tests.
