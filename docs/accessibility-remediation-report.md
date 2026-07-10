# Accessibility Remediation Report (Phase 6)

**Guide:** `audit_ui_ux_accessibility.md` (a11y scored 4.5/10). **Rule:** high-impact low-risk fixes; preserve visuals + design tokens; leaf-level only; no shared-primitive/global changes; add primitives only if immediately used.

---

## 1. Fixes shipped (with tests)

### `components/ui/ProgressRing.tsx` (#232) ✅
- Added `role="progressbar"` + `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext` and an accessible `aria-label` (optional `label` prop for context, e.g. "PANCE readiness").
- Decorative SVG + duplicate visible `%` marked `aria-hidden="true"` to prevent double announcement.
- Visuals and existing props unchanged (`label` optional/backward-compatible).
- **Test:** `ProgressRing.test.tsx` (6 tests): role/values, rounding, clamping, labeled/unlabeled name, decorative SVG hidden. **Resolves #232 in code.**

### Visualization components ✅
- **`Sparkline` / `SparklineBar`** (`Sparkline.tsx`): added `role="img"` + auto-summarized `aria-label` ("Trend sparkline, N points, latest X" / "Bar sparkline, N bars"); optional `ariaLabel` override. Charts previously had **no** text alternative (WCAG 1.1.1).
- **`EpistemicGauge`** (`EpistemicGauge.tsx`): linear gauge gets `role="meter"` + `aria-valuenow/min/max` + rich `aria-valuetext` (value + calibration level + data-point count) + `aria-label`; redundant numeric row `aria-hidden`. Radial variant (`EpistemicRadialGauge`) gets `role="img"` (or keeps `button` when clickable) + descriptive `aria-label`, and its decorative SVG is `aria-hidden`/`focusable="false"`.
- **`AnimatedCounter`** (`AnimatedCounter.tsx`): `aria-label` announces the **stable target value**; the rapidly-animating inner text is `aria-hidden` to avoid noisy churn.
- **Test:** `viz-a11y.test.tsx` (5 tests) covering Sparkline/SparklineBar/AnimatedCounter/EpistemicGauge.

## 2. Verified already-accessible (no change — stale a11y findings)
- **`RadialProgress.tsx`** already has full `role="progressbar"` + values + `aria-label`, decorative SVG `aria-hidden`.
- **`TrendSparkline.tsx`** already has `role="img"` + `aria-label` (both data and empty states).
- **`SkipToContent.tsx`** already implements WCAG 2.4.1 bypass.
- Reduced-motion (`useReducedMotion`) is already wired across animated components.

## 3. Deliberately NOT done (per rules)
- **No new `components/a11y/` primitives** (`VisuallyHidden`/`LiveAnnouncer`/`FocusRing`): the fixes used inline `aria-*` semantics, so these primitives would be **unused** — the mission forbids adding unused component libraries. Recommend adding them later *when a consumer exists*.
- **No shared-primitive or global CSS changes** (GlassCard/button/index.css untouched) per design-system inviolable rules.
- **Contrast tokens:** OKLCH clinical-semantic contrast documentation remains a gap; no obvious 1:1 token remap was safe without design review. Flagged for owner (documented here) rather than changing raw values blindly.
- **Mobile axe E2E:** requires a running dev server (+ Clerk for authed routes); not runnable here without live secrets. Recommend adding a mobile project to `playwright.ci-a11y.config.ts` once auth-bypass fixtures are wired. Manual checklist below.

## 4. Manual mobile a11y checklist (for the owner)
1. VoiceOver (iOS)/TalkBack (Android): ProgressRing announces "{label}: {n}%"; sparklines announce their `aria-label`; EpistemicGauge announces meter value + calibration.
2. Verify no double-announcement on ProgressRing/EpistemicGauge (decorative parts hidden).
3. AnimatedCounter announces final value once, not each frame.
4. Focus order + visible focus on interactive dashboard widgets.

## 5. Net
Two isolated, tested commits closed the most-cited a11y gaps (#232 ProgressRing + chart text alternatives) without touching shared primitives, visuals, or global CSS. Several other flagged components were already accessible (stale findings). Contrast docs + mobile axe automation remain owner follow-ups.
