# App.tsx Decomposition Roadmap

## Current State (post-sprint)

`App.tsx` is 2576 lines. The URL→view routing logic was extracted in this sprint into `hooks/useAppNavigation.ts`.

## Remaining Decomposition Plan

### Phase A: Extract view-group components (high priority)

The view renderer inside App.tsx (the `{view === 'xxx' && ...}` section, ~1100 lines) should be split into view-group components:

```
components/
  AppViewRenderer.tsx       ← The AnimatePresence+view switch block
  views/
    CoreViews.tsx           ← command_center, menu, quiz, session_runner
    DrillViews.tsx          ← All {view === 'ecg_drill'} etc. (simple onExit only)
    AnalyticsViews.tsx      ← gap_analysis, clinical_profile, study_path_dashboard
    AdminViews.tsx          ← admin_media, social_dashboard
    SpecialtyViews.tsx      ← patient_encounter, panre_la, pance_simulator
```

**AppViewRenderer props interface** (when extracted):
- `view: View`
- `onNavigateToView: (v: View) => void`
- Session state: `sessionSettings`, `questionsForSession`, `growthAreas`, `getToken`
- Command center state: `heatmapPerformance`, `missedQuestions`, `flaggedQuestions`, `dueQuestionsCount`
- Handler refs: `handleStartSession`, `handleNavigateToDrillMode`, etc.

### Phase B: Extract provider shell

Move the provider composition to `components/AppProviders.tsx`:
```tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SystemIntegrationProvider>
      <ToastProvider>
        <CommuterProvider>
          <BehavioralTrackerProvider>
            {children}
          </BehavioralTrackerProvider>
        </CommuterProvider>
      </ToastProvider>
    </SystemIntegrationProvider>
  );
}
```

### Phase C: Session state hook

Extract ~400 lines of session management (state + callbacks for quiz/session/performance) into `hooks/useSessionState.ts`.

### Phase D: Settings/modals hook

Extract the settings modal state into `hooks/useAppModals.ts`.

## Already Done

- `hooks/useAppNavigation.ts` — URL→view routing, notFound detection, accessibility focus
- `hooks/useViewTransition.ts` — view transition wrapper
- `hooks/useTheme.ts` — theme state

## Definition of Done (full decomposition)

- App.tsx ≤ 500 lines (providers + layout shell + hook wiring)
- Each view group has its own component file
- All behaviors preserved with parity tests
