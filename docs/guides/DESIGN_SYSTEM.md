# PANaCEa Design System - Semantic Dark Mode

## Overview

PANaCEa uses a **semantic design system** with CSS variables (gold + slate palette) to support flawless dark mode switching. This system eliminates hardcoded color classes (like `bg-white`, `text-gray-900`, `bg-black`) and replaces them with semantic tokens that automatically adapt to light/dark themes. **Do not use pure black (#000000) or generic gray-900/zinc-900 for dark backgrounds**; use Brand Dark Blue (slate) and blue-tinted grays.

## Architecture

### 1. CSS Variable Layer (`index.css`)

The foundation is a comprehensive set of semantic CSS variables defined in `:root` (light mode) and `.dark` (dark mode). The palette is **Gold + Slate** (clinical, readable):

```css
:root {
  /* Main backgrounds - slate-50 / white */
  --background: #ffffff;
  --foreground: #0f172a;

  /* Card/Container system */
  --card: #ffffff;
  --card-foreground: #0f172a;

  /* Primary brand - gold family (not blue) */
  --primary: #9a8f72;
  --primary-foreground: #f8fafc;

  /* Muted/Secondary */
  --muted: #f1f5f9;
  --muted-foreground: #64748b;

  /* Border */
  --border: #e2e8f0;
}

.dark {
  /* Brand Dark Blue - NOT pure black */
  --background: #0f172a;
  --foreground: #f1f5f9;
  --card: #1e293b;
  --card-foreground: #f1f5f9;
  --primary: #a89b7a;
  --primary-foreground: #f8fafc;
  --muted: #334155;
  --muted-foreground: #94a3b8;
  --border: #475569;
}
```

### 2. Full `--color-*` Token Reference

Use these in components via `var(--color-*)` or Tailwind `bg-[var(--color-*)]` / `text-[var(--color-*)]`:

| Token | Purpose | Light | Dark |
|-------|---------|-------|------|
| `--color-bg-primary` | Canvas / page background | #F8FAFC | #0F172A |
| `--color-bg-secondary` | Cards, panels | #ffffff | #1E293B |
| `--color-bg-tertiary` | Subtle elevation | #f1f5f9 | #334155 |
| `--color-text-primary` | Primary text | #0f172a | #f1f5f9 |
| `--color-text-secondary` | Secondary text | #475569 | #cbd5e1 |
| `--color-text-muted` | Labels, placeholders | #64748b | #94a3b8 |
| `--color-text-inverse` | Text on accent (e.g. buttons) | #f8fafc | #f8fafc |
| `--color-border` | Borders, dividers | #e2e8f0 | #475569 |
| `--color-accent` | Primary CTA, links | #9a8f72 | #a89b7a |
| `--color-accent-hover` | Hover on accent | #8a7f62 | #b8ab8a |
| `--color-accent-secondary` | Charts, secondary CTAs | #728ba6 | #91a6bd |
| `--color-overlay` | Modal/overlay backdrop | rgba(15,23,42,0.5) | rgba(15,23,42,0.85) |
| `--color-focus-ring` | Keyboard focus ring | #9a8f72 | #a89b7a |
| `--color-data-pass` | Success / correct | #0d9488 | #2dd4bf |
| `--color-data-fail` | Error / incorrect | #b91c1c | #f87171 |
| `--color-data-provisional` | Warning / building | #b45309 | #fbbf24 |
| `--color-shadow-soft` | Card shadows (no black) | rgba(15,23,42,0.06) | rgba(15,23,42,0.4) |
| `--chart-grid-stroke` | Chart grid lines | rgba(15,23,42,0.08) | rgba(71,85,105,0.2) |

### 3. Tailwind Integration (`tailwind.config.js`)

Semantic variables are mapped to Tailwind utility classes (`background`, `foreground`, `card`, `primary`, `muted`, `border`, and legacy `bg-primary`, `text-primary`, `accent`, etc.). Prefer CSS variables for overlay, focus-ring, and data colors: `bg-[var(--color-overlay)]`, `ring-[var(--color-focus-ring)]`, `text-[var(--color-data-fail)]`.

### 4. Component Usage

**❌ Forbidden:**

- `bg-black`, `text-black`, `border-black`
- `bg-gray-900`, `dark:bg-gray-900`, `text-gray-900` for primary text/backgrounds
- Modal overlays with `bg-black/40` or `bg-black/70` (use `--color-overlay` + backdrop-blur)

**✅ Use semantic tokens:**

```tsx
<div className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
  <p className="text-[var(--color-text-muted)]">Subtitle</p>
</div>

/* Modal overlay */
<div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-md" />

/* Error icon */
<AlertCircle className="text-[var(--color-data-fail)]" />
```

## Semantic Token Reference

### Backgrounds

| Token / Class | Usage | Light | Dark |
|---------------|--------|-------|------|
| `bg-background` / `--color-bg-primary` | Main app background | Slate-50 / White | #0F172A (Brand Dark Blue) |
| `bg-card` / `--color-bg-secondary` | Cards, panels | #FFFFFF | #1E293B |
| `bg-muted` / `--color-bg-tertiary` | Subtle backgrounds | #F1F5F9 | #334155 |

### Text

| Token / Class | Usage | Light | Dark |
|---------------|--------|-------|------|
| `text-foreground` / `--color-text-primary` | Primary text | #0F172A | #F1F5F9 |
| `text-muted-foreground` / `--color-text-muted` | Secondary, labels | #64748B | #94A3B8 |
| `text-primary` (Tailwind) | Accent text, links | Gold | Gold |

### Borders

| Token | Usage | Light | Dark |
|-------|--------|-------|------|
| `border-border` / `--color-border` | Dividers, card borders | #E2E8F0 | #475569 |

Use `border-slate-700` / `border-slate-800` in dark mode for cards if not using `var(--color-border)`.

## Layout

- **Primary shell**: App.tsx uses AppBrand + PageContainer for the header; NavRail is the only active nav. Content is view-state driven; URL sync in App.tsx and CommandCenterHub.
- **Landing**: LandingPage uses AppBrand (size lg), PageContainer for sections, and SiteFooter for the copyright footer.
- **Page container**: Use `PageContainer` (or `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`) for consistent section/page width. Options: `maxWidth` `4xl` | `6xl` | `7xl`.
- **Deprecated**: MainLayout, Sidebar, and AppSidebar are not mounted; AccountFooter is unused (account/sync in EnhancedSettingsTab). See `components/layout/LAYOUT_README.md`.

## Common Patterns

### Card Layout (min 16px padding)

```tsx
<div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm">
  <h3 className="text-[var(--color-text-primary)] font-bold mb-2">Card Title</h3>
  <p className="text-[var(--color-text-muted)]">Card description</p>
</div>
```

### Primary Button (gold CTA)

```tsx
<button className="btn-primary">Action</button>
<!-- or -->
<button className="bg-[var(--color-accent)] text-[var(--color-text-inverse)] ...">Action</button>
```

### Modal Overlay (no black)

```tsx
<div className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-md flex items-center justify-center p-4">
  <div className="bg-[var(--color-bg-secondary)] rounded-xl ...">...</div>
</div>
```

### Error State

```tsx
<AlertCircle className="text-[var(--color-data-fail)]" />
<p className="text-[var(--color-text-primary)]">Error message</p>
```

## Status Colors (Semantic)

Use CSS variables for consistency and dark mode:

- **Success**: `var(--color-data-pass)`
- **Error**: `var(--color-data-fail)`
- **Warning / provisional**: `var(--color-data-provisional)`

## Shadows

Do not use default black shadows. Use design tokens:

- `shadow-brand`: `0 10px 40px -10px rgba(15, 23, 42, 0.5)` (Tailwind extend)
- `shadow-[0_4px_6px_-1px_var(--color-shadow-soft)]` for cards

## Charts

Use `lib/chartTheme.tsx`: grid uses `var(--chart-grid-stroke)` (defined in `index.css` for light/dark; fallback `var(--color-border-light)` in chartTheme). Colors use `var(--color-accent)`, `var(--color-accent-secondary)`, `var(--color-data-pass)`, etc. Grid lines should be faint blue-gray, not pure gray.

## Migration Guide

| Old Pattern | New Pattern |
|------------|-------------|
| `bg-white dark:bg-gray-900` | `bg-[var(--color-bg-primary)]` or `bg-background` |
| `bg-white dark:bg-gray-800` | `bg-[var(--color-bg-secondary)]` or `bg-card` |
| `text-gray-900 dark:text-white` | `text-[var(--color-text-primary)]` |
| `text-gray-600 dark:text-gray-400` | `text-[var(--color-text-muted)]` |
| `border-gray-200 dark:border-gray-700` | `border-[var(--color-border)]` |
| `bg-black/40` (overlay) | `bg-[var(--color-overlay)] backdrop-blur-md` |
| `text-red-500` (error icon) | `text-[var(--color-data-fail)]` |

## Benefits

- **No pure black**: Brand Dark Blue and slate reduce eye strain.
- **One source of truth**: Change theme in `index.css` only.
- **Accessibility**: Focus ring uses `--color-focus-ring`; contrast ratios maintained.
- **Charts**: Single theme (chartTheme) with semantic colors.

---

**Last Updated**: February 2025  
**Status**: Production-ready (gold/slate palette)  
**Coverage**: Core UI; integrations, modals, and modes should use semantic tokens per this doc.
