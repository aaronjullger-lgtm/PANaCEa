---
name: panacea-style-system
description: "PANaCEa design system reference — typography tokens, visual hierarchy tiers, shared component helpers, and inline style conventions. Use this skill whenever modifying, creating, or reviewing UI components in the PANaCEa clinical library, reference views, toolkit, or any component using inline styles. Also trigger when the user mentions typography, fonts, styling, visual hierarchy, design tokens, color system, dark mode, or consistent look-and-feel across PANaCEa components."
---

# PANaCEa Style System

This skill contains the design system for PANaCEa's clinical education UI. It exists because PANaCEa intentionally uses inline styles (not CSS modules or Tailwind) in its library/reference components, and consistency depends on using the right tokens and patterns everywhere.

## Typography Tokens

Three font families, each with a specific role:

```ts
const FONT_HEADING = "'Poppins', system-ui, sans-serif";   // Entity names, section headers, navigation
const FONT_BODY    = "'Inter', system-ui, sans-serif";      // Clinical content, descriptions, labels
const FONT_MONO    = "'JetBrains Mono', 'Fira Code', monospace"; // Lab ranges, dosages, scores, numeric data
```

**When to use each:**
- **Poppins (FONT_HEADING):** Card titles via `cardTitle()`, detail group `<summary>` labels, hub/page `<h2>` headers, entity names in lists. Weight 600-700, sizes 13-22px.
- **Inter (FONT_BODY):** Everything else — detail section labels (12px, 700wt, uppercase, letterSpacing 0.6), detail section body (14px, lineHeight 1.6), badge text (11px), descriptions and explanations, PANCE Focus accordion content.
- **JetBrains Mono (FONT_MONO):** Any numeric clinical data — lab reference ranges, SI units, sensitivity/specificity percentages, max scores, dosages. Always pair with `fontVariantNumeric: 'tabular-nums'` for aligned columns.

## Three-Tier Visual Hierarchy

Every piece of clinical content falls into exactly one of three tiers:

### Tier 1: CRITICAL (Safety)
Red left-border + warning background + AlertTriangle icon. Used for content where missing it could harm a patient.

```ts
const detailSectionCritical = (label: string, content: React.ReactNode) => (
  <div style={{
    marginBottom: 14, padding: '10px 12px', borderRadius: 8,
    borderLeft: '3px solid #ef4444',
    background: 'color-mix(in srgb, var(--color-bg-secondary) 80%, #fef2f2 20%)',
  }}>
    <div style={{
      fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 0.6, color: '#dc2626', marginBottom: 4,
      fontFamily: FONT_BODY, display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <AlertTriangle size={12} /> {label}
    </div>
    <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.6, fontFamily: FONT_BODY }}>
      {content}
    </div>
  </div>
);
```

**Applies to:** contraindications (absolute + relative), critical lab values, emergency/acute management, decompensation signs, red flag responses, "when NOT to use" scoring system warnings.

### Tier 2: CLINICAL (Standard)
Clean label + body with no special border. The workhorse for most clinical information.

```ts
const detailSection = (label: string, content: React.ReactNode) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{
      fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 0.6, color: 'var(--color-text-secondary)',
      marginBottom: 4, fontFamily: FONT_BODY,
    }}>{label}</div>
    <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.6, fontFamily: FONT_BODY }}>
      {content}
    </div>
  </div>
);
```

**Applies to:** descriptions, mechanisms, indications, technique, interpretation, clinical context, typical use — any factual clinical content that isn't safety-critical.

### Tier 3: STUDY (PANCE Focus Accordion)
Collapsible `<details>` with entity accent color border, positioned at the TOP of every detail view. Contains board yield facts, clinical pearls, test question tips, common mistakes, mnemonics.

```ts
const studyPanel = (pearls, tips, mistakes, mnemonics, boardFacts, accentColor) => (
  <details style={{
    marginBottom: 16, borderRadius: 10,
    border: `1px solid ${accentColor || 'var(--color-border)'}`,
    background: 'var(--color-bg-secondary)',
    overflow: 'hidden',
  }}>
    <summary>🎯 PANCE Focus ({count} items)</summary>
    {/* Per-section collapsible items with count badges */}
  </details>
);
```

## Progressive Disclosure

Use `<details open>` for grouping related sections without hiding them by default:

```ts
const detailGroup = (title: string, children: React.ReactNode) => (
  <details open style={{ marginBottom: 16 }}>
    <summary style={{
      fontSize: 13, fontWeight: 700, fontFamily: FONT_HEADING,
      color: 'var(--color-text-primary)', cursor: 'pointer',
      padding: '8px 0', borderBottom: '1px solid var(--color-border)',
      marginBottom: 10, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <ChevronRight size={14} style={{ transition: 'transform 0.15s' }} />
      {title}
    </summary>
    <div>{children}</div>
  </details>
);
```

CSS in `index.css` handles chevron rotation (`details[open] > summary > svg:first-child { transform: rotate(90deg); }`) and marker removal.

## Cross-Reference Hints

For linking between sections that live in different view trees:

```ts
const crossRefHint = (text: string, icon?: React.ReactNode) => (
  <div style={{
    marginBottom: 14, padding: '8px 12px', borderRadius: 8,
    background: 'color-mix(in srgb, var(--color-bg-secondary) 90%, var(--color-accent, #3b82f6) 10%)',
    border: '1px dashed var(--color-border)',
    fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY,
    display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.5,
  }}>
    {icon || <BookOpen size={13} />}
    {text}
  </div>
);
```

## Color System

- **Theme colors** via CSS custom properties: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`, `--color-border`, `--color-accent`.
- **Hardcoded reds are safe** for safety borders: `#ef4444` (border), `#dc2626` (label text), `#fef2f2` (background tint).
- **`color-mix(in srgb, ...)`** for dark-mode-adaptive tinted backgrounds — blend with `var(--color-bg-secondary)` as base so it auto-adapts.
- **Entity accent colors** are hardcoded per-config (e.g., procedures=#10b981, imaging=#f59e0b, labs=#0ea5e9).

## Badge Patterns

```ts
const badge = (text: string, bg: string, color: string) => (
  <span style={{
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
    background: bg, color, whiteSpace: 'nowrap', fontFamily: FONT_BODY,
  }}>{text}</span>
);
const highYieldBadge = () => badge('★ High Yield', '#fef3c7', '#92400e');
```

## Rules

1. **Never truncate clinical detail content.** `overflow: hidden` and `textOverflow: ellipsis` are only acceptable on collapsed card previews.
2. **Always use CSS custom properties** for theme colors. Only exception: safety reds and entity accent colors.
3. **New shared helpers go in `referenceConfigs.tsx`**, not duplicated per-config.
4. **Typography tokens are constants**, not inline strings. Import or re-declare `FONT_HEADING`, `FONT_BODY`, `FONT_MONO`.
5. **Config-driven architecture**: add features to `ReferenceViewConfig<T>` interface and shared helpers, not per-entity one-offs.
