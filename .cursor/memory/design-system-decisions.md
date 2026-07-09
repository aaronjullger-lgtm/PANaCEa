# Design System Decisions (durable)

Reusable UI/design decisions so agents don't re-litigate them. Authoritative spec: `.cursor/rules/ui-design-system.mdc`. Record only durable decisions. Format: `- YYYY-MM-DD — <decision> (rationale; where it applies)`.

- 2026-07-09 — Colors come only from Stormy Slate CSS variables/tokens; no raw hex outside `lib/tokens/`, no `bg-black`/`#000000` (dark uses deep navy). (rationale: consistency + theming; applies: all UI)
- 2026-07-09 — Data-viz colors are muted slate; semantic colors (success/error/warning/info) are reserved for status/toasts, not stat cards. (applies: charts, KPI cards)
- 2026-07-09 — Reuse primitives (`GlassCard`, `Button`, `EmptyState`, `SkeletonLoader`); never edit their base styles without approval — changes cascade site-wide. (applies: all UI)
- 2026-07-09 — Gate all animation behind `useReducedMotion()`; never add global `transition-*` to `a, button, [role="button"]` (breaks Framer Motion site-wide). (applies: motion)
- 2026-07-09 — Keep `LandingPage.tsx` inline styles (Tailwind-purge safety net). One primary CTA per screen. `tabular-nums` on numeric columns. (applies: landing/marketing, data tables)
- 2026-07-09 — Product identity is a clinical diagnostic workstation, not a generic AI SaaS template (no big gradients/blobs/neon/robot mascots/emoji icons). (applies: landing/hero/new UI)
