# Large Dataset Rendering Audit (DOM Bloat)

**Context:** Screenshot 13 shows a "Performance Data" table with "40 records." After a year of study, that table could have 5,000+ records.

**Vulnerability:** Rendering 5,000 DOM nodes (one per record) freezes the browser, especially on mobile. The "History" tab or any long list must not render all rows.

## Requirement

**Never render 5,000 DOM nodes for a list.** Only render the ~10–15 visible on screen (windowing/virtualization). Use `@tanstack/react-virtual` (or similar) for long lists.

## Implementation

### 1. Dependency

- **@tanstack/react-virtual** — list virtualization (windowing). Only visible items are in the DOM.

### 2. Components

| Component | Purpose |
|-----------|---------|
| **VirtualizedTableBody** (`components/ui/VirtualizedTableBody.tsx`) | Generic virtualized table body. Takes `items`, `parentRef`, `renderRow`, `gridTemplateColumns`. Use for any long table (admin question performance, etc.). |
| **VirtualizedPerformanceRecordList** (`components/analytics/VirtualizedPerformanceRecordList.tsx`) | Virtualized list of `PerformanceRecord[]`. Use for a "History" tab or any UI that shows session/performance records as a long list. |

### 3. Current Usage

- **QuestionPerformanceDashboard** (admin): Table body is virtualized. Header is a fixed grid row; scroll container uses `VirtualizedTableBody` so only visible rows (~10–15) are in the DOM. Safe for 100+ or 5,000+ rows.
- **SettingsStatsModal**: "Performance Data" shows a **count** ("X records") and a clear button only. No table of all records is rendered. If a "View history" or full record list is added, it **must** use `VirtualizedPerformanceRecordList` (or equivalent) with a scroll container ref.

### 4. Future "History" Tab

If a "History" tab (or similar) is added that lists every performance record:

1. Use a scroll container: `<div ref={parentRef} style={{ overflow: 'auto', maxHeight: '50vh' }}>`.
2. Render **only** `VirtualizedPerformanceRecordList` (or a virtualized list) inside it — do **not** map over `performanceData` to render one DOM node per record.
3. Keep data in memory as needed; virtualization only limits **rendered** nodes.

### 5. Other Long Lists

- **LongitudinalProgressDashboard**: Renders aggregated **phases** (weekly/monthly/quarterly), not raw records. Phase count is bounded (~52 weeks or ~12 months). No change needed unless phase count grows unbounded.
- **StreakVisualization**: Uses `performanceData.slice(-maxDisplay)` with `maxDisplay = 50`. Capped at 50 nodes. For very large sessions, consider virtualization or keep cap.
- **ActivityHeatmap**: Renders a **grid of days** (e.g. 13×7 cells), not one row per record. No change needed.
- **ContentManagement** (admin): Already paginates with `.slice((page-1)*itemsPerPage, page*itemsPerPage)`. Consider virtualization if page size is increased to hundreds.

## References

- `components/ui/VirtualizedTableBody.tsx` — generic virtualized table body
- `components/analytics/VirtualizedPerformanceRecordList.tsx` — virtualized performance record list
- `components/admin/QuestionPerformanceDashboard.tsx` — example: virtualized table with grid header + virtualized body
