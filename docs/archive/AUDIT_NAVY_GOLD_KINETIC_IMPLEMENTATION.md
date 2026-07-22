# Audit: Navy/Gold Rebrand & Kinetic Polish Implementation

**Date:** 2025-02-03  
**Scope:** Navy/White/Gold rebrand, Premium Polish & Motion, Magnetic Curriculum Grid, Liquid NavRail

---

## Critical Fixes

### 1. NavRail Route/View Mismatch (High)
**Location:** `components/layout/NavRail.tsx`, `App.tsx`

**Issue:** NavRail uses `Link` with `href` values (`/study`, `/study?tab=resources`, `/study?tab=analytics`, `/study/toolkit`), but the App uses **view state** for content switching, not URL-driven routing.

- **Calculators** links to `/study/toolkit`. The view state never changes to `toolkit`; user stays on `command_center`. Result: NavRail highlights "Calculators" but main content still shows the dashboard.
- **Reference** and **Progress** use `?tab=resources` and `?tab=analytics`. `location.pathname` does **not** include the query string, so `isActive` is always false for these items. They never show as active.
- App's `useEffect` only syncs `pathname === '/'` and `pathname === '/menu'` to view. No handling for `/study` or tab query params.

**Fix:** Either:
- **Option A:** Make NavRail use programmatic navigation (e.g., pass `onNavigate` callbacks from App, use `onClick` + `navigate()` + `setView()` instead of `Link`), or
- **Option B:** Add URL-to-view sync in App: `/study` → `command_center`; `/study?tab=resources` → set activeTab in CommandCenterHub (requires lifting tab state or using `useSearchParams`); `/study/toolkit` → `setView('toolkit')`.

### 2. NavRail `isActive` Logic for Query Params (Medium)
**Location:** `components/layout/NavRail.tsx:95-98`

```ts
const isActive = item.href &&
  (location.pathname === item.href ||
    (item.href !== '/study' && location.pathname.startsWith(item.href)));
```

`location.pathname` does not include `?tab=resources`. So `item.href === '/study?tab=resources'` will never equal `location.pathname`. Use `location.pathname + location.search` or `useMatch`/`useLocation` with full path for tab-based items.

---

## Logical Omissions

### 1. CurriculumGrid `isLoading` Never Passed
**Location:** `components/navigation/CommandCenterHub.tsx`

`CurriculumGrid` has an `isLoading` prop, but CommandCenterHub never passes it. The skeleton loading state is never shown. If curriculum data were ever async, this would be a gap.

**Recommendation:** Pass `isLoading={false}` explicitly for now, or wire to a future loading state when curriculum is fetched.

### 2. CurriculumGrid `progressData` Never Passed
**Location:** `components/navigation/CommandCenterHub.tsx`

The `progressData` prop exists for per-system mastery bars. It is never passed. Progress bars in the curriculum grid are never rendered.

**Recommendation:** Derive `progressData` from `performanceData` (e.g., accuracy per system) and pass it when the product wants to show mastery in the curriculum grid.

### 3. Current Rotation Section Animation Inconsistency
**Location:** `components/navigation/CommandCenterHub.tsx:985-988`

The Current Rotation section uses `initial={{ opacity: 0, y: 4 }}` and `animate={{ opacity: 1, y: 0 }}` instead of `sectionEnter` / `sectionAnimate` / `sectionTransition`. Inconsistent with other dashboard sections.

### 4. `.footer-glass` Utility Unused
**Location:** `index.css:75-92`

The `.footer-glass` class is defined but footers use inline Tailwind classes. Glass footer styling is duplicated in MiniDrillLayout, PhotoDrillSession, RapidRecallDrill, MenuView.

---

## Technical Debt

### 1. Hardcoded Hex Values (49 occurrences)
**Files:** `NavRail.tsx`, `CurriculumGrid.tsx`, `designVariants.ts`, `button.tsx`, `App.tsx`, `Sidebar.tsx`, etc.

`#B09B73` (Gold) and `#0F172A` (Navy) are repeated across many files. Theme changes require scattered edits.

**Recommendation:** Use CSS variables (`--color-accent`, `--color-navy`) or Tailwind config tokens. Already partially done in `index.css`; extend to components.

### 2. Skeleton vs SkeletonLoader
**Location:** `components/ui/Skeleton.tsx`, `components/ui/SkeletonLoader.tsx`

Two overlapping components. CurriculumGrid uses `SkeletonLoader`; the new `Skeleton` supports an optional shimmer. Consider consolidating or documenting when to use each.

### 3. UI Design System Rules Out of Date
**Location:** `.cursor/rules/ui-design-system.mdc`

Rules mention "Reserve solid blue for main page CTA" and "Brand Blue." The app now uses Muted Gold for primary actions. Update rules to match the Navy/Gold theme.

### 4. `layoutId` Uniqueness
**Location:** `NavRail.tsx:135` (layoutId="active-nav-pill")

`layoutId` must be unique per shared-layout animation context. `Sidebar.tsx` uses `layoutId="activeNav"`. If both NavRail and Sidebar are ever visible together, there could be animation conflicts. Currently they appear mutually exclusive; document or enforce this.

---

## Plan Fidelity Check

| Plan Item | Status | Notes |
|-----------|--------|-------|
| Navy/White/Gold palette | Done | CSS vars and components updated |
| Sidebar Deep Navy + Gold active | Done | NavRail and Sidebar updated |
| Button visual haptics (scale, hover) | Done | PrimaryButton, button.tsx, CSS |
| Glassmorphism footer | Done | Applied to drill footers, MenuView |
| Staggered dashboard entry | Done | CommandCenterHub sections |
| Curriculum grid minimalist + Gold left strip | Done | CurriculumGrid component |
| Magnetic grid physics | Done | Spring animations, hover lift |
| Liquid NavRail (layoutId pill) | Done | layoutId="active-nav-pill" |
| Skeleton with shimmer | Done | `Skeleton.tsx` created |
| progressData in grid | Partial | Prop exists, never wired |
| NavRail tab/route sync | Gap | Reference/Progress/Calculators broken |

---

## Verification Steps

1. **NavRail navigation**
   - Click Dashboard, Start Session, Reference, Progress, Calculators.
   - Confirm active state highlights correctly and content matches.

2. **Curriculum grid**
   - Toggle systems on/off.
   - Confirm hover lift and tap scale.
   - Enable reduced motion and confirm animations are suppressed.

3. **Theme**
   - Toggle light/dark mode; confirm contrast and palette consistency.

4. **Footer**
   - Open a drill (e.g., Rapid Recall, Photo Drill).
   - Confirm footer has frosted glass (backdrop-blur) and sits at bottom.

5. **Direct URL**
   - Navigate directly to `/study`, `/study?tab=resources`, `/study/toolkit`.
   - Confirm correct view and tab.

6. **Build & lint**
   ```bash
   npm run build
   npm run lint
   ```
