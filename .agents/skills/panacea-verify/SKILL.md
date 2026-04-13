---
name: "panacea-verify"
description: "Use this skill when verifying PANaCEa changes, adding tests, fixing failing tests, or deciding what validation to run before shipping. It encodes the repo's verification ladder, memory-safe typecheck fallback, and a few PANaCEa-specific Vitest habits."
---

# PANaCEa Verify

Start with the smallest meaningful verification, then widen only as the blast radius grows.

## Default Ladder

1. Run the most relevant targeted test file first
2. Run `npm run typecheck`
3. Run `npm test`
4. Run `npm run build` for cross-cutting UI/runtime changes
5. Run `npm run test:e2e` when the change affects real user flows

If typecheck runs out of memory, rerun:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
```

## When To Run Playwright

- Auth changes
- Routing or shell changes
- Session/drill flow changes
- Dashboard or other user-facing UI that depends on live integration

## Vitest Habits

- Import Vitest symbols explicitly:

```ts
import { describe, expect, it } from 'vitest';
```

- Prefer testing pure helpers over DB-wired functions when possible
- Use arrange/act/assert structure
- For rolling-window or recall-rate fixtures, interleave correct and incorrect data instead of front-loading one outcome

## Reporting Style

- Keep verification summaries short
- Report counts and pass/fail clearly
- If a broad command fails, surface the first useful failure instead of dumping the whole log
