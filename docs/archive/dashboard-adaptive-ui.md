# Adaptive Dashboard UI

PANaCEa’s main study dashboard now uses a fixed shell with adaptive content inside it:

```text
raw learner signals
→ normalized dashboard signals
→ user state classifier
→ adaptive widget registry
→ eligibility filters
→ priority scoring
→ redundancy suppression
→ slot resolver
→ visual renderer
```

## Core Files

- `components/dashboard/adaptive/model/` defines the `DashboardContext`, `DashboardViewModel`, widget contracts, mode profiles, visual tokens, and visual budget.
- `components/dashboard/adaptive/engine/normalizeSignals.ts` maps current app data into normalized dashboard signals.
- `components/dashboard/adaptive/engine/resolveDashboardWidgets.ts` selects widgets into fixed slots.
- `components/dashboard/adaptive/widgets/registry.tsx` is the widget bench. More widgets can exist here than the UI renders.
- `components/dashboard/adaptive/visuals/` contains semantic SVG medical patterns, anatomy watermarks, confidence bands, micro-bars, and matrix bubbles.
- `components/navigation/command-center/CommandCenterWorkspace.tsx` wires existing dashboard hooks and navigation callbacks into the adaptive shell.

## Mode Profiles

Mode profiles keep the shell predictable while changing which widgets earn slots:

- `pance`
- `eor`
- `didactic`
- `panre`
- `low_data`
- `overloaded`
- `behind`
- `ahead`

Low-data and overloaded modes use quiet visual budgets. PANRE uses calm maintenance language and avoids PANCE-style urgency.

## Widget Selection Rules

Each widget defines:

- eligible context
- allowed slots
- score
- optional suppression
- data builder
- semantic visual token
- attribution string

The resolver enforces:

- one primary CTA above the fold
- max three insight cards
- max one red surface above the fold
- max two charts above the fold
- fixed slot placement
- mode-specific max visible widgets

## Adding a Widget

1. Add the widget component under `components/dashboard/adaptive/widgets/`.
2. Add a typed data shape in `widgets/widgetData.ts`.
3. Register it in `widgets/registry.tsx`.
4. Give it an attribution string and semantic visual token.
5. Add or update resolver tests if it can appear above the fold.

Do not show raw FSRS internals, peer comparisons, or behavioral-surveillance copy. If a signal is already handled by today’s plan, render it as protected/in-plan reassurance instead of a warning.
