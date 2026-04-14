# Audit 11 — Design System, UI Primitives & Cross-App Consistency

**Date:** 2026-04-02
**Scope:** Shared UI components, button/input/card/modal primitives, design tokens, icon usage, loading/error/empty states, dark mode, and component duplication across features.
**Methodology:** Catalogued every primitive in `components/ui/`, compared against actual usage across `components/`, `pages/`, and `hooks/`. Counted import frequencies vs inline reinventions. Traced the token pipeline from CSS custom properties → Tailwind config → component consumption.

---

## Executive Summary

PANaCEa has the *foundation* of a strong design system — a well-designed CSS custom property layer, a semantic color palette with clinical-specific tokens, a capable `Button` component with 8 variants, a `Card` with subcomponents, a `GlassCard` with glassmorphism, `EmptyState` with 7 presets, and comprehensive loading/error components. **The problem is adoption, not absence.** Only 4 components import the Card primitive (vs ~193 inline card-style divs). Only 5 files import the Button primitive (vs ~1,100 raw `<button>` elements across the component tree). Modals are structurally consistent in their overlay pattern but have no shared base component, so each of the 29 modals reimplements focus trapping, backdrop, Escape handling, and animation independently. The design system exists; it just isn't used.

**15 findings:** 1 Critical, 4 High, 6 Medium, 4 Low

---

## Section 1: Token & Color Architecture

### Finding 11-1: Three-Layer Token System — Sound Architecture, Leaky Adoption (MEDIUM)

**Files:**
- `index.css` — CSS custom properties (`:root` and `.dark` selectors)
- `lib/design-tokens.ts` — Token objects (if present)
- `tailwind.config.js` — Extended theme with 6 palettes, 140+ safelist entries

**Architecture:** The token pipeline is correctly layered:
1. CSS variables (`--color-bg-primary`, `--color-accent`, `--color-data-pass`, etc.) switch on `.dark` class
2. Tailwind config references these via `var(--color-*)` in its `colors` extension
3. Components consume via `bg-[var(--color-bg-secondary)]` or semantic Tailwind classes like `bg-data-pass`

**Leak points:**
- **45+ hardcoded hex values** found across components (e.g., `#ef4444`, `#334155`, `#f59e0b`). These bypass the token system and break dark mode or high-contrast mode.
- **Heaviest offenders:** `ACLSRefCards.tsx` (12+ hex), `DynamicScoringCalculator.tsx` (10+ hex), `ClinicalEyeMode.tsx` (8+ hex), `TrendSparkline.tsx` (6+ hex)
- **Chart/SVG contexts** are the primary leak — Recharts, D3, and SVG inline styles don't easily consume CSS variables, so developers hardcode hex values for chart colors.

**User Impact:** Charts and data visualizations will not respond to dark mode or high-contrast mode toggles. A student studying at night in dark mode sees jarring bright chart colors.

---

### Finding 11-2: `GlassCard` `info` and `primary` Variants Are Identical (LOW)

**File:** `components/ui/GlassCard.tsx:30-50`

```typescript
primary: {
  bg: 'bg-gradient-to-br from-[var(--color-accent)]/10 via-[var(--color-accent)]/5 to-[var(--color-accent)]/10',
  border: 'border-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/40',
  glow: 'bg-[var(--color-accent)]/10',
},
info: {
  bg: 'bg-gradient-to-br from-[var(--color-accent)]/10 via-[var(--color-accent)]/5 to-[var(--color-accent)]/10',
  border: 'border-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/40',
  glow: 'bg-[var(--color-accent)]/10',
},
```

**Problem:** The `info` and `primary` variants produce byte-identical CSS. The `info` variant should use a distinct color (e.g., cyan / `--color-clinical-blue`) to differentiate informational cards from primary action cards. Currently developers choosing between them get the same visual result.

---

### Finding 11-3: Tailwind Safelist Bloat — 140+ Entries (LOW)

**File:** `tailwind.config.js:13-137`

**Problem:** The safelist contains 140+ entries including gradient classes (`from-purple-400`, `to-indigo-700`), data color opacity patterns, and UI state classes. This exists because components use string interpolation to build class names dynamically (e.g., `` `bg-${colorName}-500` ``), defeating Tailwind's static analysis.

**Impact:** Increased CSS bundle size. Every safelisted class is included in the production build regardless of whether it's actually used. The regex patterns alone (lines 56-58) generate hundreds of utility classes.

**Better pattern:** Use CSS variables for dynamic colors instead of dynamic Tailwind classes. The codebase already does this for most components — the safelist entries are mostly for legacy code paths.

---

## Section 2: Component Primitive Adoption

### Finding 11-4: Button Primitive Exists But Has ~2% Adoption Rate (CRITICAL)

**Files:**
- `components/ui/button.tsx` — Well-designed: 8 variants, 5 sizes, loading state, icon support, accessibility
- ~1,100 `<button>` elements across `components/`
- Only **5 files** import from `components/ui/button`

**Evidence:**
- `Button` component supports `primary`, `secondary`, `danger`, `ghost`, `outline`, `warning`, `accent`, `success` variants
- `SemanticButton` wrapper adds `isLoading`, `leftIcon`, `rightIcon`, `fullWidth` props
- Convenience exports: `PrimaryButton`, `SecondaryButton`, `DangerButton`, `OutlineButton`, `WarningButton`, `SuccessButton`, `StartSessionButton`, `ActionButton`, `GhostButton`
- Despite all this, the vast majority of buttons are raw `<button className="px-4 py-2 rounded-lg ...">` elements

**Specific inline button examples:**
- `ForgettingCurveVisualization.tsx:285` — `<button className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">`
- `ContentEditor.tsx:252` — Full inline button with icon, manually assembling the same pattern `Button` already provides
- `EmptyState.tsx:171-183` — The EmptyState component's own action button is a raw `<button>` instead of using `Button`

**User Impact:** Inconsistent touch targets (some buttons have `min-h-[44px]`, most don't), inconsistent focus rings (the `Button` has `focus-visible:ring-2`, raw buttons don't), inconsistent loading states (only `Button` shows a spinner), and inconsistent disabled styling.

**Production Blocking:** Yes — accessibility audit would flag hundreds of buttons missing focus indicators. Touch targets below 44px fail WCAG 2.5.8 on mobile.

---

### Finding 11-5: Card Primitive Has ~2% Adoption Rate (HIGH)

**Files:**
- `components/ui/Card.tsx` — Simple card with `CardHeader`, `CardTitle`, `CardContent` subcomponents
- `components/ui/GlassCard.tsx` — Glassmorphism card with 5 variants, animation, reduced-motion support
- `components/ui/StudyCard.tsx` — Study mode selection card
- `components/dashboard/UnifiedDashboard/Card.tsx` — **Competing** dashboard-specific Card (different API)
- ~193 inline card-pattern divs across the codebase
- Only **4 files** import any Card primitive

**Competing implementations:**
1. `ui/Card.tsx` — Compound component (`Card` + `CardHeader` + `CardTitle` + `CardContent`), no animation
2. `ui/GlassCard.tsx` — Motion-animated, backdrop blur, variant-based, rounded-2xl
3. `dashboard/UnifiedDashboard/Card.tsx` — Motion-animated, default export, different props, rounded-xl

**Conflict:** `ui/Card.tsx` uses `rounded-xl` with `shadow-sm`. `GlassCard.tsx` uses `rounded-xl` with `backdrop-blur-sm`. `UnifiedDashboard/Card.tsx` also uses `rounded-xl` with `backdrop-blur-sm`. But they have different border handling, padding defaults, and animation behavior. A developer looking for "the" Card component finds three options with no guidance on which to use.

**User Impact:** Inconsistent card border-radius, padding, shadow depth, and hover behavior across features. Some cards animate on mount, others don't. The dashboard looks different from the library which looks different from drill screens.

---

### Finding 11-6: No Shared Modal Primitive — 29 Independent Implementations (HIGH)

**Files:** 8 in `components/modals/`, 19 scattered across feature directories, 2 drawer/sheet components

**Common reimplemented patterns across all 29 modals:**
1. **Backdrop overlay:** `fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-{md|sm|xl}`
2. **Escape key handling:** `useEffect` with `keydown` listener for Escape
3. **Focus trapping:** Some use `useFocusTrap`, others don't
4. **Animation:** Some use `motion.div` + `AnimatePresence`, others use CSS transitions
5. **Close button:** X icon in top-right, but with varying sizes and positions
6. **Scroll lock:** Some lock body scroll, others don't

**Inconsistencies found:**
- Backdrop blur varies: `backdrop-blur-md` (FlagQuestion), `backdrop-blur-sm` (Metacognition), `backdrop-blur-xl` (Wellness)
- Z-index: All use `z-50` (correct), but panels use varying z-indices
- Focus trapping: `FlagQuestionModal` and `SessionSetupModal` use `useFocusTrap`; `GoalEditModal`, `WellnessCheckModal`, `MetacognitionPromptModal` do not
- `ConditionDetailModal` uses a CSS class `.condition-modal-overlay` instead of Tailwind inline

**User Impact:** Keyboard users can Tab outside of modals that lack focus trapping. Screen readers may read content behind the modal. Varying blur intensity creates inconsistent visual hierarchy.

**Production Blocking:** No — core product flows use modals with focus trapping. But peripheral modals (Goals, Wellness) are accessibility-incomplete.

---

### Finding 11-7: No Shared Input/Form Primitive (HIGH)

**Files:** No `components/ui/Input.tsx` or `components/ui/TextInput.tsx` exists.

**Evidence:** `components/ui/SliderWithInput.tsx` contains a well-styled `<input>` element with proper CSS variables, focus ring, and accessibility. But there is no standalone `Input`, `TextInput`, `Select`, or `TextArea` primitive. Every form in the app builds its own input styling:
- Onboarding forms
- Settings panels
- Session setup modals
- Flag question modal (text area)
- Admin content editor

**Impact:** No consistent form field height, border radius, focus ring color, error state styling, or label positioning. Form accessibility (aria-invalid, aria-describedby for errors) must be implemented per-instance.

---

### Finding 11-8: `EmptyState` Action Button Bypasses `Button` Component (MEDIUM)

**File:** `components/ui/EmptyState.tsx:171-183`

```tsx
<button
  onClick={action.onClick}
  className={`
    px-4 py-2 rounded-lg font-medium transition-colors
    ${action.variant === 'secondary'
      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] ...'
      : 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90'}
  `}
>
  {action.label}
</button>
```

**Problem:** This is a raw `<button>` with manually duplicated button styling instead of using the `Button` component from the same `ui/` directory. It lacks `min-h-[44px]`, `focus-visible:ring-2`, and `disabled` styling that `Button` provides.

**Impact:** Every empty state with an action CTA has a button that doesn't match the design system's own button primitive. This is the design system contradicting itself.

---

## Section 3: Dark Mode & Theme Consistency

### Finding 11-9: ~367 Files Use `dark:` Prefix, Rest Rely on CSS Variables — Mixed Strategy (MEDIUM)

**Files:** `contexts/ThemeContext.tsx`, `index.css`, 367 TSX files with `dark:` prefix

**Architecture:** ThemeContext correctly toggles `.dark` class on the root element. CSS variables in `index.css` switch values based on this class. Tailwind config references these variables.

**Two competing dark mode strategies coexist:**
1. **CSS variables (preferred):** `bg-[var(--color-bg-secondary)]` — automatically adapts to theme
2. **Tailwind dark: prefix:** `bg-white dark:bg-slate-800` — requires explicit dark variant per class

**Problem:** When a component uses the `dark:` prefix strategy, it must remember to add a dark variant for every color class. When it doesn't (which happens frequently), it breaks in dark mode.

**Evidence of breakage:** 18+ files use `bg-white` or `bg-white/XX` without `dark:` variants. These render white backgrounds or white overlays that clash with dark mode's navy backgrounds.

---

### Finding 11-10: `bg-white/XX` Overlays Hardcoded in Drill/Mode Components (MEDIUM)

**Files:** `MetacognitionPromptModal.tsx`, `DiagnosticDrillHub.tsx`, `PatientEncounterMode.tsx`, `AntibioticMode.tsx`, `WakeTimeSettings.tsx`, and 13+ more

**Pattern:** Components with gradient hero sections or accent headers use `bg-white/20` as a semi-transparent overlay for contrast. In dark mode, white overlays on dark backgrounds create visible white patches.

**Examples:**
- `MetacognitionPromptModal.tsx:118` — `bg-white/20` on gradient header
- `PatientEncounterMode.tsx:3032` — `bg-white/20 backdrop-blur-sm` on hero
- `AntibioticMode.tsx:660` — `bg-white rounded-full` indicator dot

**Fix:** Replace `bg-white/20` with `bg-[var(--color-bg-primary)]/20` or add `dark:bg-black/20` variants.

---

## Section 4: Structural & Architectural Issues

### Finding 11-11: Competing `CardHeader` Exports Create Import Ambiguity (MEDIUM)

**Files:**
- `components/ui/Card.tsx` exports `CardHeader` — plain div with border-bottom separator
- `components/ui/GlassCard.tsx` exports `CardHeader` — icon + title + subtitle + badge component

**Problem:** Two completely different components share the same export name. An import like `import { CardHeader } from '@/components/ui/GlassCard'` gets a component with `icon`, `title`, `subtitle`, `badge` props. `import { CardHeader } from '@/components/ui/Card'` gets a plain wrapper div with `children` and `className`. Auto-import tools may choose the wrong one.

**Impact:** Developer confusion. A component expecting the icon-based `CardHeader` that accidentally imports from `Card.tsx` renders nothing useful (no icon, no title). TypeScript catches missing required props, but optional-only cases slip through.

---

### Finding 11-12: `xs` and `sm` Button Sizes Miss Touch Target Minimum (MEDIUM)

**File:** `components/ui/button.tsx:37-43`

```typescript
const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs',           // ~28px tall
  sm: 'px-3 py-1.5 text-sm',         // ~32px tall
  md: 'px-4 py-2 text-base min-h-[44px]',  // ✅ 44px
  lg: 'px-6 py-3 text-lg min-h-[44px]',    // ✅ 44px
  xl: 'px-8 py-4 text-xl min-h-[52px]',    // ✅ 52px
};
```

**Problem:** `xs` (~28px) and `sm` (~32px) sizes are below the WCAG 2.5.8 touch target minimum of 44x44px. The `md`, `lg`, and `xl` sizes correctly include `min-h-[44px]`.

**Impact:** On mobile devices, `xs` and `sm` buttons are difficult to tap accurately. If any critical flow (answer selection, navigation) uses these sizes, mobile UX degrades.

---

### Finding 11-13: No Consistent Loading/Error/Empty State Wiring Pattern (HIGH)

**Files:**
- `components/loading/index.tsx` — Exports `Loader`, `Skeleton`, `ClinicalSkeleton`, `StreamingSkeleton`, `DrillLoadingState`, etc.
- `components/ui/EmptyState.tsx` — Exports `EmptyState` with 7 variants and 5 factory presets
- `components/error/ErrorBoundary.tsx` — Exports variant-based error boundary

**The primitives are comprehensive. The problem is adoption pattern.**

**No standard three-state wrapper exists.** Every component that fetches data must independently implement:
```tsx
if (loading) return <Loader />;
if (error) return <ErrorState />;
if (data.length === 0) return <EmptyState variant="..." />;
return <ActualContent />;
```

**Evidence:** The loading/error/empty trio is reimplemented differently across features:
- Dashboard components use `ClinicalSkeleton` for loading
- Drill components use `DrillLoadingState`
- Library components use `Loader variant="spinner"`
- Some components show nothing during loading (flash of empty content)
- Some show console errors instead of error boundaries

**Impact:** Inconsistent loading UX. Some screens show skeletons (good), others show spinners (OK), others show nothing then pop in (jarring). A `DataView` or `AsyncContent` wrapper component would standardize the pattern.

---

### Finding 11-14: Icon Library Is Clean — Lucide-React Only (LOW — Positive Finding)

**Files:** All TSX files across the codebase

**Finding:** Every icon import in the production source tree comes from `lucide-react`. No `react-icons`, `@heroicons`, or custom icon sets were found. This is a positive finding — the codebase has already standardized its icon library.

**One minor note:** Some components import 10+ icons from lucide-react in a single file (e.g., `SystemBadge.tsx` imports 10 medical system icons). These could benefit from a barrel export in a `lib/icons/medicalIcons.ts` file to reduce import noise, but this is purely cosmetic.

---

### Finding 11-15: 656+ Inline Style Objects Across 118 Files (LOW)

**Files:** 118 of ~500 TSX files (23%) use `style={{...}}`

**Context:** The majority of inline styles are in SVG/chart contexts where Tailwind classes don't work (e.g., `stopColor`, `fill`, `stroke`, `strokeDasharray`). A smaller subset are genuinely avoidable — dynamic `width`, `height`, or `color` values that could use CSS variables instead.

**Impact:** Low. SVG inline styles are unavoidable. The non-SVG inline styles are a minor maintenance issue.

---

## Top 10 Findings (Ranked by Impact)

| Rank | ID | Severity | Finding | Blocks Prod? |
|------|----|----------|---------|--------------|
| 1 | 11-4 | CRITICAL | Button primitive has ~2% adoption — ~1,100 raw buttons miss focus rings and touch targets | Yes (a11y) |
| 2 | 11-6 | HIGH | No shared Modal primitive — 29 independent implementations, inconsistent focus trapping | No |
| 3 | 11-5 | HIGH | Card primitive has ~2% adoption — 193 inline card-style divs | No |
| 4 | 11-7 | HIGH | No Input/Form primitive exists — every form reinvents field styling | No |
| 5 | 11-13 | HIGH | No standard loading/error/empty wrapper — every data-fetching component reinvents the trio | No |
| 6 | 11-1 | MEDIUM | 45+ hardcoded hex colors bypass token system, break dark mode in charts | No |
| 7 | 11-9 | MEDIUM | Mixed `dark:` prefix vs CSS variable strategy — 367 files use both | No |
| 8 | 11-10 | MEDIUM | `bg-white/XX` overlays hardcoded in 18+ files, break dark mode | No |
| 9 | 11-8 | MEDIUM | EmptyState's own action button bypasses the Button primitive | No |
| 10 | 11-12 | MEDIUM | Button `xs`/`sm` sizes below 44px WCAG touch target | No |

---

## 3 Highest-Leverage Fixes

### Fix 1: Migrate Critical-Path Buttons to `Button` Primitive (2-3 hours)

**Not a full codebase migration** — focus on the main study session, drill shells, and dashboard first. These flows affect every user every session.

**Files to update first:**
- `components/session/QuizView.tsx` — Answer selection, next question, submit buttons
- `components/drill/DrillShell.tsx` — Start drill, back, complete buttons
- `components/navigation/CommandCenterHub.tsx` — All dashboard CTAs
- `components/ui/EmptyState.tsx` — Action button (replace raw `<button>` with `Button`)

**Change per button:** Replace `<button className="px-4 py-2 rounded-lg ...">` with `<Button variant="primary" size="md">`. This automatically adds `min-h-[44px]`, `focus-visible:ring-2`, `disabled:opacity-50`, and loading spinner support.

**Impact:** Fixes Finding 11-4 for the core product flows. Improves mobile tap accuracy and keyboard accessibility across the most-used screens.

### Fix 2: Create `BaseModal` Primitive (1-2 hours)

**File to create:** `components/ui/Modal.tsx`

**Encapsulate the common modal pattern:**
```tsx
<Modal isOpen={open} onClose={close} size="md" title="..." blur="md">
  {children}
</Modal>
```

**Internalizes:** Fixed overlay, backdrop blur, z-50, Escape key handler, focus trap (`useFocusTrap`), `AnimatePresence` animation, scroll lock, close button, accessible `role="dialog"` + `aria-modal`.

**Migration:** Existing modals can adopt incrementally — replace the outer `<div className="fixed inset-0 z-50 ...">` with `<Modal>` while keeping their inner content unchanged.

**Impact:** Fixes Finding 11-6. Every new modal automatically gets focus trapping and accessibility.

### Fix 3: Create Chart Color Token Map (30 min)

**File to create:** `lib/chartColors.ts`

**Map CSS variable names to resolved hex values** for chart/SVG contexts where CSS variables don't work:
```typescript
export function getChartColors(theme: 'light' | 'dark') {
  return {
    pass: theme === 'dark' ? '#14b8a6' : '#0a766c',
    fail: '#ef4444',
    provisional: '#f59e0b',
    neutral: theme === 'dark' ? '#94a3b8' : '#64748b',
    accent: theme === 'dark' ? '#a89b7a' : '#9a8f72',
  };
}
```

**Impact:** Fixes Finding 11-1 for chart/SVG contexts. Developers import `getChartColors(theme)` instead of hardcoding hex values. Charts respond to dark mode.

---

## "Standardize Next" — 10 Highest-Value Component Patterns to Unify

| Priority | Pattern | Current State | Unification Target |
|----------|---------|---------------|-------------------|
| 1 | **Button** | 1,100 raw, 5 using primitive | Migrate top 20 screens to `Button` primitive |
| 2 | **Modal/Dialog** | 29 independent impls | Create `BaseModal`, migrate 8 core modals |
| 3 | **Form Input** | No primitive exists | Create `Input`, `TextArea`, `Select` with consistent styling |
| 4 | **Card** | 3 competing + 193 inline | Deprecate `UnifiedDashboard/Card`, unify on `ui/Card` + `GlassCard` |
| 5 | **Data Loading Wrapper** | No standard trio | Create `AsyncContent<T>` wrapper (loading → error → empty → content) |
| 6 | **Chart Color Tokens** | 45+ hardcoded hex | Create `getChartColors(theme)` utility |
| 7 | **Panel/Drawer** | 27 independent impls | Create `SidePanel` with slide animation + escape |
| 8 | **Toast/Notification** | Using `lib/toast` | Verify consistent positioning, duration, and theming |
| 9 | **Stat/KPI Badge** | Reimplemented per dashboard card | Create `StatBadge` extracted from `GlassCard.CardStats` |
| 10 | **Section Header** | Only 1 `SectionHeader.tsx` exists but low adoption | Create `SectionHeader` with consistent spacing + icon |

---

## Recommended Implementation Plan (5 Days)

### Day 1: Button Primitive Migration — Critical Path
1. Add `min-h-[44px]` to `sm` button size (or document xs/sm as "inline-only, not for primary actions")
2. Fix `EmptyState.tsx` to use `Button` instead of raw `<button>`
3. Migrate `QuizView.tsx` answer/submit buttons to `Button`
4. Migrate `DrillShell.tsx` navigation buttons to `Button`
5. Migrate `CommandCenterHub.tsx` CTAs to `Button`

### Day 2: Modal Primitive
1. Create `components/ui/Modal.tsx` with overlay, focus trap, escape, animation
2. Migrate `FlagQuestionModal` to use `Modal` (highest-usage modal in study sessions)
3. Migrate `SessionSetupModal` to use `Modal`
4. Document pattern in component JSDoc

### Day 3: Form Input Primitive + Card Consolidation
1. Create `components/ui/Input.tsx` with consistent sizing, focus ring, error state, label
2. Create `components/ui/TextArea.tsx`
3. Deprecate `dashboard/UnifiedDashboard/Card.tsx` — replace its 3 imports with `ui/Card`
4. Rename `GlassCard`'s `CardHeader` to `GlassCardHeader` to resolve export collision (Finding 11-11)

### Day 4: Chart Colors + Dark Mode Fixes
1. Create `lib/chartColors.ts` theme-aware color map
2. Replace hardcoded hex in `TrendSparkline.tsx`, `DynamicScoringCalculator.tsx`, `ACLSRefCards.tsx`
3. Fix `bg-white/XX` overlays in top 10 offending files (replace with `bg-[var(--color-bg-primary)]/20`)
4. Verify dark mode renders correctly for main session and dashboard

### Day 5: AsyncContent Wrapper + Documentation
1. Create `components/ui/AsyncContent.tsx` — standardized loading/error/empty/content wrapper
2. Apply to 3 highest-traffic views (dashboard, library, drill setup)
3. Add JSDoc to all primitives with usage examples
4. Update CLAUDE.md with design system usage guidelines

---

## What to Audit Next

**Audit 12 — Dashboard Analytics & Visualization Correctness:** The dashboard consumes aggregate stats, Rolling 360 data, system mastery breakdowns, and FSRS retrievability to render charts and progress widgets. With the data integrity issues from Audits 9-10 and the chart color/theming issues from this audit, the dashboard may render stale, corrupted, or theme-broken visualizations. Verify that chart data flows are correct end-to-end and that the dashboard gracefully handles null/empty states from the broken UserProgress FK path.
