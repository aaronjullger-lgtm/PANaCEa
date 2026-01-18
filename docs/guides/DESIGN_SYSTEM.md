# PANaCEa Design System - Semantic Dark Mode

## Overview

PANaCEa uses a **semantic design system** with CSS variables to support flawless dark mode switching. This system eliminates hardcoded color classes (like `bg-white`, `text-gray-900`) and replaces them with semantic tokens that automatically adapt to light/dark themes.

## Architecture

### 1. CSS Variable Layer (`index.css`)

The foundation is a comprehensive set of semantic CSS variables defined in `:root` (light mode) and `.dark` (dark mode):

```css
:root {
  /* Main backgrounds */
  --background: #ffffff;
  --foreground: #0f172a;

  /* Card/Container system */
  --card: #ffffff;
  --card-foreground: #0f172a;

  /* Primary brand color */
  --primary: #0284c7;
  --primary-foreground: #ffffff;

  /* Muted/Secondary */
  --muted: #f1f5f9;
  --muted-foreground: #64748b;

  /* Border */
  --border: #e2e8f0;
}

.dark {
  --background: #0f172a;
  --foreground: #f1f5f9;
  --card: #1e293b;
  --card-foreground: #f1f5f9;
  --primary: #0ea5e9;
  --primary-foreground: #ffffff;
  --muted: #334155;
  --muted-foreground: #94a3b8;
  --border: #475569;
}
```

### 2. Tailwind Integration (`tailwind.config.js`)

Semantic variables are mapped to Tailwind utility classes:

```javascript
colors: {
  // Semantic Design System
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  card: 'var(--card)',
  'card-foreground': 'var(--card-foreground)',
  primary: 'var(--primary)',
  'primary-foreground': 'var(--primary-foreground)',
  muted: 'var(--muted)',
  'muted-foreground': 'var(--muted-foreground)',
  border: 'var(--border)',
}
```

### 3. Component Usage

Components use semantic Tailwind classes instead of hardcoded colors:

**❌ Before (hardcoded):**

```tsx
<div className="bg-white text-gray-900 dark:bg-slate-900 dark:text-gray-100">
  <p className="text-gray-600 dark:text-gray-400">Subtitle</p>
</div>
```

**✅ After (semantic):**

```tsx
<div className="bg-background text-foreground">
  <p className="text-muted-foreground">Subtitle</p>
</div>
```

## Semantic Token Reference

### Backgrounds

| Token           | Usage                               | Light Mode | Dark Mode |
| --------------- | ----------------------------------- | ---------- | --------- |
| `bg-background` | Main app background                 | `#FFFFFF`  | `#0F172A` |
| `bg-card`       | Cards, panels, elevated surfaces    | `#FFFFFF`  | `#1E293B` |
| `bg-muted`      | Subtle backgrounds, disabled states | `#F1F5F9`  | `#334155` |

### Text

| Token                     | Usage                                | Light Mode | Dark Mode |
| ------------------------- | ------------------------------------ | ---------- | --------- |
| `text-foreground`         | Primary text                         | `#0F172A`  | `#F1F5F9` |
| `text-card-foreground`    | Text on cards                        | `#0F172A`  | `#F1F5F9` |
| `text-muted-foreground`   | Secondary text, labels, placeholders | `#64748B`  | `#94A3B8` |
| `text-primary`            | Accent text, links                   | `#0284C7`  | `#0EA5E9` |
| `text-primary-foreground` | Text on primary backgrounds          | `#FFFFFF`  | `#FFFFFF` |

### Borders

| Token           | Usage                  | Light Mode | Dark Mode |
| --------------- | ---------------------- | ---------- | --------- |
| `border-border` | Dividers, card borders | `#E2E8F0`  | `#475569` |

## Common Patterns

### Card Layout

```tsx
<div className="bg-card border border-border rounded-xl p-6 shadow-sm">
  <h3 className="text-card-foreground font-bold mb-2">Card Title</h3>
  <p className="text-muted-foreground">Card description</p>
</div>
```

### Primary Button

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg">
  Action
</button>
```

### Muted Background Section

```tsx
<div className="bg-muted border border-border rounded-lg p-4">
  <p className="text-muted-foreground">Less prominent content</p>
</div>
```

### Transparent Overlays

```tsx
<div className="bg-card/50 backdrop-blur-sm border border-border/50">Glass morphism effect</div>
```

## Legacy Compatibility

For backward compatibility, the old `--color-*` variables are maintained:

```css
/* Legacy (still supported) */
--color-bg-primary: #ffffff;
--color-text-primary: #0f172a;
--color-accent: #0284c7;
```

These map to the same values as semantic variables, so existing components continue to work. **New code should use semantic tokens.**

## Status Colors

For success/error states, use Tailwind's native color scales with appropriate dark mode variants:

```tsx
// Success (emerald)
<div className="bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400">
  Correct answer
</div>

// Error (red)
<div className="bg-red-500/10 border-red-500 text-red-600 dark:text-red-400">
  Incorrect answer
</div>

// Warning (amber)
<div className="bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400">
  Warning message
</div>
```

## Migration Guide

### Step 1: Identify Hardcoded Colors

Search for patterns like:

- `bg-white`, `bg-gray-*`, `bg-slate-*`
- `text-black`, `text-gray-*`, `text-slate-*`
- `border-gray-*`, `border-slate-*`

### Step 2: Replace with Semantic Tokens

| Old Pattern                             | New Pattern             |
| --------------------------------------- | ----------------------- |
| `bg-white dark:bg-slate-900`            | `bg-background`         |
| `bg-white dark:bg-slate-800`            | `bg-card`               |
| `bg-gray-100 dark:bg-slate-700`         | `bg-muted`              |
| `text-gray-900 dark:text-white`         | `text-foreground`       |
| `text-gray-600 dark:text-gray-400`      | `text-muted-foreground` |
| `border-gray-200 dark:border-slate-700` | `border-border`         |

### Step 3: Test Both Themes

1. Toggle dark mode using system/app theme switcher
2. Verify no color flicker or contrast issues
3. Check all interactive states (hover, active, disabled)

## Benefits

✅ **No dark mode duplication**: Write classes once, work in both themes  
✅ **Semantic naming**: `text-muted-foreground` is clearer than `text-gray-600 dark:text-gray-400`  
✅ **Centralized control**: Change theme colors in one place (`index.css`)  
✅ **Type safety**: Tailwind autocomplete suggests semantic tokens  
✅ **Performance**: No runtime class switching, CSS variables resolve instantly

## Examples in Codebase

- **`PatientEncounterMode.tsx`**: Results page using `bg-card`, `text-muted-foreground`, `border-border`
- **`MiniDrillLayout.tsx`**: Drill layout with semantic backgrounds and success/error states
- **`RapidRecallDrill.tsx`**: Flashcard UI with `bg-background`, `text-foreground`

## Future Enhancements

- [ ] Add `--destructive` and `--destructive-foreground` for delete actions
- [ ] Add `--accent` and `--accent-foreground` for tertiary actions
- [ ] Add `--input` and `--ring` for form controls
- [ ] Document animation tokens (durations, easings)
- [ ] Add component-specific tokens (e.g., `--sidebar-bg`, `--header-border`)

---

**Last Updated**: December 2024  
**Status**: ✅ Production-ready  
**Coverage**: Core UI components refactored; drill modes and admin panels complete
