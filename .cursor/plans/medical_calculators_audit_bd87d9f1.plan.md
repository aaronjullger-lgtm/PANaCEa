---
name: Medical Calculators Audit
overview: "A prioritized technical execution plan to make the Medical Calculators feature fully functional, covering logic/wiring, partial features and polish, Stormy Slate design system alignment (including darker gold #7a6f52 for accents), and repository clean-up."
todos: []
isProject: false
---

# Medical Calculators – Deep Audit & Execution Plan

## Current State Summary

The Medical Calculators feature lives under [components/toolkit/calculators/](components/toolkit/calculators/). Entry points: [ToolkitHub.tsx](components/toolkit/ToolkitHub.tsx) (grid, search, pinned/recent) and [CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx) (system tabs, render). Registry: [calculatorRegistry.ts](components/toolkit/calculators/calculatorRegistry.ts). Shared UI: [shared/index.tsx](components/toolkit/calculators/shared/index.tsx).

**Implemented and wired:** CURB-65, CHA₂DS₂-VASc, Wells DVT, Wells PE, PERC, GFR (MDRD), Anion Gap, Osmolar Gap, Parkland. **Placeholder-named but functional:** Pediatric Dosing (full calculator), Clinical Guidelines (reference list, no calculations).

---

## 1. Logic & Wiring

### 1.1 Calculator logic status


| Calculator          | Logic status | Notes                                                     |
| ------------------- | ------------ | --------------------------------------------------------- |
| CURB-65             | Complete     | 0–5 score, low/moderate/high interpretation               |
| CHA₂DS₂-VASc        | Complete     | Age 65–74 vs ≥75 handled; annual stroke % shown           |
| Wells DVT           | Complete     | Includes “Alternative Diagnosis” −2                       |
| Wells PE            | Complete     | Decimal score (1.5 pts) and thresholds correct            |
| PERC                | Complete     | PERC negative = all 8 absent; recommendation text correct |
| GFR (MDRD)          | Complete     | MDRD with sex/race; no CKD-EPI                            |
| Anion Gap           | Complete     | Optional albumin correction; MUDPILES shown when AG >12   |
| Osmolar Gap         | Complete     | Calculated vs measured; gap interpretation                |
| Parkland            | Complete     | 4×kg×%TBSA; half first 8h, half next 16h                  |
| Pediatric Dosing    | Complete     | Weight-based, max cap, min weight warning                 |
| Clinical Guidelines | N/A          | Reference only; no scoring logic                          |


### 1.2 Wiring gaps and fixes

- **GFR empty state:** When age or creatinine is missing, no result is shown (correct) but there is no explicit “Enter values to see result” or validation message. **Files:** [GFRCalculator.tsx](components/toolkit/calculators/lab/GFRCalculator.tsx). **Step:** Add short helper text or inline validation when fields are empty so the UI state is clear.
- **Osmolar gap:** Result is only shown when measured osmolality is entered; calculated osmolarity is always shown. **Files:** [OsmolarGapCalculator.tsx](components/toolkit/calculators/lab/OsmolarGapCalculator.tsx). **Step:** When measured is empty, show calculated value and a line like “Enter measured osmolality to see osmolar gap and interpretation.” Optional: show “N/A” for gap with same message.
- **Pediatric Dosing:** No explicit validation for weight (e.g. 0 or blank). **Files:** [PediatricDosingPlaceholder.tsx](components/toolkit/calculators/dosing/PediatricDosingPlaceholder.tsx). **Step:** Treat empty or invalid weight as no calculation (already partially true); add a short “Enter weight in kg” when weight is empty to align with other calculators.
- **Intent → Calculator (protocol not implemented):** [docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md](docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md) specifies `lib/calculatorIntents.ts` and `getCalculatorIdsForIntent(query)` for Tutor/OSCE. **Files:** Create [lib/calculatorIntents.ts](lib/calculatorIntents.ts) (or equivalent under existing lib). **Step:** Implement a small function that maps query keywords to calculator IDs using the protocol’s table; wire into Tutor/OSCE search or suggestion UI when that feature is built. **Blocker note:** No immediate blocker if Tutor/OSCE does not yet surface calculators by intent; document as “required when contextual calculator surfacing is implemented.”

### 1.3 Architectural inconsistency

- **GitHub Spark vs in-app calculators:** [.github/copilot-instructions.md](.github/copilot-instructions.md) says “Do not hard-code scoring logic … use Clinical Logic Prompts in Spark.” The codebase currently uses hard-coded React calculators. **Options:** (A) Keep current React calculators as primary, and update copilot/docs to say “In-app calculators are implemented in React; Spark/embed is optional/future,” or (B) Implement Spark path and registry fields (`sparkAppUrl`, `sparkPromptRef`) per protocol. **Recommendation:** Treat (A) as the default; add a short “Current implementation” vs “Future Spark integration” section in [GITHUB_SPARK_CALCULATOR_PROTOCOL.md](docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md) and adjust copilot instructions so they do not contradict the shipped feature.

---

## 2. Partially Coded Features & Polish

### 2.1 CheckboxCriteria – negative points display

- **Issue:** [shared/index.tsx](components/toolkit/calculators/shared/index.tsx) always shows `+{item.points}`. Wells DVT “Alternative Diagnosis” has `points: -2`, so it renders “+-2”.
- **Step:** In `CheckboxCriteria`, format points as: if `points < 0` show `{points}` (e.g. “-2”), else show `+{points}`. **File:** [components/toolkit/calculators/shared/index.tsx](components/toolkit/calculators/shared/index.tsx).

### 2.2 ResultDisplay – semantic risk colors

- **Issue:** ResultDisplay uses Tailwind classes `bg-data-pass`, `border-data-pass`, `text-data-pass`, etc. [tailwind.config.js](tailwind.config.js) defines `data.pass` / `data.fail` / `data.provisional` as teal/red/amber. [index.css](index.css) defines `--color-data-pass`, `--color-data-fail`, `--color-data-provisional` as slate variants. Two sources of truth; Stormy Slate prefers semantic tokens.
- **Step:** Use one source for calculator risk colors. Either (1) define Tailwind theme colors from CSS variables (e.g. `'data-pass': 'var(--color-data-pass)'`) and keep using `bg-data-pass` etc., or (2) replace with utility classes that use the variables (e.g. `bg-[var(--color-data-pass)]`). Prefer (1) so existing class names stay. **Files:** [tailwind.config.js](tailwind.config.js), [components/toolkit/calculators/shared/index.tsx](components/toolkit/calculators/shared/index.tsx). Ensure [index.css](index.css) light/dark values match intended Stormy Slate palette.

### 2.3 Anion Gap – typo and optional “corrected” label

- **Typo:** “hypermag nesemia” → “hypermagnesemia”. **File:** [AnionGapCalculator.tsx](components/toolkit/calculators/lab/AnionGapCalculator.tsx) (recommendation string).
- **Polish:** When albumin is entered and corrected AG differs from uncorrected, the line “Albumin-corrected: Uncorrected AG = X, Corrected AG = Y” is clear; consider adding a one-line note that interpretation is based on corrected AG when available. **File:** [AnionGapCalculator.tsx](components/toolkit/calculators/lab/AnionGapCalculator.tsx).

### 2.4 GFR – CKD-EPI and formula note

- **Partial:** Details say “Consider CKD-EPI equation for improved accuracy.” CKD-EPI is not implemented.
- **Step:** Either add an optional CKD-EPI toggle and formula (and show both MDRD and CKD-EPI when toggled), or change the copy to “MDRD only; CKD-EPI may be added in a future update.” **File:** [GFRCalculator.tsx](components/toolkit/calculators/lab/GFRCalculator.tsx).

### 2.5 Pediatric Dosing – naming and exports

- **Naming:** Component is fully functional but still named `PediatricDosingPlaceholder`; docs ([FEATURE_COMPLETION_SUMMARY.md](docs/FEATURE_COMPLETION_SUMMARY.md), [TESTING_GUIDE_COMPLETED_FEATURES.md](docs/TESTING_GUIDE_COMPLETED_FEATURES.md)) say “Fully Implemented.”
- **Step:** Rename to `PediatricDosingCalculator` (file and export); update [CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx) import and switch. Optionally rename `ClinicalGuidelinesPlaceholder` to `ClinicalGuidelinesReference` and update imports. **Files:** [PediatricDosingPlaceholder.tsx](components/toolkit/calculators/dosing/PediatricDosingPlaceholder.tsx), [ClinicalGuidelinesPlaceholder.tsx](components/toolkit/calculators/guidelines/ClinicalGuidelinesPlaceholder.tsx), [CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx).
- **Exports:** [calculators/index.ts](components/toolkit/calculators/index.ts) exports risk, diagnosis, lab but not dosing or guidelines. **Step:** Add `export * from './dosing'` and `export * from './guidelines'` (after adding index barrels in those folders if desired), or export the two components from the main index.

### 2.6 Recall mode / Board Alert (documented, not implemented)

- **Protocol:** [GITHUB_SPARK_CALCULATOR_PROTOCOL.md](docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md) §7 describes recall mode: hide point values; student enters weights per criterion; validate and give feedback.
- **Current:** No calculator accepts `recallMode` or `boardAlertMode`; all show point values.
- **Step:** Add optional `recallMode?: boolean` to [types.ts](components/toolkit/calculators/types.ts) `CalculatorProps`. In [shared/index.tsx](components/toolkit/calculators/shared/index.tsx), when `recallMode` is true, `CheckboxCriteria` can hide the points badge and show a small “Points: [dropdown/input]” per criterion; parent calculators pass through the prop and validate submitted points vs correct score. Implement for at least one calculator (e.g. Wells PE) as a pilot, then expand. **Files:** [types.ts](components/toolkit/calculators/types.ts), [shared/index.tsx](components/toolkit/calculators/shared/index.tsx), [WellsPECalculator.tsx](components/toolkit/calculators/risk/WellsPECalculator.tsx) (and others if rolled out).

### 2.7 CalculatorHub – Wind icon

- **Check:** [calculatorRegistry.ts](components/toolkit/calculators/calculatorRegistry.ts) imports `Wind` and uses it in `CALCULATOR_CATEGORIES` for the pulmonary tab. CalculatorHub uses `tab.icon` from that registry, so Wind is used correctly. No change needed unless a linter reports a missing import (e.g. tree-shaking); then ensure Wind is re-exported or used from registry.

---

## 3. Design System (Stormy Slate & darker gold #7a6f52)

### 3.1 Accent token conflict

- **index.css:** `--color-accent` is slate (e.g. light `#64748b`, dark `#94a3b8`) for “Stormy Slate.”
- **tailwind.config.js:** The `.exam-mode` utility sets `--color-accent: '#7a6f52'` (darker gold). So gold is only applied in exam mode, not globally.
- **User ask:** “Darker gold (#7a6f52) correctly applied for accents and interactive inputs” in calculators.

**Steps:**

1. **Decide product stance:** Either (A) Stormy Slate = slate accents everywhere (current index.css), or (B) Calculators (and optionally other areas) use gold accents. If (B), introduce a scoped token (e.g. `--color-accent-calculator`) or use a wrapper class that sets accent for calculator views only, so the rest of the app stays slate.
2. **Apply in calculator UI:**
  - If gold for calculators: In the calculator layout (e.g. CalculatorHub and/or a wrapper), set `--color-accent: #7a6f52` and `--color-accent-hover: #6a5f42` (or use the existing exam-mode values) so that focus rings, borders, and interactive inputs in calculators use gold. **Files:** [CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx), optionally [index.css](index.css) (e.g. `.calculator-view { --color-accent: #7a6f52; }`).  
  - Ensure [shared/index.tsx](components/toolkit/calculators/shared/index.tsx) uses `var(--color-accent)` (it already does for focus and borders); no hardcoded hex in calculator components.
3. **Consistency:** Buttons and links inside calculators should use the same token (e.g. “Back”, “Clear filters”) so they pick up the chosen accent.

### 3.2 Semantic tokens checklist (calculators)

- **Already using:** `var(--color-bg-primary)`, `var(--color-bg-secondary)`, `var(--color-bg-tertiary)`, `var(--color-border)`, `var(--color-text-primary)`, `var(--color-text-muted)`, `var(--color-text-secondary)`, `var(--color-accent)` in [CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx), [shared/index.tsx](components/toolkit/calculators/shared/index.tsx), and individual calculators.
- **Verify:** No raw hex or non-semantic Tailwind colors (e.g. `bg-gray-900`, `text-black`) in [components/toolkit/calculators/](components/toolkit/calculators/). Replace any with semantic tokens.
- **Risk colors:** See §2.2; align `data-pass` / `data-fail` / `data-provisional` with Stormy Slate semantic colors (e.g. from index.css) so that pass/provisional/fail in calculators match the design system.

### 3.3 Touch targets and accessibility

- **Rule:** Primary controls ≥44×44px. **Files:** [shared/index.tsx](components/toolkit/calculators/shared/index.tsx) (checkbox labels, inputs), [CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx) (tab buttons, grid cards). Ensure padding/min-height meets 44px where required; add `min-h-[44px]` or equivalent for key buttons/checkboxes.

---

## 4. Repository Clean-up

### 4.1 Redundant or misleading files

- **None identified:** No duplicate calculator components or obsolete copies under a different path. Placeholders are the actual implementations; renaming is in §2.5.

### 4.2 Unused calculator logic

- **None:** All registered calculators are rendered in CalculatorHub; no orphaned calculator files. Any “unused” logic is the unimplemented Spark/Intent/recall path, which is documented rather than dead code.

### 4.3 Documentation updates

- **[docs/FEATURE_COMPLETION_SUMMARY.md](docs/FEATURE_COMPLETION_SUMMARY.md):** States Pediatric Dosing and Clinical Guidelines are “Fully Implemented.” After renaming (§2.5), add a one-line note that the components were renamed from “Placeholder” to “Calculator” / “Reference.”
- **[docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md](docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md):** Add a “Current implementation” subsection stating that in-app calculators are implemented in React with hard-coded logic; Spark embed and `lib/calculatorIntents.ts` are optional/future. Reduces confusion and aligns with copilot-instructions update (§1.3).
- **[.github/copilot-instructions.md](.github/copilot-instructions.md):** Revise the medical calculators bullet to: “Medical calculators: In-app calculators (CURB-65, Wells, CHA₂DS₂-VASc, PERC, GFR, etc.) are implemented in React in `components/toolkit/calculators/`. Optional: GitHub Spark and recall mode per `docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md`.” Removes the “do not hard-code” instruction that conflicts with the current codebase.
- **[docs/TESTING_GUIDE_COMPLETED_FEATURES.md](docs/TESTING_GUIDE_COMPLETED_FEATURES.md):** No structural change; paths and test steps remain valid after renaming.

### 4.4 Optional: Stormy Slate SOP

- **[sops/product-ux/stormy-slate-design-system-spec.md](sops/product-ux/stormy-slate-design-system-spec.md):** Currently a placeholder. Filling it with the canonical palette (including when/where to use #7a6f52) would help future calculator and app-wide UI work; not a blocker for calculator completion.

---

## 5. Prioritized Execution Order


| Priority | Item                                                                                                                       | Files                                                                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | Fix CheckboxCriteria negative points display                                                                               | [shared/index.tsx](components/toolkit/calculators/shared/index.tsx)                                                                                                                                                      |
| P0       | Fix Anion Gap typo “hypermag nesemia”                                                                                      | [AnionGapCalculator.tsx](components/toolkit/calculators/lab/AnionGapCalculator.tsx)                                                                                                                                      |
| P1       | Align accent for calculators with #7a6f52 (scope + CSS)                                                                    | [CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx), [index.css](index.css)                                                                                                                            |
| P1       | Align ResultDisplay risk colors with semantic tokens                                                                       | [tailwind.config.js](tailwind.config.js), [index.css](index.css), [shared/index.tsx](components/toolkit/calculators/shared/index.tsx)                                                                                    |
| P1       | Rename PediatricDosingPlaceholder → PediatricDosingCalculator, ClinicalGuidelinesPlaceholder → ClinicalGuidelinesReference | Dosing + Guidelines components, [CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx)                                                                                                                    |
| P1       | Export dosing and guidelines from calculators index                                                                        | [calculators/index.ts](components/toolkit/calculators/index.ts), optional index in dosing/ and guidelines/                                                                                                               |
| P2       | GFR empty-state helper text                                                                                                | [GFRCalculator.tsx](components/toolkit/calculators/lab/GFRCalculator.tsx)                                                                                                                                                |
| P2       | Osmolar gap “Enter measured osmolality” when missing                                                                       | [OsmolarGapCalculator.tsx](components/toolkit/calculators/lab/OsmolarGapCalculator.tsx)                                                                                                                                  |
| P2       | Pediatric Dosing empty weight message                                                                                      | [PediatricDosingPlaceholder.tsx](components/toolkit/calculators/dosing/PediatricDosingPlaceholder.tsx) (or renamed file)                                                                                                 |
| P2       | GFR: CKD-EPI toggle or copy update                                                                                         | [GFRCalculator.tsx](components/toolkit/calculators/lab/GFRCalculator.tsx)                                                                                                                                                |
| P2       | Documentation: Spark/copilot and “Current implementation”                                                                  | [GITHUB_SPARK_CALCULATOR_PROTOCOL.md](docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md), [.github/copilot-instructions.md](.github/copilot-instructions.md), [FEATURE_COMPLETION_SUMMARY.md](docs/FEATURE_COMPLETION_SUMMARY.md) |
| P3       | Create lib/calculatorIntents.ts when Tutor/OSCE surfacing is built                                                         | New file, then integration in Tutor/OSCE                                                                                                                                                                                 |
| P3       | Recall mode (recallMode prop + CheckboxCriteria + one pilot calculator)                                                    | [types.ts](components/toolkit/calculators/types.ts), [shared/index.tsx](components/toolkit/calculators/shared/index.tsx), [WellsPECalculator.tsx](components/toolkit/calculators/risk/WellsPECalculator.tsx)             |
| P3       | Touch target audit (44px) for calculator controls                                                                          | [shared/index.tsx](components/toolkit/calculators/shared/index.tsx), [CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx)                                                                               |


---

## 6. Blockers & Technical Debt

- **Blocker (product):** Accent color: Slate vs gold (#7a6f52) for calculators must be decided; then implementation is straightforward (§3.1).
- **Technical debt:** Spark/Intent/recall path is specified in docs but not implemented; in-app calculators are the source of truth. Updating docs and copilot instructions removes the “don’t hard-code” conflict and clarifies current vs future architecture.
- **No blocking code bugs:** All 11 calculators compute and display results; the main gaps are display polish (negative points), naming, exports, design tokens, and optional features (CKD-EPI, recall mode, intent map).

---

## 7. File-Level Summary

**Modify:**  
[components/toolkit/calculators/shared/index.tsx](components/toolkit/calculators/shared/index.tsx) (negative points, optional recallMode UI, risk colors if not using theme), [components/toolkit/calculators/lab/AnionGapCalculator.tsx](components/toolkit/calculators/lab/AnionGapCalculator.tsx), [components/toolkit/calculators/lab/GFRCalculator.tsx](components/toolkit/calculators/lab/GFRCalculator.tsx), [components/toolkit/calculators/lab/OsmolarGapCalculator.tsx](components/toolkit/calculators/lab/OsmolarGapCalculator.tsx), [components/toolkit/calculators/CalculatorHub.tsx](components/toolkit/calculators/CalculatorHub.tsx), [components/toolkit/calculators/dosing/PediatricDosingPlaceholder.tsx](components/toolkit/calculators/dosing/PediatricDosingPlaceholder.tsx) (and rename), [components/toolkit/calculators/guidelines/ClinicalGuidelinesPlaceholder.tsx](components/toolkit/calculators/guidelines/ClinicalGuidelinesPlaceholder.tsx) (and rename), [components/toolkit/calculators/index.ts](components/toolkit/calculators/index.ts), [components/toolkit/calculators/types.ts](components/toolkit/calculators/types.ts) (recallMode), [index.css](index.css), [tailwind.config.js](tailwind.config.js), [.github/copilot-instructions.md](.github/copilot-instructions.md), [docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md](docs/GITHUB_SPARK_CALCULATOR_PROTOCOL.md), [docs/FEATURE_COMPLETION_SUMMARY.md](docs/FEATURE_COMPLETION_SUMMARY.md).

**Create (optional / later):**  
[lib/calculatorIntents.ts](lib/calculatorIntents.ts), [components/toolkit/calculators/dosing/index.ts](components/toolkit/calculators/dosing/index.ts), [components/toolkit/calculators/guidelines/index.ts](components/toolkit/calculators/guidelines/index.ts).

**Delete:**  
None.