# PANaCEa Design System: "Glass & Gradient"

**Version:** 1.0  
**Status:** Active  
**Last Updated:** January 2025

---

## 🎨 Design Philosophy

PANaCEa's interface unifies clinical precision with modern aesthetics through the **"Glass & Gradient"** system:

- **Glassmorphism:** Subtle transparency and backdrop blur create depth and hierarchy
- **Gradient Glows:** Color-coded visual cues for feature categorization
- **Consistent Hierarchy:** Clear button ranks and card surface levels prevent confusion
- **Clinical Palette:** Blues, sage greens, and warm ambers reflect medical professionalism

---

## 🔲 Surface Hierarchy

### Card Surfaces

All cards use `GlassCard` component with standardized variants:

| Variant | Use Case | Background | Border | Glow |
|---------|----------|------------|--------|------|
| **primary** | Core features (PANCE Simulation) | `from-action-blue/10 via-deep-plum-400/5 to-deep-plum-300/10` | `action-blue/20` → `40` on hover | Subtle blue |
| **success** | Positive states, achievements | `from-sage-500/10 via-sage-400/5 to-sage-600/10` | `sage-500/20` → `40` | Subtle green |
| **warning** | Daily challenges, due reviews | `from-muted-amber/10 via-muted-amber/5` | `muted-amber/20` → `40` | Subtle amber |
| **info** | Interactive features (OSCE) | `from-steel-blue-400/10 via-steel-blue-500/5 to-action-blue/10` | `steel-blue-400/20` → `40` | Subtle cyan |
| **neutral** | Standard cards, fallback | `bg-[var(--color-bg-primary)]` | `[var(--color-border)]` | None |

**Standards:**
- **Border Radius:** Always `rounded-2xl` (16px) for large cards
- **Padding:** Large cards use `p-4` to `p-6`, small cards use `p-3` to `p-4`
- **Backdrop Blur:** `backdrop-blur-sm` on all glass surfaces
- **Hover:** Subtle `border-color` shift and `shadow-lg` enhancement

---

## 🔘 Button Hierarchy

### Unified Button System

Resolves conflicts between Grand Rounds (orange), PANCE (outline), and OSCE (blue gradient):

| Rank | Variant | Visual | Use Case | Examples |
|------|---------|--------|----------|----------|
| **Primary** | `primary` | **Gradient Blue** `from-blue-600 to-indigo-600` | Main action, CTA | "Start Session", "Start Encounter" |
| **Secondary** | `secondary` | **Glass/Outline** White bg, colored border | Alternative actions | "View Details", "Review Again" |
| **Warning** | `warning` | **Gradient Amber** `from-amber-500 to-orange-500` | Daily challenges, alerts | "Start Grand Rounds" |
| **Success** | `success` | **Gradient Green** `from-emerald-500 to-green-600` | Completion, positive | "Complete Achievement" |
| **Danger** | `danger` | **Gradient Red** `from-red-500 to-rose-600` | Destructive actions | "Delete Item" |
| **Ghost** | `ghost` | **Transparent** Hover bg only | Tertiary, subtle | "Cancel", "Skip" |

**Standards:**
- **Height:** `sm` = 36px, `md` = 48px, `lg` = 56px
- **Border Radius:** `rounded-xl` (12px)
- **Font Weight:** Semibold (600)
- **Hover:** `scale(1.02)` + subtle lift shadow
- **Active:** `scale(0.98)`
- **Icons:** Left icon for action type, right icon (`ChevronRight`) for navigation

**Resolution of Current Conflicts:**
- **Grand Rounds Banner:** Use `warning` variant (amber gradient) ✅
- **Core PANCE Simulation:** Use `secondary` variant (glass/outline) for understated elegance ✅
- **Virtual OSCE:** Use `primary` variant (blue gradient) for emphasis ✅
- **PANRE-LA:** Use custom `deep-plum-500` solid (specialty feature) ✅

---

## 📐 Icon Containers

Consistent icon treatment across all cards and sections:

### Standard Icon Box

```tsx
<div className="p-2 rounded-lg bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-accent)]/10 transition-colors">
  <Icon className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]" />
</div>
```

### Feature Icon Box (Larger Cards)

```tsx
<div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
  <Icon className="w-6 h-6 text-[var(--color-text-secondary)]" />
</div>
```

### Colored Icon Box (Specialty Features)

```tsx
<div className="p-3 rounded-xl bg-{color}/20">
  <Icon className="w-6 h-6 text-{color}" />
</div>
```

**Standards:**
- **Border Radius:** `rounded-lg` (8px) for small, `rounded-xl` (12px) for large
- **Padding:** `p-2` for small (20px box), `p-3` for large (32px box)
- **Background:** Always `bg-[var(--color-bg-secondary)]` for neutral, or `color/20` for themed
- **Icon Size:** `w-5 h-5` for small cards, `w-6 h-6` for hero cards
- **Hover:** Icon and background transition color on card hover

---

## 🎯 Typography Scale

### Headings

| Level | Class | Use Case | Font Size | Weight | Color |
|-------|-------|----------|-----------|--------|-------|
| **H1** | `.text-2xl md:text-3xl` | Page greeting | 24px → 30px | Bold | `text-[var(--color-text-primary)]` |
| **H2** | `.text-xl md:text-2xl` | Section header | 20px → 24px | Bold | `text-[var(--color-text-primary)]` |
| **H3** | `.text-lg` | Card title | 18px | Bold/Semibold | `text-[var(--color-text-primary)]` |
| **H4** | `.text-base` | Subsection | 16px | Semibold | `text-[var(--color-text-primary)]` |

### Body Text

| Element | Class | Use Case | Font Size | Weight | Color |
|---------|-------|----------|-----------|--------|-------|
| **Body** | `.text-base` | Primary text | 16px | Regular | `text-[var(--color-text-primary)]` |
| **Secondary** | `.text-sm` | Descriptions | 14px | Regular | `text-[var(--color-text-muted)]` |
| **Caption** | `.text-xs` | Metadata, badges | 12px | Medium | `text-[var(--color-text-muted)]` |
| **Stats** | `.text-lg` or `.text-2xl` | Numbers | 18px or 24px | Bold | Contextual color |

**Standards:**
- **Line Height:** Default `leading-normal` (1.5), `leading-relaxed` (1.625) for body text
- **Color Tokens:** Use CSS variables for theme-aware colors
- **Truncation:** Apply `.truncate` or `.line-clamp-{n}` to prevent overflow

---

## 📏 Spacing & Density

### Card Padding

| Card Type | Padding Class | Use Case |
|-----------|---------------|----------|
| **Hero Cards** | `p-5` to `p-6` | Grand Rounds, Core Adaptive, OSCE |
| **Standard Cards** | `p-4` | Training mode cards, resource links |
| **Compact Cards** | `p-3` | Quick stats bar, small info cards |

### Section Gaps

| Element | Gap Class | Spacing |
|---------|-----------|---------|
| **Section Margin** | `mb-6` to `mb-8` | 24px to 32px between major sections |
| **Card Grid Gap** | `gap-3` to `gap-4` | 12px to 16px between grid items |
| **Icon-Text Gap** | `gap-2` to `gap-3` | 8px to 12px between icon and label |
| **Flex Item Gap** | `gap-3` to `gap-4` | 12px to 16px between flex children |

**Standards:**
- **Consistency:** Use `gap-3` as default for most layouts
- **Breathing Room:** Hero cards use `gap-4` or `gap-6` for visual prominence
- **Mobile-First:** Smaller gaps on mobile, increase on `md:` breakpoints

---

## 🎨 Color Tokens

### Primary Colors

```css
--color-action-blue: #3B82F6;      /* Primary CTA, links */
--color-deep-plum-500: #6B21A8;    /* Specialty accents */
--color-sage-500: #10B981;         /* Success, positive */
--color-muted-amber: #F59E0B;      /* Warnings, challenges */
--color-steel-blue-400: #38BDF8;   /* Info, OSCE */
--color-dusty-rose: #F43F5E;       /* Danger, alerts */
```

### Surface Colors (CSS Variables)

```css
--color-bg-primary: /* White (light) / Slate-900 (dark) */
--color-bg-secondary: /* Slate-100 (light) / Slate-800 (dark) */
--color-border: /* Slate-200 (light) / Slate-700 (dark) */
--color-text-primary: /* Slate-900 (light) / White (dark) */
--color-text-secondary: /* Slate-700 (light) / Slate-300 (dark) */
--color-text-muted: /* Slate-500 (light) / Slate-400 (dark) */
--color-accent: /* Action-blue or contextual color */
```

**Standards:**
- **CSS Variables:** Always use `var(--color-*)` for theme-aware colors
- **Opacity Modifiers:** Use `/10`, `/20`, `/40` for transparent layers
- **Gradient Syntax:** `from-{color} via-{color}/opacity to-{color}/opacity`

---

## ✅ Component Checklist

When creating or updating a component, verify:

- [ ] **Card:** Uses `GlassCard` with correct variant
- [ ] **Button:** Uses `PrimaryButton` with correct variant (primary/secondary/warning)
- [ ] **Icon Container:** Matches standard sizing (`p-2 rounded-lg` or `p-3 rounded-xl`)
- [ ] **Typography:** Uses scale from H1-H4 and body/secondary text
- [ ] **Spacing:** Follows padding/gap standards (cards: `p-4`-`p-6`, gaps: `gap-3`-`gap-4`)
- [ ] **Colors:** Uses CSS variables (`var(--color-*)`) for theme awareness
- [ ] **Hover States:** Subtle scale/translate/shadow changes
- [ ] **Accessibility:** Icons have `aria-label`, buttons have descriptive text
- [ ] **Responsive:** Mobile-first design, `md:` and `lg:` breakpoints for larger screens

---

## 🚀 Migration Guide

### Before (Inconsistent)

```tsx
// Grand Rounds: Orange solid button, tight padding
<button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white">
  Start
</button>

// PANCE: White outline button
<button className="px-6 py-3 bg-white border-2 border-slate-200 hover:border-blue-500">
  Start Session
</button>

// OSCE: Blue gradient button, spacious padding
<button className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
  Start Encounter
</button>
```

### After (Unified)

```tsx
// Grand Rounds: Warning variant
<PrimaryButton variant="warning" size="md" icon={Play} onClick={onStart}>
  Start
</PrimaryButton>

// PANCE: Secondary variant (glass/outline)
<PrimaryButton variant="secondary" size="lg" icon={Play} iconRight={ChevronRight} onClick={onStart}>
  Start Session
</PrimaryButton>

// OSCE: Primary variant (blue gradient)
<PrimaryButton variant="primary" size="md" icon={Play} iconRight={ChevronRight} onClick={onStart}>
  Start Encounter
</PrimaryButton>
```

---

## 📚 Examples

### Hero Card (Grand Rounds)

```tsx
<GlassCard variant="warning" hoverable className="mb-6">
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
    <div>
      <CardHeader
        icon={Trophy}
        iconColor="text-muted-amber"
        title="Grand Rounds"
        subtitle="Same questions for everyone. Compare your score!"
        badge={{
          text: `Daily Challenge • ${dateStr}`,
          color: 'bg-muted-amber/10 text-muted-amber border border-muted-amber/20',
        }}
      />
    </div>
    <PrimaryButton variant="warning" size="md" icon={Play} onClick={onStart}>
      Start
    </PrimaryButton>
  </div>
</GlassCard>
```

### Standard Training Mode Card

```tsx
<button className="w-full text-left p-4 rounded-xl border bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group">
  <div className="flex items-start gap-3">
    <div className="p-2 rounded-lg bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-accent)]/10 transition-colors">
      <Icon className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]" />
    </div>
    <div className="flex-1">
      <h4 className="font-semibold text-[var(--color-text-primary)]">
        Mode Title
      </h4>
      <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
        Brief description
      </p>
    </div>
    <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
  </div>
</button>
```

---

## 🔄 Versioning

**v1.0** (January 2025):
- Initial "Glass & Gradient" system
- Unified button hierarchy (Primary/Secondary/Warning)
- Standardized card surfaces (GlassCard variants)
- Icon container patterns
- Typography scale
- Spacing/density rules

Future updates will be documented here with semantic versioning.

---

## 📖 Related Documentation

- [Component Library](./COMPONENT_LIBRARY.md) - Detailed API docs for `GlassCard`, `PrimaryButton`
- [Tailwind Config](../tailwind.config.js) - Custom color tokens and utility classes
- [Master Documentation](../MASTER_DOCUMENTATION.md) - Overall architecture and patterns

---

**Questions?** Consult this guide when creating new UI components or refactoring existing ones. Consistency is key to professional, clinical UX.
