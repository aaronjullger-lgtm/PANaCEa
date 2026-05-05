---
name: panacea-style-system
description: "PANaCEa UI style and design-system guidance. Use when modifying or creating React UI, clinical reference views, toolkit surfaces, dashboard widgets, app shell, drill/session screens, typography, tokens, spacing, dark mode, visual hierarchy, or responsive layout."
---

# PANaCEa Style System

PANaCEa has mixed-era UI. Preserve local conventions where a subsystem is coherent, but prefer shared primitives and CSS variables over new one-off styling.

## Read First

- `index.css`
- `tailwind.config.js`
- `components/ui/*`
- `components/layout/*`
- The target feature folder and nearby tests
- For reference/library/toolkit views, inspect local inline-style helpers before changing patterns

## General Rules

- Use CSS custom properties and existing semantic tokens for theme-aware color.
- Use Tailwind where surrounding code uses Tailwind; use local inline helper patterns only in legacy reference/toolkit surfaces that already do.
- Avoid nested cards and decorative section cards inside operational app pages.
- Stable dimensions matter for charts, drill boards, toolbars, grids, counters, and fixed-format widgets.
- Text must not overlap, truncate clinical detail, or overflow controls on mobile.
- Clinical safety content must remain visible and visually prioritized.
- Prefer existing UI primitives for buttons, dialogs, cards, progress, badges, empty/error/loading states, and charts.

## Clinical Hierarchy

- Critical safety: red/warning treatment, left border or alert-style primitive, always visible.
- Standard clinical content: clear label/body hierarchy, readable line height.
- Study/PANCE focus: grouped, scannable, and near the top when it helps exam prep.
- Numeric data: tabular numbers or mono treatment when precision/alignment matters.

## Dashboard/Operational Surfaces

- Dense, scannable, restrained.
- Metrics need labels, units, denominators/time windows, empty states, and stale-data handling.
- Charts need stable height, accessible labeling, and null-safe rendering.

## Session/Drill Surfaces

- Preserve focus management, keyboard affordances, submit state, and feedback timing.
- Do not let animation or layout shifts interfere with answering.
- Keep answer choices stable in size and position during hover/selection/submission.

## Verification

- Component/unit tests for transformed data or conditional states.
- `npm run typecheck` for prop/config changes.
- `npm run build` for route/lazy import changes.
- Browser screenshot/Playwright for substantial responsive or interaction changes.
