# Phase 2: Component Organization Plan

## Overview
This document outlines the strategy for reorganizing 40 loose root-level components into appropriate subdirectories.

## Categorization Strategy

### 1. Error Handling → `components/error/`
**Already exists, move these:**
- `ErrorBoundary.tsx` ✅ (already in error/)
- `GeminiErrorBoundary.tsx` → MOVE

### 2. Loading States → `components/loading/`
**Directory exists, move these:**
- `Loader.tsx` → MOVE
- `LoadingProgress.tsx` → MOVE

### 3. Authentication → `components/auth/` (NEW DIRECTORY)
**Create new directory:**
- `AuthButton.tsx` → MOVE
- `AuthProvider.tsx` → MOVE

### 4. Pages → `pages/`
**Root-level pages directory:**
- `LandingPage.tsx` → MOVE (rename to LandingPage.tsx if needed)

### 5. UI Primitives → `components/ui/`
**Already exists, move these:**
- `ThemeToggleButton.tsx` → MOVE
- `ProgressRing.tsx` → MOVE
- `Sparkline.tsx` → MOVE
- `TrustBadge.tsx` → MOVE
- `DefinitionTooltip.tsx` → MOVE

### 6. Modals → `components/modals/` (NEW DIRECTORY)
**Create new directory:**
- `ConditionDetailModal.tsx` → MOVE
- `DrugDetailModal.tsx` → MOVE
- `FlagQuestionModal.tsx` → MOVE
- `KeyboardShortcutsModal.tsx` → MOVE
- `SessionSetupModal.tsx` → MOVE
- `SettingsStatsModal.tsx` → MOVE
- `SystemDrilldownModal.tsx` → MOVE
- `TopicDetailModal.tsx` → MOVE

### 7. Panels/Sidebars → `components/panels/` (NEW DIRECTORY)
**Create new directory:**
- `BookmarksPanel.tsx` → MOVE
- `ConditionSidebar.tsx` → MOVE
- `ExplanationPanel.tsx` → MOVE (currently used in multiple contexts)

### 8. Session/Quiz → `components/session/`
**Already exists, move these:**
- `QuizView.tsx` → MOVE
- `QuickReviewMode.tsx` → MOVE
- `PhotoDrillSession.tsx` → MOVE

### 9. Navigation/Command → `components/navigation/` (NEW DIRECTORY)
**Create new directory:**
- `CommandCenter.tsx` → MOVE
- `CommandCenterHub.tsx` → MOVE
- `CommandPalette.tsx` → MOVE
- `MenuView.tsx` → MOVE

### 10. Analytics/Charts → `components/analytics/`
**Already exists, move these:**
- `TopicBarChart.tsx` → MOVE
- `TopicHeatmap.tsx` → MOVE
- `StreakTracker.tsx` → MOVE

### 11. Integrations → `components/integrations/`
**Already exists, move these:**
- `TodoistCallback.tsx` → MOVE
- `TodoistExportModal.tsx` → MOVE (could also go in modals/)

### 12. Drill/Training → `components/drill/`
**Already exists, move this:**
- `DiagnosticDrillHub.tsx` → MOVE

### 13. Toolkit → `components/toolkit/`
**Already exists, move these:**
- `StudyGuideGenerator.tsx` → MOVE
- `RotationSelector.tsx` → MOVE

### 14. Offline/Sync → `components/offline/`
**Already exists, move these:**
- `OfflineSyncIndicator.tsx` → MOVE
- `FailedSyncItems.tsx` → MOVE

### 15. Layout → `components/layout/`
**Already exists, move this:**
- `AccountFooter.tsx` → MOVE

## Execution Order

### Batch 1: Simple Moves (Existing Directories)
1. Error components → `components/error/`
2. Loading components → `components/loading/`
3. UI primitives → `components/ui/`
4. Session components → `components/session/`
5. Analytics components → `components/analytics/`
6. Integration components → `components/integrations/`
7. Drill components → `components/drill/`
8. Toolkit components → `components/toolkit/`
9. Offline components → `components/offline/`
10. Layout components → `components/layout/`
11. Pages → `pages/`

### Batch 2: New Directory Moves
1. Create `components/auth/` → Move auth components
2. Create `components/modals/` → Move modal components
3. Create `components/panels/` → Move panel components
4. Create `components/navigation/` → Move navigation components

### Batch 3: Update Import Paths
After moving all components, search and replace all import statements:
```bash
# Find all files importing moved components
grep -r "from '../components/Loader'" --include="*.tsx" --include="*.ts"
grep -r "from '../../components/Loader'" --include="*.tsx" --include="*.ts"
# etc.
```

### Batch 4: Create Barrel Exports
Create `index.ts` files in new directories:
- `components/auth/index.ts`
- `components/modals/index.ts`
- `components/panels/index.ts`
- `components/navigation/index.ts`

## Summary
- **40 components** to reorganize
- **4 new directories** to create
- **10 existing directories** to populate
- Estimated **200+ import statements** to update

## Success Criteria
- [ ] All 40 components moved to appropriate directories
- [ ] All import paths updated and working
- [ ] Barrel exports created for new directories
- [ ] `npm run typecheck` passes with no new errors
- [ ] All changes committed and pushed to remote
