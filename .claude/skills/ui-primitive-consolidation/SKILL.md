---
name: ui-primitive-consolidation
description: "Identify and consolidate scattered UI patterns into reusable primitives in PANaCEa — buttons, cards, modals, badges, empty states, loading skeletons, clinical safety indicators, and chart wrappers. Use this skill whenever you notice duplicate UI patterns across components, inconsistent button styles, ad-hoc modal implementations, or scattered loading states — even if the user just says 'make the UI consistent' or 'we keep rebuilding the same card'. Also use when planning a design system expansion or auditing component reuse."
---

## Purpose

PANaCEa has 562 component files across 55 directories. Many domain-specific and screen-level components reinvent the same UI patterns (buttons, cards, modals, badges, loading states, charts) rather than composing reusable primitives. This skill audits component structure, extracts common patterns into `components/ui/` or `components/shared/`, and rewires consumers to use consolidated primitives — reducing code duplication, improving consistency, and simplifying maintenance.

## Primitive Categories to Audit

- **Buttons:** variants (primary, secondary, outline, ghost, danger), sizes (sm, md, lg), states (disabled, loading, icon-only)
- **Cards:** bordered, shadowed, interactive, striped, collapsible, stacked layouts
- **Modals/Dialogs:** confirmation, form submission, info disclosure, sizes (sm, md, lg, fullscreen)
- **Badges:** status (active, inactive, draft), clinical safety tiers (CRITICAL red, CLINICAL standard, STUDY accordion), priority colors
- **Empty States:** no data, error, loading, permission denied (icon + heading + description + CTA)
- **Loading Skeletons:** pulse animations, aspect ratios (text line, card, grid), streaming delays
- **Clinical Safety Indicators:** Tier 1 (red border), Tier 2 (standard), Tier 3 (accordion) — enforce via wrapper
- **Chart Wrappers:** SafeChart pattern for all recharts usage; consistent sizing, responsiveness, legend placement
- **Form Inputs:** text, select, checkbox, radio, textarea with validation states and help text
- **Tooltips:** positioned, delayed, keyboard-accessible overlays

## Current State

- **components/ui/:** likely contains base primitives (Button, Card, Modal, Badge) but may be incomplete or unused
- **components/shared/:** cross-cutting components; may duplicate ui/ primitives
- **Chart components:** SafeChart, CalibrationChart, TopicBarChart scattered; not all charts wrapped consistently
- **Badge patterns:** defined in panacea-style-system but ad-hoc usage in components
- **Loading states:** inline spinners, skeleton lines, Framer Motion transitions duplicated across drills, sessions, forms

## Consolidation Strategy

1. **Audit:** grep for duplicate UI code (Button, Card, Modal, loading, empty states, chart boilerplate)
2. **Extract:** copy common patterns into `components/ui/` with consistent prop interfaces
3. **Replace:** rewrite consumers to import consolidated primitives
4. **Verify:** visual regression test, accessibility check (a11y), responsive behavior

## Clinical Safety Standard

- **Tier 1 (CRITICAL):** Red left border, bold label, no collapse — e.g., "Guideline deviation detected"
- **Tier 2 (CLINICAL):** Standard border, collapsible, contextual help — e.g., dosing warnings
- **Tier 3 (STUDY):** Accordion-only, minimal visual weight — e.g., tips and tricks
- Create `components/ui/ClinicalSafetyIndicator.tsx` wrapping icon + message + tier styling

## Chart Wrapper Pattern

All `recharts` usage must wrap in `SafeChart` or similar:
- Consistent sizing, aspect ratio, margins
- Responsive breakpoints (mobile: 280px, tablet: 400px, desktop: 600px+)
- Legend positioning (bottom on mobile, right on desktop)
- Fallback for empty/error states
- Tooltip styling using design system colors

## Common Failure Modes

- Inconsistent button props (icon position, loading state API)
- Missing accessibility (role, aria-label, keyboard nav)
- Responsive Tailwind conflicts (overlapping breakpoints, margin/padding inconsistency)
- Chart height hardcoding instead of responsive containers
- Loading skeleton duration mismatch across drills/sessions
- Modal z-index conflicts with overlays

## Files to Inspect First

- `components/ui/` (baseline primitives)
- `components/shared/` (cross-cutting)
- `components/drill/DrillShell.tsx` (drill modal, loading, submission UI)
- `components/session/QuizView.tsx` (session buttons, card layout, loading)
- `components/charts/` (SafeChart, CalibrationChart, TopicBarChart)
- `components/wellness/` (cards, badges, empty states)
- `components/icons/` (icon usage in buttons, badges, indicators)

## Composes With

- **panacea-style-system:** Poppins/Inter/JetBrains Mono, three-tier hierarchy, badge colors, clinical tiers
- **react-refactor:** Component splitting, prop extraction, composition patterns
- **async-state-hardening:** Loading states, error boundaries, suspense boundaries for primitives
