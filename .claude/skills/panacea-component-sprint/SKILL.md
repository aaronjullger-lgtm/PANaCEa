---
name: panacea-component-sprint
description: "Run a focused PANaCEa UI/component improvement sprint: explore files, plan scoped fixes, implement repo-native changes, and verify. Use for open-ended improvement, polish, audit, or repair work on PANaCEa components, pages, dashboards, drills, toolkit, library, OSCE, or admin UI."
---

# PANaCEa Component Sprint

Use for component work that needs judgment, not just one-line edits. Keep each sprint small enough to verify.

## 1. Explore

- Identify the subsystem and read every file you will edit.
- Check adjacent shared primitives, hooks, config registries, and tests before adding new patterns.
- For route/page work, inspect `config/lazyComponents.tsx`, `config/appViews.ts`, and `config/AppRoutes.tsx`.
- For clinical content surfaces, identify safety-critical text, empty/loading/error states, and overflow risks.
- For session/drill surfaces, trace answer submission and telemetry before changing UI flow.

## 2. Plan

Group changes by file ownership and verification path.

- Safety and data correctness before polish.
- Shared helper first, consumers second.
- One sprint should usually touch 1-4 related files.
- Each step should be independently testable.
- Do not introduce a new styling or state pattern unless the existing pattern cannot support the fix.

## 3. Implement

- Read the exact target lines before editing.
- Reuse existing primitives in `components/ui`, `components/layout`, and the local feature folder.
- Keep page files orchestration-focused; move reusable pieces into feature components.
- Preserve clinical content; never truncate or hide safety details.
- Preserve keyboard/focus behavior, loading/error/empty states, and responsive constraints.
- Avoid unrelated refactors.

## 4. Verify

Use `panacea-verify` rather than the old per-file transpile script.

- Targeted Vitest for changed logic/components.
- `npm run typecheck` for prop/type/config changes.
- `npm run build` for lazy imports, route wiring, or broad frontend changes.
- Playwright/browser screenshot for real user flows or significant responsive layout work.
- Clinical safety review when rendered medical guidance changed.

## Summary

Report the changes and verification in one concise block:

```text
Sprint complete: N changes across M files.
Verification: <commands and pass/fail>.
```
