# UI Refactoring Plan: Dashboard Consistency

## Phase 1: The Design System (Button Logic)
- [ ] **Task:** Audit `Button.tsx`. Ensure distinct variants exist for `primary` (Blue), `warning` (Orange), and `secondary` (Outline/Ghost).
- [ ] **Task:** Remove hardcoded "glow" or shadow effects from individual card buttons (OSCE/PANCE) to flatten the design.
- [ ] **Task:** Standardize button heights to `h-10` or `h-9` across all dashboard cards.

## Phase 2: Component Refactoring
- [ ] **Task:** Refactor `SmartRecommendationCard`.
    -   Move actions (Start/X/Check) to the right side.
    -   Stop the "Start" button from expanding to full width.
- [ ] **Task:** Refactor `GrandRoundsCard`, `PanceSimulationCard`, and `OsceCard`.
    -   Create a shared layout wrapper (e.g., `<DashboardCardLayout>`) to ensure padding and alignment are identical for all three.
- [ ] **Task:** Refactor Navigation Tabs.
    -   Convert the floating chips into a proper sticky Tab Bar with a bottom border.

## Phase 3: Dark Mode Polish
- [ ] **Task:** Adjust background colors. Ensure cards use a slightly lighter surface token (`bg-[var(--color-bg-secondary)]`) than the main background (`bg-[var(--color-bg-primary)]`).
- [ ] **Task:** Verify text contrast on the "Warning" button variant in Dark Mode.

## Phase 4: Final Polish
- [ ] **Task:** Add hover states (`scale-101` or `border-primary`) to the Grid Cards (ECG, Derm, etc.) to improve interactivity cues.
