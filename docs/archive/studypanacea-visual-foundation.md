# StudyPanacea Visual Foundation

Last updated: 2026-05-14

This file documents the token foundation for the StudyPanacea redesign. The current theme name is **Diagnostic Atlas OS**.

## Token Sources

CSS variables live in `index.css`.

Tailwind aliases live in `tailwind.config.js` under `theme.extend.colors.atlas` and the `atlas-*` shadows.

TypeScript token exports live in:

- `lib/tokens/colors.ts`
- `lib/tokens/medical.ts`
- `lib/tokens/index.ts`

## Core Atlas Tokens

Use these CSS variables for redesigned landing and dashboard surfaces:

- `--atlas-bg`: near-black medical navy background
- `--atlas-bg-soft`: softened navy background band
- `--atlas-surface`: base elevated panel surface
- `--atlas-surface-elevated`: stronger elevated surface
- `--atlas-surface-glass`: translucent glass surface
- `--atlas-border`: low-contrast clinical panel border
- `--atlas-border-glow`: cyan scanner/glow border
- `--atlas-accent-cyan`: primary scanner/action accent
- `--atlas-accent-blue`: secondary clinical blue
- `--atlas-accent-violet`: tutor/intelligence accent
- `--atlas-accent-pulse-pink`: urgent pulse accent
- `--atlas-success-green`: stable/mastered state
- `--atlas-warning-amber`: watch/review state
- `--atlas-text-muted`: secondary text on dark atlas surfaces
- `--atlas-clinical-white`: primary text on dark atlas surfaces

## Opt-In Theme Class

Use `.theme-diagnostic-atlas` or `.diagnostic-atlas-os` on a redesign root when a region should map atlas tokens onto existing PANaCEa and shadcn variables.

```tsx
<section className="theme-diagnostic-atlas atlas-medical-grid text-atlas-white">
  ...
</section>
```

Do not apply this class globally until the landing page or dashboard shell is intentionally redesigned.

## Utility Classes

- `.atlas-medical-grid`: dark clinical grid background with subtle scanner glows
- `.atlas-radial-glow`: pseudo-element radial glow wrapper
- `.atlas-glass-card`: translucent dark glass panel
- `.atlas-border-glow`: cyan border and glow treatment
- `.atlas-scanner-line`: animated scanner sweep overlay
- `.atlas-focus-ring`: accessible cyan focus ring
- `.atlas-noise-overlay`: lightweight noise overlay using the existing inline texture
- `.atlas-motion-safe`: shared motion duration/easing
- `.atlas-reduced-motion-safe`: reduced-motion-safe wrapper for animated regions

## Tailwind Examples

```tsx
<div className="theme-diagnostic-atlas atlas-medical-grid">
  <article className="atlas-glass-card border-atlas-border p-6 shadow-atlas-glass">
    <p className="text-atlas-muted">Readiness vitals</p>
    <strong className="font-mono text-atlas-cyan tabular-nums">82%</strong>
  </article>
</div>
```

## TypeScript Examples

```ts
import { diagnosticAtlas, color } from '@/lib/tokens';

const surface = diagnosticAtlas.color.glassSurface;
const focusClass = diagnosticAtlas.className.focusRing;
const cyan = color.atlas.cyan;
```

## Accessibility Rules

- Use `--atlas-clinical-white` for primary text on dark atlas surfaces.
- Use `--atlas-text-muted` only for secondary copy, never essential values.
- Keep icon-only controls labelled and focusable.
- Decorative grid, glow, scanner, and noise layers should be hidden from assistive technology when rendered as DOM elements.
- Scanner and pulse effects must respect `prefers-reduced-motion`.

## Implementation Rule

The atlas foundation is additive. Future components should use the atlas tokens and utilities inside redesigned surfaces, but existing pages should not be visually rewritten until their implementation phase begins.
