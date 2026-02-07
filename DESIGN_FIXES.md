# Design Fixes (UX Polish)

Surface-level UI/UX fixes applied from the **UX Polish** flow: user simulation + Design Police (contrast, tap targets, spacing, cursors). All changes align with `.cursor/rules/ui-design-system.mdc` and WCAG 2.5.5 (44px tap targets).

---

## 1. Tap targets (44px minimum)

| File | Change |
|------|--------|
| `components/session/SrsFlashcardView.tsx` | Back (exit) button: added `min-h-[44px] min-w-[44px]` and `py-3`. |
| `components/session/SrsFlashcardView.tsx` | Header Back button: added `min-h-[44px] min-w-[44px]`, `inline-flex items-center justify-center`. |
| `components/session/SrsFlashcardView.tsx` | Flip card button (RotateCcw): added `min-h-[44px] min-w-[44px]`, `inline-flex items-center justify-center`. |
| `components/session/SrsFlashcardView.tsx` | Rating buttons (Again, Hard, Good, Easy): added `min-h-[44px] min-w-[44px]`, `py-3`. |
| `components/session/SrsFlashcardView.tsx` | “Next card” button: added `min-h-[44px]`, `py-3`. |
| `components/ui/PrimaryButton.tsx` | All sizes: added `min-h-[44px]` so sm/md/lg meet 44px height. |
| `components/ui/SemanticButton.tsx` | sm/md: added `min-h-[44px] min-w-[44px]`; lg/xl: added `min-h-[44px]`. sm padding adjusted to `py-2.5` for height. |

---

## 2. Cursors (pointer on interactive elements)

| File | Change |
|------|--------|
| `index.css` | Global rule for `button, a, [role="button"], [role="tab"], [role="link"]`: added `cursor: pointer`. |
| `components/session/SrsFlashcardView.tsx` | All buttons (Back, Flip, rating, Next card): added `cursor-pointer`. |
| `components/ui/PrimaryButton.tsx` | Base styles: added `cursor-pointer`. |
| `components/ui/SemanticButton.tsx` | Base class: added `cursor-pointer`. |

---

## 3. Spacing

No “padding: 0 with text” violations were reported by the Design Police on the audited pages. SRS flashcard view already uses `p-4` / `p-6` on containers; no changes made for spacing in this pass.

---

## 4. Contrast

No contrast violations (e.g. gray-300 on white) were reported on the landing/dashboard in the Design Police run. The app uses semantic tokens (`--color-text-primary`, `--color-text-muted`) per the design system; no contrast changes in this pass.

---

## 5. Test and automation

- **Playwright spec:** `e2e/ux_polish.spec.ts`
  - User journey: Dashboard (/) → Study → SRS Flashcards → Flip card → Rate (1–4) → Back.
  - Design Police runs on every page: contrast, tap target ≥44px, spacing (padding 0 + text), cursor pointer.
- **Run (no auth):** `npx playwright test ux_polish.spec.ts --project=ux-polish`
- **Run (with auth):** `npx playwright test ux_polish.spec.ts --project=chromium`

---

## 6. Mobile layout (320px — iPhone SE)

Layout breakage fixes from the **Mobile Layout Audit** (Playwright at 320px viewport). Targets: “The Squish” (awkward wrap, horizontal scroll, cramped flex, double headers).

### 6.1 Horizontal scroll

| File | Change |
|------|--------|
| `index.css` | `#root`: added `max-width: 100%`, `min-width: 0` so no child forces overflow. |
| `App.tsx` | `<main id="main-content">`: added `min-w-0 max-w-full overflow-x-hidden`. Inner content div: added `min-w-0 max-w-full`. |

### 6.2 Flex-row → flex-col on small screens

| File | Change |
|------|--------|
| `components/dashboard/RecommendationFeed.tsx` | Recommendation card row: `flex flex-row` → `flex flex-col sm:flex-row sm:items-center sm:justify-between`; content block: added `flex-1`. PrimaryButton: `w-auto` → `w-full sm:w-auto`. |

### 6.3 Responsive typography (text-2xl / text-3xl on mobile)

| File | Change |
|------|--------|
| `components/navigation/CommandCenter.tsx` | “Command Center” h1: `text-3xl sm:text-4xl` → `text-xl sm:text-3xl md:text-4xl`. Top recommendation h2: `text-2xl` → `text-xl sm:text-2xl` + `line-clamp-2`. Stats (SRS, streak, today, flagged): `text-3xl` → `text-xl sm:text-2xl md:text-3xl`. Grand Rounds h3: `text-2xl` → `text-xl sm:text-2xl`. Stat labels “Study Continuity”, “Today’s Questions”: added `truncate`, parent `min-w-0`, icon `flex-shrink-0`. |
| `components/navigation/CommandCenterHub.tsx` | Greeting h1: added `text-xl sm:text-2xl md:text-3xl`, `truncate max-w-full`. |
| `components/dashboard/DashboardPage.tsx` | Stat value: `text-2xl` → `text-xl sm:text-2xl`. Page title h1: added `text-xl sm:text-2xl md:text-3xl`, `truncate max-w-full`. |
| `components/analytics/UserFriendlyStatsDisplay.tsx` | Stat value and gauge score: `text-2xl` → `text-xl sm:text-2xl` (3 places). |

### 6.4 Truncate / line-clamp on long titles

| File | Change |
|------|--------|
| `components/navigation/CommandCenter.tsx` | Top recommendation title: added `line-clamp-2`. |
| `components/navigation/CommandCenterHub.tsx` | Greeting h1: added `truncate max-w-full`. |
| `components/dashboard/DashboardPage.tsx` | Page title h1: added `truncate max-w-full`. |

### 6.5 Mobile layout test

- **Playwright spec:** `e2e/mobile_layout_audit.spec.ts`
  - Viewport: 320×568 (iPhone SE).
  - Checks: horizontal scroll on `#root`/main/body, cramped flex-row (&lt;280px with ≥2 children), double headers (≥2 h1/h2 in top third).
- **Run:** `npx playwright test mobile_layout_audit.spec.ts --project=mobile-layout`

---

## 7. Aesthetic cleanup (visual noise)

Audit for "Visual Noise" — Grey Rule, Pop Rule, and consistency across Dashboard and Analytics.

### 7.1 Grey Rule — fewer borders, subtle backgrounds

| File | Change |
|------|--------|
| `DashboardPage.tsx` | QuickStat: removed `border`; use `bg-[var(--color-bg-secondary)]`; view tabs: `border` → `bg-[var(--color-bg-tertiary)]`; active tab: removed `border`; drill cards, Memory Health cards: `border` → `bg-[var(--color-bg-secondary)]`. |
| `WelcomeBackCard.tsx` | Removed `border`; use `bg-[var(--color-bg-secondary)]`. |
| `RecommendationFeed.tsx` | Cards: removed `border`; use `bg-[var(--color-bg-secondary)] shadow-sm`; icon container: removed gradient. |
| `ExamCountdownCard.tsx`, `EorCountdownCard.tsx`, `CircadianInsightCard.tsx` | Removed `border`; use `bg-[var(--color-bg-secondary)] shadow-sm`; urgency box: removed border. |
| `RetentionForecastCard.tsx` | Cards: removed `border`; use `bg-[var(--color-bg-secondary)]`; tooltip: removed border; pass callout: removed border. |
| `CurriculumGrid.tsx` | Removed main `border`; kept `border-l-4` for selected state. |
| `RecommendedActionCard.tsx` | Removed `border-2 border-accent`; use `bg-[var(--color-bg-secondary)] shadow-sm`; AI badge: removed border. |
| `AnalyticsDashboard.tsx` | Stats grid: `border-2` → `bg-[var(--color-bg-secondary)] shadow-sm`; calibration quadrant items: removed borders; speed boxes: `border` → `bg-[var(--color-bg-tertiary)]`. |
| `GlassCard.tsx` | Neutral variant: `border` → `border-0`; base shadow `shadow-md` → `shadow-sm`. |

### 7.2 Pop Rule — one primary CTA

| File | Change |
|------|--------|
| `RetentionForecastCard.tsx` | "Start Review" button: removed heavy gradient/shadow; use `bg-[var(--color-accent)]` and `rounded-lg shadow-sm`. |
| `RecommendedActionCard.tsx` | "Start Now" button: `rounded-xl shadow-sm` → `rounded-lg`; `hover:bg-accent-hover` → `hover:opacity-90`. |
| `WelcomeBackCard.tsx` | "Continue" button: simplified hover to `hover:opacity-90`. |

Only "Start Session" (CommandCenterHub hero CTA) remains the brightest primary action.

### 7.3 Consistency — border-radius and shadow

| Standard | Applied |
|----------|---------|
| **Cards** | `rounded-xl` (no `rounded-2xl`) |
| **Small elements** (icon containers, badges, buttons) | `rounded-lg` |
| **Shadow** | `shadow-sm` for cards; no `shadow-lg`/`shadow-xl` except hero/hover where needed |
| **GlassCard** | `rounded-2xl` → `rounded-xl`; `shadow-md` → `shadow-sm` |

---

## 8. Data polish (analytics & heatmaps)

Refactors for "Data Polish": 0-data neutral color, number formatting, empty components hidden.

### 8.1 PANCE readiness heatmap — 0 data = neutral "Not Yet Studied"

| File | Change |
|------|--------|
| `components/analytics/PANCEReadinessTreemap.tsx` | `getMasteryColor(pct, volume)`: when `volume === 0` return `var(--color-bg-tertiary)` (neutral) instead of red. Legend: added "Not Yet Studied" with gray-100 / bg-tertiary. Cell text for 0-data: `var(--color-text-muted)`. |
| `components/analytics/AnalyticsDashboard.tsx` | Treemap data: build from **all** systems in `bySystems` (not only `attempts > 0`) so 0-data systems appear as neutral blocks. Sort by volume (most studied first). |

### 8.2 Number formatting — no raw floats (e.g. 51.333333%)

| File | Change |
|------|--------|
| `lib/utils/textFormatting.ts` | Added `formatPercentForDisplay(value)`: returns integer `N%` or one decimal `N.N%`; `null`/`undefined`/NaN → `—`. |
| `components/analytics/AnalyticsDashboard.tsx` | Readiness score, overall accuracy, last7Days accuracy, Focus Area accuracy, trend delta, tooltip formatter, stability tooltip: use `formatPercentForDisplay`. Stability tooltip: `toFixed(2)` → `toFixed(1)`. |
| `components/analytics/UserFriendlyStatsDisplay.tsx` | Lifetime accuracy, trend value, recent accuracy: use `formatPercentForDisplay`. |

### 8.3 Empty components — hide Focus Area when no data

| File | Change |
|------|--------|
| `components/analytics/AnalyticsDashboard.tsx` | "Focus Areas - Highest Impact": filter `weakAreas` to `(area.attempts ?? 0) > 0`; if none left, do not render the section (hide entirely instead of showing "0%"). |

---

*Last updated: UX Polish; Mobile Layout Audit; Aesthetic Cleanup; Data Polish.*
