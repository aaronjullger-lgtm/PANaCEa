---
name: design-system-enforcement
description: Detect and fix drift from the PANaCEa design system (raw hex, ad-hoc components, wrong tokens). Use when reviewing UI or when styling looks off-system.
---

# Design-system enforcement

Find and correct deviations from `ui-design-system.mdc` (the authoritative spec). Complements `using-ui-stack` and `visual-design-quality-gate.mdc`.

## When to use

- Reviewing UI for consistency, or fixing off-system styling.

## Instructions

1. Scan changed UI files for drift:
   - Raw hex: `rg -n "#[0-9a-fA-F]{3,6}" <files>` (allowed only under `lib/tokens/`).
   - Forbidden: `bg-black`/`text-black`/`#000000`; bright semantic colors on data/stat cards; unthemed `gray-*`/`zinc-*`.
   - Reinvented primitives instead of `GlassCard`/`Button`/`EmptyState`/`SkeletonLoader`.
   - Missing `tabular-nums` on numeric columns; wrong radius/elevation.
2. Fix by replacing with tokens/CSS vars and existing primitives.
3. If a needed shade/token is missing, add it to the token layer (`index.css` + `lib/tokens/`) — do not inline hex.
4. Never edit shared primitive base styles or add global `transition-*` to base elements.

## Stop conditions

- Stop when the changed files pass the scans and the gate.

## Verification

- `rg` hex scan clean; `npm run lint` (design-token lint) passes on changed files; `npm run typecheck`.
- Browser check in light + dark.

## Do not claim success unless

- Scans are clean and screenshots confirm both themes.

## Recovery

- Token missing → add to token layer, don't inline.
- Fix would touch a shared primitive → flag for approval.
