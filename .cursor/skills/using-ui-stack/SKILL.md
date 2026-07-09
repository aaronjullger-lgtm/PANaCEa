---
name: using-ui-stack
description: Build UI using the project's actual stack and components (Tailwind tokens, Radix, Framer Motion, existing primitives) instead of introducing new patterns or libraries. Use when creating or modifying UI.
---

# Using the UI stack

Reuse the established stack and component vocabulary; don't reinvent or add libraries.

## When to use

- Creating or modifying any component/page.

## Instructions

1. Use what exists (see `.cursor/rules/ui-design-system.mdc`):
   - **Primitives:** `GlassCard`, `Button` (variants/sizes), `EmptyState`, `SkeletonLoader`, `BackLink`, `DrillShell`, `MiniDrillLayout`. Reuse these — do not create parallel versions.
   - **Styling:** TailwindCSS with Stormy Slate CSS variables/tokens (no raw hex). Utility classes like `.btn-primary`, `.focus-ring`, `.data-nums`.
   - **Icons:** Lucide. **Motion:** Framer Motion / `motion` (gated by `useReducedMotion()`). **Charts:** Recharts/Nivo. **Interactive tables:** TanStack Table.
2. Do **not** add new UI/animation/3D libraries (React Three Fiber, drei, GSAP, alternate component kits) without explicit approval — the repo forbids unnecessary deps.
3. Do **not** modify shared primitives' base styles (`GlassCard`, `button.tsx`, `index.css` globals) — changes cascade site-wide and need approval.
4. Compose small, typed components; keep mock data in dedicated files; add loading/empty/error states.

## Verification

- `git diff package.json` shows no new dependencies (unless approved).
- No raw hex in changed files (`rg -n "#[0-9a-fA-F]{3,6}"`), tokens used instead.
- `npm run typecheck` + `npm run lint` pass; UI verified in-browser with screenshots.

## Failure recovery

- Tempted to add a library for a small need → implement with the existing stack or flag the dependency for approval.
- Need a primitive tweak → propose it as an approved, isolated change rather than editing the shared base.
