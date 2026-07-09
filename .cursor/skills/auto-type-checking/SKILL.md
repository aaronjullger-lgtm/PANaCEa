---
name: auto-type-checking
description: Run TypeScript type checking correctly for this repo (memory flags, correct tsconfig scope) and fix type errors. Use after editing .ts/.tsx or before claiming a change compiles.
---

# Auto type-checking

Type-check reliably and resolve errors without loosening types.

## When to use

- After editing TypeScript, or before claiming a change type-checks.

## Instructions

1. Run the repo's scripts (do not hand-roll `tsc` flags):
   ```bash
   npm run typecheck        # tsc --noEmit -p tsconfig.production.json
   npm run typecheck:ci     # CI scope (tsconfig.ci.json)
   ```
   Full-project check may need memory headroom: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` (the npm scripts already set what they need).
2. Read the first errors first — later errors are often cascades. Fix root causes.
3. Respect strict flags: handle `undefined` from `noUncheckedIndexedAccess`, avoid `any` (use `unknown` + narrowing), add exhaustive `never` checks in enum/union switches.
4. Re-run until clean for the files you changed.

## Verification

- `npm run typecheck` passes (or only pre-existing, unrelated errors remain — document those).
- No new `any`/`@ts-ignore`/`@ts-expect-error` added to silence real errors.

## Failure recovery

- OOM/crash → use the memory flag above.
- After `schema.prisma` edits, types drift → run `npm run db:generate` then re-check.
- Error is in a file you didn't touch and pre-exists → leave it, report it, don't mask it.
