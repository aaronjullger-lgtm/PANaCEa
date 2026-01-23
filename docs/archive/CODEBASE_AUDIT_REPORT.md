# 🔍 PANaCEa Codebase Audit Report

**Generated:** December 23, 2025  
**Scope:** `src/`, `components/`, `services/`, `server.ts`  
**Auditor:** Senior Tech Lead AI

---

## 🚨 HIGH PRIORITY: Static File Imports (Database-First Migration)

### Critical - Must Replace with API Calls

- [ ] **src/questions.ts:1**

  ```typescript
  import { buildConditionDefinition, findConditionMeta } from '../conditionRegistry.ts';
  ```

  **Impact:** Still using static registry for question bank generation  
  **Action:** Replace with database query via `/api/conditions` endpoint

- [ ] **services/conditionDataLoader.ts:8-9**

  ```typescript
  import { CONDITION_REGISTRY } from '../conditionRegistry';
  import type { ConditionMeta } from '../conditionRegistry';
  ```

  **Impact:** Service layer still importing static registry  
  **Action:** Refactor to use `conditionRegistryService.ts` (database-driven)  
  **Note:** This file should probably be deprecated entirely in favor of the new service

- [ ] **components/MenuView.tsx:24**

  ```typescript
  import type { ConditionMeta } from '../conditionRegistry';
  ```

  **Impact:** Type import only - less critical but indicates coupling  
  **Action:** Move `ConditionMeta` type to `src/types/` directory

- [ ] **lib/services/sync/registrySync.ts:2**
  ```typescript
  import { CONDITION_REGISTRY, type ConditionMeta } from '../../../conditionRegistry';
  ```
  **Impact:** Sync service still using static registry  
  **Action:** This is likely OK for sync operations (writing TO database), but verify use case

### Registry Files Detected (Potential Static Imports)

The following registry files exist in the root directory. Audit ALL imports of these:

- [ ] `conditionRegistry.ts` (2195 lines - PRIMARY TARGET)
- [ ] `drugRegistry.ts`
- [ ] `abbreviationRegistry.ts`
- [ ] `anatomyRegistry.ts`
- [ ] `differentialRegistry.ts`
- [ ] `findingRegistry.ts`
- [ ] `guidelineRegistry.ts`
- [ ] `imagingRegistry.ts`
- [ ] `labTestRegistry.ts`
- [ ] `physiologyRegistry.ts`
- [ ] `scoringSystemRegistry.ts`
- [ ] `specialTestRegistry.ts`
- [ ] `surgeryRegistry.ts`
- [ ] `symptomRegistry.ts`
- [ ] `treatmentRegistry.ts`
- [ ] `pharm/pharmRegistry.ts`

**Recommendation:** Run a comprehensive grep for `import.*Registry` to find all static imports

---

## 📝 TODO/FIXME/NOTE Roundup

### server.ts

- [ ] **Line 2619** - `// TODO: Create proper Express handler or migrate to Cloudflare Functions`  
       **Context:** Likely related to endpoint migration  
       **Priority:** Medium - Part of Cloudflare migration strategy

### components/CommandCenter.tsx

- [ ] **Line 86** - `// TODO: Load SRS items separately - they're not in PerformanceRecord`  
       **Context:** Data structure mismatch between SRS and performance tracking  
       **Priority:** Medium - May cause data inconsistency

### components/MenuView.tsx

- [ ] **Line 938** - `// Note: Full implementation would trigger a special review session mode`  
       **Context:** Incomplete feature - review session mode  
       **Priority:** Low - Feature stub

- [ ] **Line 953** - `// Note: Full implementation would update in parent state/database`  
       **Context:** Incomplete database sync logic  
       **Priority:** Medium - Data persistence gap

### components/analytics/WeaknessCheatsheetExporter.tsx

- [ ] **Line 6** - `/* Note: This component generates a simplified cheatsheet based on performance */`  
       **Context:** Documentation comment  
       **Priority:** Low - Informational only

### components/SettingsStatsModal.tsx

- [ ] **Line 1449** - `[i] <strong>Note:</strong> Clinical Fidelity features are optional enhancements...`  
       **Context:** User-facing documentation  
       **Priority:** Low - Not a code TODO

---

## ⚠️ Type Safety Issues: `any` Usage

### Critical Type Safety Gaps

- [ ] **src/lib/drugSearch.ts:12**

  ```typescript
  function mapDrugToEntry(drug: any): DrugEntry {
  ```

  **Impact:** No type safety for drug data mapping  
  **Action:** Define proper `DrugData` or `RawDrugRecord` interface

- [ ] **components/AuthProvider.tsx:15,20-21**

  ```typescript
  const BASE_CLERK_PUBLISHABLE_KEY = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY || '';
  ```

  **Impact:** Repeated `as any` for environment variables  
  **Action:** Define `ImportMeta` interface extension in `vite-env.d.ts`

- [ ] **components/QuickReviewMode.tsx:156**

  ```typescript
  onClick={() => setSelectedTimeframe(option.value as any)}
  ```

  **Impact:** Type coercion without validation  
  **Action:** Use proper type guard or narrow union type

- [ ] **components/conditions/FormattedSection.tsx:27**

  ```typescript
  const typedContent = content as any;
  ```

  **Impact:** Bypassing type system for dynamic content  
  **Action:** Use discriminated union or type guards

- [ ] **components/SystemDrilldownModal.tsx:161**

  ```typescript
  (r as any).conditionName || r.condition || (r as any).conditionId || '';
  ```

  **Impact:** Type safety bypassed for legacy data structure  
  **Action:** Normalize data structure or use proper type guards

- [ ] **components/social/StudyGroupDashboard.tsx:138**

  ```typescript
  } catch (err: any) {
  ```

  **Impact:** Error handling without type safety  
  **Action:** Use `unknown` and type guard: `err instanceof Error`

- [ ] **components/integrations/WidgetPanel.tsx:67**
  ```typescript
  const serverUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:3001';
  ```
  **Impact:** Same env variable issue  
  **Action:** Use typed import.meta interface

### Recharts Component Props (Lower Priority)

The following are Recharts library components with `any` types - acceptable but could be improved:

- [ ] **components/dashboard/GapAnalysisDashboard.tsx:48,68,138** - `StarShape`, `TickShape`, `CustomTooltip`
- [ ] **components/dashboard/charts/DecayCurve.tsx:18** - `CustomTooltip`
- [ ] **components/dashboard/charts/StabilityPyramid.tsx:42** - `CustomTooltip`

**Action:** Extract these to typed interfaces using Recharts proper types

### Admin/CMS Components

- [ ] **components/TodoistExportModal.tsx:21-22**

  ```typescript
  weeklyPlan?: any[];
  missedQuestions?: any[];
  ```

  **Impact:** Untyped data structures  
  **Action:** Create proper `WeeklyPlanItem` and `MissedQuestion` interfaces

- [ ] **components/admin/ContentEditor.tsx:50,152**
  ```typescript
  const handleFieldChange = (field: string, value: any) => {
  // ...
  } catch (error: any) {
  ```
  **Impact:** Generic field updates without validation  
  **Action:** Use discriminated union for field types

### Form Components

- [ ] **components/modes/EncounterSettings.tsx:122,138,153**
  ```typescript
  onChange={(e) => updateSetting('patientAge', e.target.value as any)}
  ```
  **Impact:** Type coercion in form handlers (3 instances)  
  **Action:** Use proper type assertions or create typed event handlers

---

## 🐛 Logic Gaps & Error Handling

### Empty Catch Blocks

**Good News:** No completely empty `catch {}` blocks found! 🎉

All error handling includes at least `console.error()` logging, which is acceptable for development but should be enhanced for production.

### Inadequate Error Handling (Needs Improvement)

- [ ] **src/context/ShortcutContext.tsx:85,100,115**

  ```typescript
  } catch (error) {
    console.error('[ShortcutContext] Failed to load shortcuts from localStorage:', error);
  }
  ```

  **Issue:** Error logged but not surfaced to user  
  **Action:** Consider showing toast notification for user-facing errors

- [ ] **src/conditionContent.generated.ts:86**

  ```typescript
  } catch (error) {
    console.error('Failed to load content from database:', error instanceof Error ? error.message : 'Unknown error');
  }
  ```

  **Issue:** Silent failure when loading critical content  
  **Action:** Return error state or throw to caller

- [ ] **src/lib/drugSearch.ts:61**
  ```typescript
  } catch (error) {
    console.error("Failed to load drugs for search:", error);
  }
  ```
  **Issue:** Failed drug loading not reported to user  
  **Action:** Set error state in component

### Components Missing Loading/Error States

Based on fetch/async operations detected, these components should be audited:

#### ✅ **Good Examples (Have Loading/Error States)**

- `components/modes/GrandRoundsMode.tsx` - Has `ViewState` with 'loading' and 'error'
- `components/toolkit/ClinicalLibrary.tsx` - Has `registryLoading`, `contentLoading`, and error states
- `components/drill/DrillSetup.tsx` - Has `loading` state and error handling
- `components/modes/CramMode.tsx` - Has `isLoading` and `loadingProgress`

#### ⚠️ **Needs Review (May Be Missing States)**

- [ ] **components/social/StudyGroupDashboard.tsx**  
       **Fetches:** `/api/social/groups`, `/api/social/leaderboard`, `/api/social/groups/join`  
       **Check:** Verify loading/error states for all 4 fetch operations

- [ ] **components/dashboard/GapAnalysisDashboard.tsx**  
       **Fetches:** `/api/analytics/performance-deltas`  
       **Check:** Verify loading state during data fetch

- [ ] **components/dashboard/RetentionWidget.tsx**  
       **Fetches:** `/api/srs/stats`  
       **Check:** Verify loading/error display

- [ ] **components/admin/ContentEditor.tsx**  
       **Fetches:** `/api/admin/generate-draft`  
       **Check:** Line 152 has error catch, verify UI shows error to user

- [ ] **components/admin/MediaApprovalDashboard.tsx**  
       **Fetches:** `/api/media/pending`, `/api/media/approve` (multiple calls)  
       **Check:** Verify loading states for async operations

- [ ] **components/ConditionDetailModal.tsx**  
       **Fetches:** `/api/conditions/${id}/extended`  
       **Check:** Verify loading spinner and error message display

- [ ] **components/modes/SmartReviewMode.tsx**  
       **Fetches:** `/api/drills/smart-review`, `/api/drills/submit-review`  
       **Check:** Verify loading state for both operations

- [ ] **components/CommandPalette.tsx**  
       **Fetches:** Search API (line 109)  
       **Check:** Verify loading state during search

---

## 🧹 Code Quality Recommendations

### Deprecated Files to Remove

- [ ] **services/conditionDataLoader.ts** - Likely superseded by `services/conditionRegistryService.ts`
- [ ] **src/questions.ts** - Static question bank should move to database

### Type Organization

- [ ] **Action:** Move `ConditionMeta` type from `conditionRegistry.ts` to `src/types/condition.ts`
- [ ] **Action:** Create `src/types/drug.ts` for drug-related types
- [ ] **Action:** Create `vite-env.d.ts` for import.meta type extensions

### Environment Variables

- [ ] **Create typed interface:**

  ```typescript
  // vite-env.d.ts
  interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY: string;
    readonly VITE_CLERK_PUBLISHABLE_KEY_DEV?: string;
    readonly VITE_CLERK_PUBLISHABLE_KEY_LOCAL?: string;
    readonly VITE_BACKEND_URL?: string;
    readonly VITE_API_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  ```

### Todoist Integration Naming

Multiple files reference "Todoist" - this appears to be a feature:

- `components/TodoistCallback.tsx`
- `components/TodoistExportModal.tsx`
- `components/integrations/TodoistExportPanel.tsx`

**Note:** This is intentional, not a typo. Consider adding to project documentation.

---

## 📊 Summary Statistics

| Category                  | Count         | Priority       |
| ------------------------- | ------------- | -------------- |
| Static Registry Imports   | 4 critical    | 🔴 HIGH        |
| TODO/FIXME Comments       | 4             | 🟡 MEDIUM      |
| `any` Type Usage          | 20+ instances | 🟠 MEDIUM-HIGH |
| Empty Catch Blocks        | 0             | ✅ GOOD        |
| Inadequate Error Handling | 3             | 🟡 MEDIUM      |
| Components Missing States | 8 need review | 🟡 MEDIUM      |

---

## 🎯 Recommended Action Plan

### Phase 1: Critical (This Week)

1. Audit and replace static `conditionRegistry` imports in `src/questions.ts`
2. Verify `services/conditionDataLoader.ts` usage and deprecate if redundant
3. Fix critical `any` types in data mapping functions (`drugSearch.ts`)

### Phase 2: High Priority (Next Sprint)

1. Create `vite-env.d.ts` to eliminate `as any` for env variables
2. Add proper type interfaces for drug data, weekly plans, missed questions
3. Audit components for missing error/loading states (focus on admin panels)

### Phase 3: Code Quality (Ongoing)

1. Replace `as any` type coercions with proper type guards
2. Enhance error handling to surface errors to users (toast notifications)
3. Move types from registry files to `src/types/` directory

### Phase 4: Documentation (Maintenance)

1. Document Todoist integration in README
2. Update database-first architecture documentation
3. Create migration guide for remaining static registry usage

---

## 🛠️ Tools & Commands for Continued Auditing

```bash
# Find all static registry imports
grep -r "import.*Registry" src/ components/ services/

# Find all 'any' types
grep -r ": any\|as any\|any\[\]" src/ components/ --include="*.ts" --include="*.tsx"

# Find TODO/FIXME comments
grep -r "TODO\|FIXME\|HACK\|XXX" src/ components/ services/

# Find empty catch blocks
grep -r "catch.*{[\s\n]*}" src/ components/ --include="*.ts" --include="*.tsx"

# Find fetch/async operations
grep -r "fetch(\|async.*useEffect\|await.*prisma" components/ src/
```

---

**Report Complete** ✅  
_Next Review: After Phase 1 completion_
