# Contrast Ratio Improvement Plan

## Audit Results Summary

Based on the contrast ratio audit conducted on 2026-02-11, the following issues were identified:

### Light Mode Issues (4 medium priority)
1. **Accent color on primary background** - 3.07:1 (needs 4.5:1)
   - Current: `#9a8f72` (gold) on `#F8FAFC` (slate-50)
   - Needs 1.43 improvement

2. **Pass/success color on primary background** - 3.58:1 (needs 4.5:1)
   - Current: `#0d9488` (teal-600) on `#F8FAFC` (slate-50)
   - Needs 0.92 improvement

3. **Visual category color on primary background** - 3.37:1 (needs 4.5:1)
   - Current: `#a67f7f` (Dusty Rose) on `#F8FAFC` (slate-50)
   - Needs 1.13 improvement

4. **Simulation category color on primary background** - 3.42:1 (needs 4.5:1)
   - Current: `#9a7f9a` (Deep Plum) on `#F8FAFC` (slate-50)
   - Needs 1.08 improvement

### Dark Mode Issues (1 medium priority)
5. **Accent button color on primary background** - 3.49:1 (needs 4.5:1)
   - Current: `#7B6C4F` (darker gold) on `#0f172a` (slate-900)
   - Needs 1.01 improvement

## Proposed Fixes

### 1. Light Mode Accent Color
**Current:** `#9a8f72` (gold) - Luminance: 0.33
**Target:** Minimum 4.5:1 contrast with `#F8FAFC` (luminance: 0.97)
**Calculation:** Need foreground luminance ≤ 0.21
**Proposed Fix:** Darken to `#7a6f52` (darker gold)
- Hex: `#7a6f52`
- Luminance: 0.20
- Contrast: 4.8:1 (passes AA)

### 2. Light Mode Pass/Success Color
**Current:** `#0d9488` (teal-600) - Luminance: 0.25
**Target:** Minimum 4.5:1 contrast with `#F8FAFC` (luminance: 0.97)
**Calculation:** Need foreground luminance ≤ 0.21
**Proposed Fix:** Darken to `#0a766c` (teal-700)
- Hex: `#0a766c`
- Luminance: 0.19
- Contrast: 5.1:1 (passes AA)

### 3. Light Mode Visual Category Color
**Current:** `#a67f7f` (Dusty Rose) - Luminance: 0.28
**Target:** Minimum 4.5:1 contrast with `#F8FAFC` (luminance: 0.97)
**Calculation:** Need foreground luminance ≤ 0.21
**Proposed Fix:** Darken to `#8c6666` (Dusty Rose 600)
- Hex: `#8c6666`
- Luminance: 0.20
- Contrast: 4.8:1 (passes AA)

### 4. Light Mode Simulation Category Color
**Current:** `#9a7f9a` (Deep Plum) - Luminance: 0.27
**Target:** Minimum 4.5:1 contrast with `#F8FAFC` (luminance: 0.97)
**Calculation:** Need foreground luminance ≤ 0.21
**Proposed Fix:** Darken to `#806680` (Deep Plum 600)
- Hex: `#806680`
- Luminance: 0.19
- Contrast: 5.1:1 (passes AA)

### 5. Dark Mode Accent Button Color
**Current:** `#7B6C4F` (darker gold) - Luminance: 0.20
**Target:** Minimum 4.5:1 contrast with `#0f172a` (luminance: 0.05)
**Calculation:** Need foreground luminance ≥ 0.23
**Proposed Fix:** Lighten to `#9a8f72` (use light mode gold)
- Hex: `#9a8f72`
- Luminance: 0.33
- Contrast: 6.5:1 (passes AA, nearly AAA)

## Implementation Plan

### Step 1: Update CSS Custom Properties
Update the following CSS custom properties in `index.css`:

#### Light Mode Updates:
```css
/* In light mode section (~line 378) */
--color-accent: #7a6f52; /* Was: #9a8f72 */
--color-data-pass: #0a766c; /* Was: #0d9488 */
--color-category-visual: #8c6666; /* Was: #a67f7f */
--color-category-simulation: #806680; /* Was: #9a7f9a */
```

#### Dark Mode Updates:
```css
/* In dark mode section (~line 543) */
--color-accent-button: #9a8f72; /* Was: #7B6C4F */
```

### Step 2: Update Tailwind Config
Update the corresponding colors in `tailwind.config.js`:

```javascript
// In colors section
'accent': '#7a6f52', // Updated gold
'data-pass': '#0a766c', // Updated teal
'category-visual': '#8c6666', // Updated Dusty Rose
'category-simulation': '#806680', // Updated Deep Plum
```

### Step 3: Test Changes
1. Run the contrast audit script again to verify fixes
2. Use the ContrastRatioAudit component in the app
3. Test with browser dev tools color contrast checker
4. Verify visual appearance doesn't break existing designs

### Step 4: Document Changes
1. Update design system documentation
2. Add contrast ratio requirements to style guide
3. Document the rationale for color changes

## Expected Results

After implementing these fixes:

1. **All color combinations will meet WCAG AA standards** (4.5:1 for normal text)
2. **No high priority issues** (all pass large text AA at 3:1)
3. **Improved readability** for users with visual impairments
4. **Better user experience** under various lighting conditions

## Verification Checklist

- [ ] Run contrast audit script and confirm 0 medium/high priority issues
- [ ] Test light mode with updated colors
- [ ] Test dark mode with updated colors
- [ ] Verify button hover states still work correctly
- [ ] Check category colors in their respective components
- [ ] Test semantic colors (pass/fail/warning) in data visualizations
- [ ] Document any visual changes that need design review

## Long-term Recommendations

1. **Implement automated contrast checking** in CI/CD pipeline
2. **Add contrast ratio testing** to component development workflow
3. **Create color palette generator** that ensures WCAG compliance
4. **Regularly audit color usage** as new features are added
5. **Consider AAA compliance** (7:1) for critical text elements

## Files to Modify

1. `index.css` - CSS custom properties
2. `tailwind.config.js` - Tailwind color definitions
3. `scripts/contrast-audit.ts` - Update test expectations
4. `docs/STYLE_GUIDE_BUTTONS.md` - Update color references
5. `components/shared/ContrastRatioAudit.tsx` - Update default color pairs

## Risk Assessment

**Low Risk:** These are subtle color adjustments that maintain the overall aesthetic while improving accessibility. The color families remain the same, just with better contrast.

**Testing Required:** 
- Visual regression testing
- User acceptance testing with accessibility tools
- Cross-browser color rendering checks

## Timeline

**Immediate:** Implement CSS and Tailwind changes (1 hour)
**Short-term:** Test and verify fixes (2 hours)
**Ongoing:** Monitor and maintain contrast compliance