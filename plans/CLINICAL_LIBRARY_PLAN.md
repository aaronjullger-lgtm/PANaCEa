# Clinical Library UX Improvement Plan

**Date:** 2026-04-01
**Scope:** GenericReferenceView, referenceConfigs, ReferenceHub, HighYieldSummary, QuickRefHub
**Goal:** Transform the Clinical Library from a flat data browser into a high-legibility clinical reference with clear visual hierarchy, safety-aware rendering, and a bridge to active FSRS recall.

---

## Phase 1 Findings: UX Friction Points

### Critical (patient-safety adjacent)
- **Contraindications and warnings render identically to supplementary text.** In the detail view, "Absolute Contraindications" uses the same 11px uppercase gray label + 13px body text as "Mnemonics." A student scanning quickly could miss life-threatening information. Every clinical entity that has contraindications, emergency actions, red flags, or critical values needs visual escalation.

### High (study effectiveness)
- **No reading → recall bridge.** The GenericReferenceView is read-only. There is no contextual CTA to launch FSRS practice for the entity a student is currently reading. The Knowledge Base condition pages have a separate `PastMistakesSection`, but the 11-entity reference library has zero FSRS touchpoints. Students must manually navigate to a drill mode.
- **Study Panel buried at the bottom.** The `studyPanel()` helper renders Board Yield Facts, Clinical Pearls, Test Tips, Common Mistakes, and Mnemonics as the *last* section in every detail view. For PANCE prep, these are the highest-value sections and should be the first thing a student sees after the clinical description.

### Medium (cognitive load / legibility)
- **Flat visual hierarchy in detail views.** All 11 configs render detail sections with the same visual weight. An ECG detail with 15 sections (Rate, Rhythm, P Wave, PR Interval, QRS, ST Segment, T Wave, Diagnostic Criteria, Etiology, Symptoms, Acute Management, Medications, Mimics, + study panel) creates a wall of undifferentiated text with no visual grouping.
- **System-default typography.** GenericReferenceView specifies no `font-family`. The broader app loads Inter, Poppins, and Teko, but the library falls back to whatever the system provides. No typographic distinction between clinical data (ranges, dosages) and narrative text.

---

## 5 High-Impact Improvements

### Improvement 1: Safety-First Detail Section Hierarchy

**Problem:** Contraindications, emergency management, red flags, and critical values are visually indistinguishable from study tips and mnemonics.

**Solution:** Introduce three visual tiers for detail sections in the shared `referenceConfigs.tsx` helpers:

1. **Critical tier** (red-amber left border, subtle warning background):
   - Absolute/Relative Contraindications
   - Emergency Management / Acute Management
   - Red Flags / Red Flag Responses
   - Critical Values / Critical Actions
   - "When to Avoid" / "When NOT to Use"

2. **Clinical tier** (standard rendering, slightly larger text):
   - Description, Mechanism, Technique
   - Indications, Diagnostic Criteria
   - Presentation, Symptoms, Etiology

3. **Study tier** (already has the studyPanel wrapper — no change needed):
   - Board Yield Facts, Clinical Pearls, Test Tips, Common Mistakes, Mnemonics

**Implementation:**
- Add `detailSectionCritical()` helper alongside existing `detailSection()` in referenceConfigs.tsx
- Uses a 3px left border (`#ef4444` in light, `#f87171` in dark) + `var(--color-bg-secondary)` background + AlertTriangle micro-icon
- Update all 11 config `detailRenderer` functions to call `detailSectionCritical()` for safety-critical sections
- No text is hidden — this only *adds* visual emphasis

**Safety verification:** Audit all 11 configs to ensure no contraindication or emergency section is left unstyled.

**Files:** `components/library/referenceConfigs.tsx`

---

### Improvement 2: Promote Study Panel to "PANCE Focus" Accordion

**Problem:** The studyPanel is the last section in every detail view, requiring students to scroll past all clinical content to reach Board Yield Facts, Clinical Pearls, and Test Tips — the sections most directly relevant to PANCE preparation.

**Solution:** Restructure the detail layout into two zones:

1. **PANCE Focus zone** (top of detail, above clinical sections): An accordion group containing Board Yield Facts, Clinical Pearls, Test Tips, Common Mistakes, and Mnemonics. Starts **collapsed** to avoid overwhelming, but positioned first so it's immediately accessible. Uses the entity's `accentColor` as a left border and a distinctive label: "📚 PANCE Focus"

2. **Clinical Reference zone** (below): The existing clinical detail sections (Description, Technique, etc.) with the new tiered styling from Improvement 1.

**Implementation:**
- Modify `studyPanel()` to accept a `position: 'top' | 'bottom'` parameter (default: `'top'`)
- When position is `'top'`: renders as a collapsible accordion with ChevronRight toggle
- Each sub-section (Board Facts, Pearls, Tips, etc.) is independently collapsible
- The panel header shows a count badge: "5 pearls · 3 tips · 2 mistakes"
- Update all 11 detailRenderer functions to move studyPanel to the top

**Safety verification:** The clinical sections remain fully visible and unmodified in the Clinical Reference zone.

**Files:** `components/library/referenceConfigs.tsx`

---

### Improvement 3: "Practice This Topic" CTA — Bridge to FSRS

**Problem:** No reading → recall transition exists in the reference library. Students read a condition/entity and then must manually navigate to a drill mode.

**Solution:** Add a contextual "Practice This Topic" button inside GenericReferenceView's expanded detail panel. When clicked, it routes the student to the appropriate drill mode with the entity pre-filtered.

**Behavior:**
- Appears at the bottom of the expanded detail (after clinical content, before card closes)
- Routes to `/study?mode=smart-review&system={entity.system}&tag={entity.name}` (leveraging existing SmartReviewMode's query param filtering)
- Visual: High-contrast accent button with Zap icon, styled with the entity's `accentColor`
- Only renders when the config provides a `getDrillParams?.(item)` function (optional — configs can opt in)
- Initial rollout for: Procedures (by system), ECG (by category), Anatomy (by system), Physiology (by system), Findings (by system)

**Implementation:**
- Add optional `getDrillParams?: (item: T) => { system?: string; tag?: string } | null` to `ReferenceViewConfig`
- In GenericReferenceView, render the CTA inside the detail expansion when `getDrillParams` returns non-null
- Use `useNavigate()` from react-router-dom to route
- Add `getDrillParams` to 5 configs initially

**Safety verification:** This is additive — no existing content is moved or hidden.

**Files:** `components/library/GenericReferenceView.tsx`, `components/library/referenceConfigs.tsx`

---

### Improvement 4: Typography and Visual Polish

**Problem:** The library uses system-default fonts and uniform 13px body text throughout. Clinical data (lab ranges, dosages, percentages) is visually indistinguishable from narrative prose. The broader app's design system (Inter for body, Poppins for headings, JetBrains Mono for data) is not leveraged.

**Solution:** Apply the app's existing typography system to the library components:

1. **Headings** (entity name, section headers): `font-family: 'Poppins', system-ui, sans-serif` — matches the app's heading font
2. **Body text** (descriptions, clinical narrative): `font-family: 'Inter', system-ui, sans-serif` — the app's primary body font
3. **Clinical data** (lab ranges, dosages, percentages, sensitivity/specificity values): `font-family: 'JetBrains Mono', 'Fira Code', monospace` with `font-variant-numeric: tabular-nums` — aligns numbers for scanability

**Additional polish:**
- Detail section labels: Increase from 11px to 12px, add letter-spacing: 0.6px for improved readability
- Detail body text: Increase from 13px to 14px, line-height from 1.5 to 1.6 for dense medical text
- Card title: Align to 15px with `font-family: 'Poppins'` for visual distinction from body
- Add `color: var(--color-text-primary)` explicitly to all text (currently some rely on inheritance)

**Implementation:**
- Update `detailSection()`, `detailSectionCritical()`, `detailList()`, `badge()`, and `studyPanel()` helpers
- Update `cardRenderer` patterns in all 11 configs for title font
- Add clinical-data styling to diagnostic accuracy displays (Sensitivity, Specificity, LR values) and lab range displays

**Safety verification:** Larger text and explicit font choices only *improve* legibility. No truncation risk.

**Files:** `components/library/referenceConfigs.tsx`, `components/library/GenericReferenceView.tsx`

---

### Improvement 5: Grouped Detail Sections with Progressive Disclosure

**Problem:** Entity types with many detail sections (ECG: 15 sections, Procedures: 12 sections, Findings: 13 sections) create walls of text when expanded. Students cannot quickly locate the section they need.

**Solution:** Group related detail sections under collapsible section headers. Each group starts expanded, but the grouping provides:
- Visual whitespace between logical clusters
- A section title bar that serves as a navigation landmark
- The ability to collapse irrelevant groups to focus on what matters

**Grouping structure (per entity type):**

For ECG:
- **Waveform Analysis** → Rate, Rhythm, P Wave, PR Interval, QRS, ST, T Wave (the existing 2-col grid)
- **Clinical Context** → Pathognomonic, Diagnostic Criteria, Etiology, Symptoms
- **Management** → Acute Management, Medications, Mimics

For Procedures:
- **Preparation** → Description, Preparation, Equipment, Duration
- **Technique** → Technique, Positioning, Anatomic Landmarks
- **Safety** → Indications, Contraindications (abs + relative), Complications
- **Follow-Up** → Post-Procedure Care, Expected/Abnormal Findings

For all entities: The PANCE Focus accordion (Improvement 2) always comes first.

**Implementation:**
- Add `detailGroup()` helper that renders a collapsible group with a header bar
- Uses CSS-only expand/collapse via `details`/`summary` HTML elements (no JS state needed, works with print)
- Semantic `<details open>` means groups are expanded by default — progressive disclosure without hiding
- Update the 4 most complex configs first: ECG, Procedures, Findings, Anatomy
- Remaining 7 configs keep their existing flat layout (simpler entities don't need grouping)

**Safety verification:** All groups use `<details open>` — content is visible by default. Collapsing is user-initiated. Print media query forces all groups open.

**Files:** `components/library/referenceConfigs.tsx`

---

## Out of Scope (deferred)

- Full condition detail page redesign (SmartConditionView is 55KB and working)
- QuickRef card component redesign (recently upgraded with error states)
- ReferenceHub visual redesign (functional as-is)
- New entity types or data models
- Animation overhauls

## Implementation Order

1. **Improvement 4** (Typography) — foundational; all other improvements build on correct fonts
2. **Improvement 1** (Safety sections) — highest priority for medical accuracy
3. **Improvement 2** (PANCE Focus accordion) — highest study impact
4. **Improvement 5** (Grouped sections) — depends on Improvements 1 and 2 being in place
5. **Improvement 3** (Practice CTA) — additive feature, lowest risk

## Verification Plan

After implementation:
1. Transpile-check all modified files
2. Verify no `text-overflow: ellipsis` or `overflow: hidden` is applied to any clinical text
3. Verify all contraindication/warning sections use the critical tier styling
4. Test at 320px, 375px, 768px, and 1280px viewport widths
5. Verify dark mode rendering of all new color tokens
6. Verify print renders all `<details>` groups open
