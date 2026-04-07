# Quiz UI — Accessibility Checklist

Use this checklist when modifying any file in `components/session/` or `components/quiz/`.

## Keyboard Navigation
- [ ] Every interactive element is reachable via Tab
- [ ] Modals/dropdowns close on Escape and return focus to the trigger
- [ ] New question loads → focus moves to `#question-container`
- [ ] No keyboard traps — Tab cycles naturally through the page

## Focus States
- [ ] All buttons/links have a visible `focus:ring-*` or `focus:outline-*` indicator
- [ ] Focus indicators have ≥ 3:1 contrast against the background
- [ ] No `outline: none` without a replacement focus style

## Semantic Structure
- [ ] `<h1>` is "Question N" (in QuizToolbar) — one per page
- [ ] Feedback headings use `<h2>` (Alternate Explanation, Key Pearls, My Notes)
- [ ] `<main>` wraps the question + answer area; `<header>` wraps the toolbar
- [ ] Answer options live inside a `role="radiogroup"` with `aria-label`
- [ ] Each answer button has `role="radio"` + `aria-checked`

## ARIA
- [ ] Toggle buttons use `aria-pressed` (Flag, Stats, Normal Labs)
- [ ] Overflow menu trigger uses `aria-expanded` + `aria-haspopup="menu"`
- [ ] Overflow menu items use `role="menuitem"`
- [ ] Progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [ ] Decorative icons use `aria-hidden="true"`
- [ ] Loading spinners use `aria-hidden="true"` (SVG) + `role="status"` (text)

## Screen Reader Announcements
- [ ] Correctness result announced via `announceToScreenReader()` (assertive) on submit
- [ ] Dynamic content changes use `aria-live="polite"` (loading states, alternate explanations)
- [ ] Eliminated options include "(eliminated)" in `aria-label`
- [ ] Post-answer labels include "(correct answer)" / "(your incorrect answer)"

## Color & Contrast
- [ ] Correct/incorrect states don't rely solely on color — also use text, icons, or line-through
- [ ] Text contrast ≥ 4.5:1 (AA normal text) / ≥ 3:1 (AA large text / UI components)
- [ ] Eliminated state uses `opacity-50` + `line-through` (not color alone)
- [ ] Test in both light and dark themes

## Touch Targets
- [ ] All buttons ≥ 44×44px (`min-h-[44px] min-w-[44px]`)
- [ ] Elimination X has 44×44px hit area

## Testing Steps
1. **Tab through** the entire quiz flow: toolbar → question → options → submit → feedback → next
2. **Screen reader** (VoiceOver / NVDA): verify question, options, and result are announced
3. **Zoom to 200%**: confirm no content overflow or truncation
4. **Browser DevTools** Accessibility panel: check for missing roles/labels
5. **Forced-colors mode** (Windows High Contrast): verify all states remain distinguishable
