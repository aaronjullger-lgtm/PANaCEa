# Clinical Reference Library Redesign Implementation

**Date:** January 11, 2026  
**Status:** ✅ Complete

## Overview

Complete overhaul of the Clinical Reference Library to implement a hierarchical "Medical Filing Cabinet" pattern optimized for PA students doing targeted condition review before/after study modes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📚 Clinical Reference Library                    [🔍 Search] [⭐ HY]   │
├────────────────┬────────────────────────────────────────────────────────┤
│                │                                                        │
│ SYSTEMS        │  🫀 CARDIOVASCULAR  ›  Arrhythmias                     │
│ ──────────────│  ──────────────────────────────────────────────────────│
│                │                                                        │
│ ▼ 🫀 Cardio (87)│  ┌──────────────────┐ ┌──────────────────┐            │
│   Arrhythmias  │  │ ATRIAL FIB       │ │ AFIB w/ RVR       │            │
│   CHF          │  │ ⭐⭐⭐ High Yield   │ │ ⭐⭐ Medium         │            │
│   CAD          │  │──────────────────│ │──────────────────│            │
│   Valvular     │  │👤 elderly, irreg │ │👤 unstable, tachy │            │
│                │  │🏷️ irreg irreg •  │ │🏷️ rate control • │            │
│ ▶ 🫁 Pulm (62) │  │   no P waves     │ │   unstable        │            │
│ ▶ 🧠 Neuro (54)│  │──────────────────│ │──────────────────│            │
│ ...            │  │💊 Metoprolol     │ │💊 Diltiazem       │            │
│                │  │🔬 EKG            │ │🔬 Echo            │            │
│                │  └──────────────────┘ └──────────────────┘            │
│                │                                                        │
└────────────────┴────────────────────────────────────────────────────────┘
```

---

## New Components

### 1. `LibrarySidebar.tsx`

Persistent left-hand navigation with hierarchical system tree.

**Features:**

- Collapsible organ system sections with icons
- Subcategory sub-navigation within each system
- Condition counts at all levels
- **High Yield Only toggle** (filters to `pance_yield >= 3`)
- Integrated search with `/` keyboard shortcut
- Auto-expand active system

**Props:**

```typescript
interface LibrarySidebarProps {
  systems: SystemData[];
  subcategories: Map<string, SubcategoryData[]>;
  activeSystem: string;
  activeSubcategory: string | null;
  highYieldOnly: boolean;
  onSystemSelect: (systemId: string) => void;
  onSubcategorySelect: (system: string, subcategory: string | null) => void;
  onHighYieldToggle: (enabled: boolean) => void;
  onSearch: (query: string) => void;
}
```

### 2. `EnhancedConditionCard.tsx`

Rich preview cards with pattern-recognition triggers.

**Displays:**

- Condition name (Teko display font)
- PANCE yield badge (⭐ indicator)
- **Classic patient** snippet (👤 "55yo M with chest pain...")
- **Top 3 buzzwords** (🏷️ memory anchors)
- **Quick info tooltips** for Gold Standard Dx (🔬) and First-Line Rx (💊)

### 3. `LibraryBreadcrumb.tsx`

Navigation trail showing current location in hierarchy.

**Format:** `Library › Cardiovascular › Arrhythmias`

Clickable segments for quick navigation back up the hierarchy.

### 4. `ClinicalReferenceLibrary.tsx` (Refactored)

Main component with 2-column layout.

**Features:**

- Persistent sidebar + content grid layout
- **Slide-over detail panel** (non-blocking, slides from right)
- **Keyboard navigation**:
  - `←/→` or `j/k` to browse conditions in detail view
  - `Esc` to close detail panel
  - `/` to focus search
- Next/Previous buttons with position indicator ("3/47")
- Content grouped by subcategory headers

---

## Hooks

### `useLibraryPreferences`

Persists user preferences to `localStorage`.

**Stored:**

- `activeSystem` - Last selected system
- `activeSubcategory` - Last selected subcategory
- `highYieldOnly` - Filter state
- `lastVisited` - ISO timestamp

### `useDebouncedSearch`

300ms debounced search input to prevent excessive API calls.

**Returns:**

```typescript
{
  inputValue: string;
  debouncedValue: string;
  isSearching: boolean;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setQuery: (value: string) => void;
  clearSearch: () => void;
}
```

---

## API Enhancements

### `GET /api/content/library`

**New Parameters:**

- `highYield=true` - Filter to `pance_yield >= 3`

**New Response Fields:**

- `gold_standard_dx` - For card tooltips
- `first_line_rx` - For card tooltips

---

## CSS Styling

### `styles/library-markdown.css`

Custom markdown rendering for medical content.

**Highlights:**

- Proper heading hierarchy
- Bold text for medical emphasis
- Bullet/numbered lists with accent markers
- Inline code for drug names, lab values
- Blockquotes for clinical pearls
- Tables for lab values, dosing charts
- `.first-line` and `.gold-standard` highlight classes

---

## File Structure

```
components/library/
├── ClinicalReferenceLibrary.tsx  (REFACTORED)
├── LibrarySidebar.tsx            (NEW)
├── LibraryBreadcrumb.tsx         (NEW)
├── EnhancedConditionCard.tsx     (NEW)
├── MobileMenuToggle.tsx          (NEW)
├── RecentConditionsPanel.tsx     (NEW)
├── EnhancedConditionCard.tsx
├── ConditionMaster.tsx           (existing)
├── ConditionDetailPanel.tsx      (existing)
├── index.ts                      (UPDATED)
├── hooks/
│   ├── index.ts                  (NEW)
│   ├── useLibraryPreferences.ts  (NEW)
│   ├── useDebouncedSearch.ts     (NEW)
│   └── useRecentConditions.ts    (NEW)
└── styles/
    └── library-markdown.css      (NEW)

functions/api/content/
└── library.ts                    (ENHANCED)
```

---

## Usage

```tsx
import { ClinicalReferenceLibrary } from '@/components/library';

// In your route/page
<ClinicalReferenceLibrary onExit={() => navigate('/dashboard')} />;
```

---

## Keyboard Shortcuts

| Key        | Action                                |
| ---------- | ------------------------------------- |
| `/`        | Focus search input                    |
| `Esc`      | Close detail panel                    |
| `←` or `k` | Previous condition (when detail open) |
| `→` or `j` | Next condition (when detail open)     |

---

## Design Decisions

1. **Slide-over vs Modal**: Detail panel slides in from right instead of blocking modal - allows users to reference the card grid while reading.

2. **Subcategory grouping**: Within each system view, conditions are grouped by subcategory with headers, creating the "filing cabinet" mental model.

3. **High Yield toggle at sidebar level**: Prominent placement encourages use for rapid pre-exam review.

4. **Classic patient + buzzwords on cards**: Pattern recognition triggers visible before clicking - matches how exam questions present.

5. **Gold Standard / First-Line icons**: Most tested facts instantly accessible via hover tooltips without opening full detail.

---

## Implemented Enhancements ✅

All originally planned "future" features have been implemented:

| Feature                    | Component                                             | Status |
| -------------------------- | ----------------------------------------------------- | ------ |
| Mobile responsive sidebar  | `MobileMenuToggle.tsx`                                | ✅     |
| Condition bookmarking      | `BookmarksPanel.tsx`, `useConditionBookmarks.ts`      | ✅     |
| Recently viewed conditions | `RecentConditionsPanel.tsx`, `useRecentConditions.ts` | ✅     |
| Virtual scrolling          | `VirtualizedConditionList.tsx`                        | ✅     |
| Study mode integration     | `QuickQuizButton.tsx`                                 | ✅     |

### Additional Features Implemented

| Feature               | Component                                         | Description                              |
| --------------------- | ------------------------------------------------- | ---------------------------------------- |
| DDx Compare           | `DDxCompareModal.tsx`, `DDxMatrixView.tsx`        | Side-by-side condition comparison        |
| Confusion Pair Alerts | `ConfusionPairAlert.tsx`                          | Warns about commonly confused conditions |
| DDx Intelligence      | `useDDxIntelligence.ts`, `services/ddxService.ts` | AI-powered differential suggestions      |
| Mastery Tracking      | `MasteryBadge.tsx`                                | Shows user's mastery level per condition |
| System Progress       | `SystemProgressBar.tsx`                           | Progress bar per organ system            |
| Keyboard Help         | `KeyboardShortcutsHelp.tsx`                       | Modal showing available shortcuts        |

### API Endpoints

| Endpoint                   | Purpose                               |
| -------------------------- | ------------------------------------- |
| `/api/ddx/related`         | Get related conditions for DDx        |
| `/api/ddx/compare`         | Compare two conditions side-by-side   |
| `/api/ddx/confusion-pairs` | Get commonly confused condition pairs |
| `/api/ddx/workup`          | Get diagnostic workup for condition   |
| `/api/ddx/smart-suggest`   | AI-powered DDx suggestions            |

---

## Further Improvement Ideas

### High Priority

1. **Spaced Repetition Integration**
   - Link conditions to user's FSRS progress
   - Show "Last Reviewed" and "Due for Review" badges
   - Quick-drill button that creates a 5-question mini-session

2. **Clinical Image Gallery**
   - Display associated MediaAssets (ECGs, X-rays, skin lesions)
   - "Photo Quiz" quick-drill from condition detail view
   - Reference image carousel

3. **Lab Value Quick-Reference**
   - Expandable lab ranges card per condition
   - Calculator shortcuts (e.g., Anion Gap from Metabolic Acidosis)

### Medium Priority

4. **Study Planner Integration**
   - "Add to Study Plan" from condition cards
   - Weekly review scheduler based on PANCE yield

5. **Community Notes**
   - User-contributed clinical pearls (moderated)
   - "Most helpful" voting system
   - Premium feature consideration

6. **Print/Export**
   - Export condition to PDF
   - Quick Reference Card generator
   - Printable study sheets by system

### Lower Priority

7. **Audio Pronunciation**
   - Medical term pronunciation (text-to-speech)
   - Helpful for complex drug/condition names

8. **Flashcard Mode**
   - Toggle to hide answers, reveal on click
   - "Classic Patient → Condition" practice

9. **Condition Relationships Graph**
   - Visual graph showing condition relationships
   - "Complications of X lead to Y" visualization
