---
name: code-mod-safety
description: Perform large/mechanical refactors or codemods safely, in small verifiable batches. Use for renames, API migrations, or sweeping edits across many files.
---

# Code-mod safety

Make sweeping changes without breaking the build or hiding regressions.

## When to use

- Renames, signature changes, import rewrites, or any edit touching many files.

## Instructions

1. Establish a baseline: run `npm run typecheck` and `npm test` first; note pre-existing failures so you don't blame them on yourself later.
2. Define the exact transform and the files in scope (search first; confirm targets exist).
3. Apply in small batches (by directory/module), not one giant edit. Commit logical batches.
4. Prefer type-driven refactors: let `tsc` find every call site rather than guessing.
5. Do not modify shared primitives, auth/RLS, or FSRS logic as a side effect — see `architecture-boundaries.mdc`.
6. Re-run typecheck after each batch; run the full suite at the end.

## Stop conditions

- Stop if a batch introduces failures you can't immediately explain; investigate before continuing.

## Verification

- `npm run typecheck` → `npm run lint` → `npm test` → `npm run build`.
- `git diff --stat` matches the intended scope (no stray files).

## Do not claim success unless

- The full suite passes (or only pre-existing failures remain, documented) and the diff matches scope.

## Recovery

- A batch breaks unrelated areas → you changed shared behavior; narrow the transform.
- Too large to verify → split into smaller PRs.
- Never delete/skip tests to absorb a refactor (see `failure-triage`).
