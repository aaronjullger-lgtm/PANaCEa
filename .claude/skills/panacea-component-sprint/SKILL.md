---
name: panacea-component-sprint
description: "Orchestrate a full Explore → Plan → Implement → Verify improvement sprint on PANaCEa components. Use this skill whenever the user asks to improve, audit, fix, enhance, or polish any part of the PANaCEa UI — clinical library, toolkit, calculators, interpreters, dashboard widgets, drill components, or reference views. Also trigger for requests like 'do another set of improvements', 'find things to fix', 'make this better', 'polish the UI', or any open-ended improvement task on the PANaCEa codebase."
---

# PANaCEa Component Sprint

This skill orchestrates the four-phase improvement workflow that produces reliable, shippable changes to the PANaCEa codebase. It exists because the codebase is large (6K+ TypeScript files, 130+ DB tables) and the developer is a solo PA student with limited time between clinical rotations — every session needs to produce real, verified improvements, not half-finished experiments.

## The Four Phases

### Phase 1: Explore

Before touching any code, understand the full surface area. Read every relevant file, not just the one the user mentioned.

**What to do:**
1. Identify the subsystem in scope (e.g., "calculators" = `components/toolkit/calculators/`)
2. Read ALL files in that subsystem — not just the ones you think are relevant
3. Note the patterns already in use (inline styles vs Tailwind, shared helpers vs inline logic, config-driven vs per-component)
4. Check adjacent subsystems for cross-cutting concerns (does the calculator share components with the interpreter? does the library reference the toolkit?)

**What to produce:**
A structured findings list with severity ratings. Count things — "3 of 9 calculators lack reset buttons" is more useful than "some calculators don't have reset." Include:
- What's working well (don't just list problems)
- What's inconsistent or missing
- What's a safety concern (always HIGH)
- Estimated effort for each fix

**How to present findings:**
```
## Exploration Findings: [Subsystem Name]

Files scanned: N
Components analyzed: N

### Issues Found

1. **[HIGH]** Description — affects N of M components
2. **[MED]** Description — affects N of M components
3. **[LOW]** Description — cosmetic only

### Already Working Well
- Pattern X is consistently applied across all N configs
- Accessibility attributes present on all form inputs
```

### Phase 2: Plan

Turn findings into an ordered implementation plan. Group related changes to minimize file-touching and maximize coherence.

**Planning principles:**
- **Shared helpers first, consumers second.** If 5 calculators need a ResetButton, create the shared component before wiring it into each calculator.
- **Safety fixes before cosmetic fixes.** If something could mislead a clinical decision, it jumps the queue.
- **Batch by file.** If 3 improvements all touch `shared/index.tsx`, group them into one implementation step to reduce merge risk.
- **Each step should be independently verifiable.** Don't create a plan where step 3 depends on step 5.

**Plan format:**
```
## Implementation Plan

### Imp 1: [Title] — [estimated file count] files
What: Description of the change
Where: Specific file paths
Why: What it fixes from the exploration findings
Depends on: Nothing / Imp N

### Imp 2: ...

### Verification (always last)
Transpile-check all modified files
```

Present the plan and wait for the user's go-ahead. When they say "Proceed" or "Go" — that's authorization to execute all steps without stopping to re-confirm between each one.

### Phase 3: Implement

Execute each improvement step. Use subagents for independent steps when possible (e.g., adding ResetButton to 5 different calculators can be parallelized).

**Implementation rules:**
1. **Read before edit.** Always read the exact lines you're about to change to catch any drift from prior steps.
2. **Shared → consumers.** Build shared components/helpers first, then wire them into each consumer.
3. **Preserve existing patterns.** If the file uses inline styles, add inline styles. If it uses a config-driven approach, extend the config.
4. **No orphaned imports.** If you add an import, use it. If you remove usage, remove the import.
5. **Mark progress.** Update the todo list after each step completes — the user is watching.

**What NOT to do:**
- Don't refactor unrelated code you happen to notice
- Don't switch styling approaches (e.g., don't introduce Tailwind into an inline-style file)
- Don't add dependencies without mentioning it
- Don't truncate or clip clinical content (see clinical-safety-review skill)

### Phase 4: Verify

Every sprint ends with verification. This catches syntax errors, broken imports, and type issues before the user sees them.

**Standard verification:**
```js
// Per-file transpile check (full tsc OOMs on 6K files)
node -e "
const ts = require('./node_modules/typescript');
const fs = require('fs');
const files = [/* all modified files */];
let pass = 0, fail = 0;
for (const rel of files) {
  const src = fs.readFileSync(rel, 'utf8');
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
  if (diags.length > 0) { fail++; /* log */ } else { pass++; /* log */ }
}
console.log(pass + ' passed, ' + fail + ' failed');
"
```

**If clinical content was modified:** also run the safety review from the clinical-safety-review skill.

## Post-Sprint Summary

After completing all phases, provide a concise summary:

```
**Sprint Complete: [N] improvements across [M] files**

- Imp 1: [one-line description] ✅
- Imp 2: [one-line description] ✅
- ...
- Verification: [N] files, 0 failures ✅
```

Don't re-explain what each improvement does — the user was there for the planning phase. Just confirm everything landed and passed verification.

## Stacking with Other Skills

This skill is the orchestration layer. It calls on the others:
- **panacea-style-system** — referenced during implementation to ensure correct tokens and patterns
- **clinical-safety-review** — run during verification if clinical content was touched
- **panacea-verify** — provides the transpile verification script
- **panacea-fsrs-wiring** — consulted if drill components or SRS integration was modified
