# Diagnostic Drill Hub - Implementation Guide

## Overview

The Diagnostic Drill Hub system provides a unified interface for all skill-based drill modes, with consistent navigation and no more "stuck in full-screen" issues.

## Components Created

### 1. `DrillShell.tsx`

Standardized wrapper for all drill modes providing:

- Consistent breadcrumb navigation
- Clear exit/back buttons
- Optional header content (scores, streaks)
- Responsive layout
- "Back to Hub" functionality

### 2. `DiagnosticDrillHub.tsx`

Main hub interface with:

- 2 categorized sections:
  - **Clinical Diagnosis Modes**: Interpretation-based drills (OSCE, Hydro, Mini-Labs, ECG, Radiology, Code Blue, DDx Compare, Ventilator)
  - **Quick-Fire Drills**: Rapid recall drills (Buzzword Mode, Derm Photos, Bug-Drug Mastery, First-Line, Daily Term, Polypharmacy)
- 14 drill modes total (12 currently available, 2 coming soon)
- Category filtering and search
- Difficulty levels and time estimates
- Responsive grid layout

**Key Organization Principles:**

- **Clinical Diagnosis** = Anything requiring interpretation (labs, ECGs, radiology, patient workups)
- **Quick-Fire** = Rapid recall and recognition (buzzwords, terminology, simple photo ID)
- **Grand Rounds** is separate (designed for daily challenges, not in this hub)
- **Guidelines** moved to Toolkit as a calculator (not a drill)
- **Radiology Scroll** remains in Toolkit (reference library, not a drill)
- Photo modes: Radiology = interpretation (Clinical), Derm = quick recognition (Quick-Fire)
- ECG = interpretation-based, so it's in Clinical Diagnosis

## Integration Guide

### Step 1: Add Routes to App.tsx

```tsx
import DiagnosticDrillHub from './components/DiagnosticDrillHub';
import DrillShell from './components/drill/DrillShell';

// In your App component's view logic:
{
  view === 'diagnostic_hub' && (
    <DiagnosticDrillHub
      onNavigateToDrill={(drillId) => {
        setView(drillId);
      }}
      onClose={() => setView('menu')}
    />
  );
}
```

### Step 2: Wrap Existing Drill Modes with DrillShell

#### Example: Photo Drill

```tsx
// Before:
<PhotoDrillSession onExit={() => setView("menu")} />

// After:
<DrillShell
  title="Photo Drill"
  breadcrumb={['Diagnostic Drills', 'Visual Diagnostics', 'Photo Drill']}
  onBackToHub={() => setView('diagnostic_hub')}
  onBack={() => setView('diagnostic_hub')}
>
  <PhotoDrillSession onExit={() => setView('diagnostic_hub')} />
</DrillShell>
```

#### Example: Radiology Photos

```tsx
<DrillShell
  title="Radiology Photos"
  breadcrumb={['Diagnostic Drills', 'Quick-Fire Drills', 'Radiology Photos']}
  onBackToHub={() => setView('diagnostic_hub')}
  onBack={() => setView('diagnostic_hub')}
>
  <PhotoDrillSession onExit={() => setView('diagnostic_hub')} filterType="imaging" />
</DrillShell>
```

#### Example: Buzzword Mode

```tsx
<DrillShell
  title="Buzzword Mode"
  breadcrumb={['Diagnostic Drills', 'Quick-Fire Drills', 'Buzzword Mode']}
  onBackToHub={() => setView('diagnostic_hub')}
  onBack={() => setView('diagnostic_hub')}
  hideBreadcrumb={false} // Show breadcrumb for easy exit
>
  <RapidRecallDrill onExit={() => setView('diagnostic_hub')} />
</DrillShell>
```

#### Example: Lab Interpretation

```tsx
<DrillShell
  title="Lab Interpretation"
  breadcrumb={['Diagnostic Drills', 'Clinical Diagnosis', 'Lab Interpretation']}
  onBackToHub={() => setView('diagnostic_hub')}
  onBack={() => setView('diagnostic_hub')}
>
  <MiniLabDrillSession onExit={() => setView('diagnostic_hub')} />
</DrillShell>
```

### Step 3: Update Existing Drill Components

For drills that already have their own full-screen layout (like `PhotoDrillSession`), you have two options:

#### Option A: Keep Full-Screen Layout, Use DrillShell for Breadcrumb Only

```tsx
<DrillShell
  title="Photo Drill"
  breadcrumb={['Diagnostic Drills', 'Visual Diagnostics', 'Photo Drill']}
  onBackToHub={() => setView('diagnostic_hub')}
  hideBreadcrumb={false}
  className="bg-slate-900" // Match drill's dark theme
>
  {/* PhotoDrillSession renders its own full UI */}
  <PhotoDrillSession onExit={() => setView('diagnostic_hub')} />
</DrillShell>
```

#### Option B: Remove Internal Navigation, Let DrillShell Handle It

````tsx
// Update PhotoDrillSession to accept hideHeader prop
interface PhotoDrillSessionProps {
  onExit?: () => void;
  filterType?: PhotoDrillFilterType;
  hideHeader?: boolean; // NEW
}

// Then in DrillShell:
<DrillShell
  title="Photo Drill"
  breadcrumb={['Diagnostic Drills', 'Visual Diagnostics', 'Photo Drill']}
  onBackToHub={() => setView('diagnostic_hub')}
  headerContent={
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" />
        <span className="font-bold">Streak: {streak}</span>
      </div>
      <div className="text-sm text-[var(--color-text-muted)]">
## Drill Mode Registry

All drill modes are defined in `DRILL_MODES` array in `DiagnosticDrillHub.tsx`:

### Clinical Diagnosis Modes
Information-based diagnosis (OSCE, Hydro, Labs)

| Drill ID | Name | Difficulty | Status | Route Mapping |
|----------|------|------------|--------|---------------|
| `virtual_osce` | Virtual OSCE | Advanced | Coming Soon | - |
| `case_workup` | Hydro Mode | Intermediate | Coming Soon | - |
| `mini_labs` | Lab Interpretation | Intermediate | ✅ Available | `mini_labs` |
| `lab_values` | Lab Values Drill | Beginner | Coming Soon | - |
| `metabolic_panel` | Metabolic Panel Mastery | Advanced | Coming Soon | - |

### Quick-Fire Drills
Visual diagnostics, buzzwords, pharmacology, rapid recall

| Drill ID | Name | Difficulty | Status | Route Mapping |
|----------|------|------------|--------|---------------|
| `radiology_photo` | Radiology Photos (CT/MRI/X-ray) | Intermediate | ✅ Available | `radiology_photo` |
## Step 4: Update App.tsx Route Mapping

```tsx
const drillRouteMap: Record<string, string> = {
  // Clinical Diagnosis Modes
  virtual_osce: 'virtual_osce',
  hydro_mode: 'hydro_mode',
  mini_labs: 'mini_labs',
  ecg_challenge: 'ecg_drill',
  radiology_photo: 'radiology_photo',
  code_blue: 'code_blue',
  ddx_compare: 'ddx_compare',
  ventilator: 'ventilator_mode',

  // Quick-Fire Drills
  buzzword_mode: 'rapid_recall',
  derm_photo: 'derm_drill',
  pharmacology: 'pharmacology_drill',
  first_line: 'first_line_drill',
  daily_term: 'daily_term',
  polypharmacy: 'polypharmacy_drill',
};

// In DiagnosticDrillHub onNavigateToDrill:
onNavigateToDrill={(drillId) => {
  const route = drillRouteMap[drillId];
  if (route) {
    setView(route);
  } else {
    console.warn(`No route mapping for drill: ${drillId}`);
  }
}}
```rand_rounds: 'grand_rounds',

  // Visual Diagnostics
  photo_drill: 'photo_drill',
  ecg_challenge: 'ecg_drill',
  radiology_scroll: 'radiology_scroll',
  derm_drill: 'derm_drill',

  // High-Yield Recall
  rapid_recall: 'rapid_recall',
  pharmacology: 'pharmacology_drill',
  first_line: 'first_line_drill',
  guidelines: 'guidelines_drill',

  // Labs
  mini_labs: 'mini_labs',
};

// In DiagnosticDrillHub onNavigateToDrill:
onNavigateToDrill={(drillId) => {
  const route = drillRouteMap[drillId];
  if (route) {
## No-Stuck Navigation Flow

````

Dashboard
└─ Diagnostic Drill Hub
├─ Clinical Diagnosis Modes (Interpretation-based)
│ ├─ Virtual OSCE
│ │ └─ [Back to Hub] ✓
│ ├─ Hydro Mode
│ │ └─ [Back to Hub] ✓
│ ├─ Mini-Labs
│ │ └─ [Back to Hub] ✓
│ ├─ ECG Interpretation
│ │ └─ [Back to Hub] ✓
│ ├─ Radiology Interpretation
│ │ └─ [Back to Hub] ✓
│ ├─ Code Blue
│ │ └─ [Back to Hub] ✓
│ ├─ DDx Compare
│ │ └─ [Back to Hub] ✓
│ └─ Ventilator Mode
│ └─ [Back to Hub] ✓
│
└─ Quick-Fire Drills (Rapid Recall)
├─ Buzzword Mode
│ └─ [Back to Hub] ✓
├─ Derm Photos
│ └─ [Back to Hub] ✓
├─ Bug-Drug Mastery
│ └─ [Back to Hub] ✓
├─ First-Line Treatments
│ └─ [Back to Hub] ✓
├─ Daily Term
│ └─ [Back to Hub] ✓
└─ Polypharmacy
└─ [Back to Hub] ✓

Separate from Hub:
├─ Grand Rounds (Daily Challenges)
├─ Guidelines (Toolkit - Calculator)
└─ Radiology Scroll (Toolkit - Reference)

````

Every drill mode has:
1. Breadcrumb showing current location
2. "Back" button (one level up)
3. "Home" button in breadcrumb (return to hub)
4. Component's onExit handler navigates to hub
## Testing Checklist

- [ ] Hub renders 2 categories correctly
- [ ] Search filters drills by name/description
- [ ] Category filter pills work (Clinical Diagnosis vs Quick-Fire)
- [ ] "Coming Soon" drills are disabled (Ventilator, Polypharmacy, Virtual OSCE)
- [ ] All 12 available drills navigate correctly
- [ ] DrillShell breadcrumb shows correct path
- [ ] Back button returns to hub
- [ ] Home button in breadcrumb returns to hub
- [ ] No drill mode traps users (all have exit paths)
- [ ] Grand Rounds is NOT in hub (separate daily challenge)
- [ ] Guidelines is NOT in hub (toolkit calculator)
- [ ] Radiology Scroll is NOT in hub (toolkit reference)
- [ ] ECG is in Clinical Diagnosis (interpretation-based)
- [ ] Radiology is in Clinical Diagnosis (interpretation-based)
- [ ] Derm Photos is in Quick-Fire (quick recognition)
- [ ] Bug-Drug Mastery, Daily Term, Polypharmacy all in Quick-Fire
- [ ] Code Blue, DDx Compare, Ventilator all in Clinical Diagnosis
- [ ] Hydro Mode is available (not coming soon)
- [ ] Mobile responsive (categories stack, cards resize)
- [ ] Dark mode colors are correct
- [ ] Hover animations work on drill cards Diagnosis vs Quick-Fire)
- [ ] "Coming Soon" drills are disabled
- [ ] Available drills navigate correctly
- [ ] DrillShell breadcrumb shows correct path
- [ ] Back button returns to hub
- [ ] Home button in breadcrumb returns to hub
- [ ] No drill mode traps users (all have exit paths)
- [ ] Grand Rounds is NOT in the hub (separate daily challenge feature)
- [ ] Guidelines and Radiology Scroll are NOT in hub (toolkit resources)
- [ ] Photo modes are properly split: Radiology/Derm/ECG
- [ ] Buzzword Mode uses RapidRecallDrill component
- [ ] Mobile responsive (categories stack, cards resize)
- [ ] Dark mode colors are correct
- [ ] Hover animations work on drill cards hub

## Testing Checklist

- [ ] Hub renders all 4 categories correctly
- [ ] Search filters drills by name/description
- [ ] Category filter pills work
- [ ] "Coming Soon" drills are disabled
- [ ] Available drills navigate correctly
- [ ] DrillShell breadcrumb shows correct path
- [ ] Back button returns to hub
- [ ] Home button in breadcrumb returns to hub
- [ ] No drill mode traps users (all have exit paths)
- [ ] Mobile responsive (categories stack, cards resize)
- [ ] Dark mode colors are correct
- [ ] Hover animations work on drill cards

## Future Enhancements

1. **Progress Tracking**: Show completion percentage on drill cards
2. **Recent Drills**: Quick access to last 3 drills used
3. **Recommended Drills**: AI-powered suggestions based on performance
4. **Daily Challenges**: Featured drill rotates daily
5. **Drill Analytics**: Time spent, accuracy trends per drill mode
6. **Custom Drill Builder**: Let users create custom drill sequences

## Migration Checklist

To fully integrate the Diagnostic Drill Hub into PANaCEa:

1. ✅ Create `DrillShell.tsx` component
2. ✅ Create `DiagnosticDrillHub.tsx` component
3. ⏳ Update `App.tsx` to add hub route
4. ⏳ Wrap existing drill modes with DrillShell
5. ⏳ Update drill navigation handlers to route to hub
6. ⏳ Test all drill entry/exit flows
7. ⏳ Add hub link to main menu
8. ⏳ Update documentation
### Complete Example: Wrapping Photo Drill (Radiology)
```tsx
// In App.tsx
{view === 'radiology_photo' && (
  <DrillShell
    title="Radiology Photos"
    breadcrumb={['Diagnostic Drills', 'Quick-Fire Drills', 'Radiology Photos']}
    onBackToHub={() => setView('diagnostic_hub')}
    onBack={() => setView('diagnostic_hub')}
  >
    <PhotoDrillSession
      onExit={() => setView('diagnostic_hub')}
      filterType="imaging"
    />
  </DrillShell>
)}
``` <div className="text-sm text-white/90">15 skill-based modes</div>
  </div>
  <ChevronRight className="w-5 h-5 ml-auto group-hover:translate-x-1 transition-transform" />
</button>
````

### Complete Example: Wrapping Photo Drill

```tsx
// In App.tsx
{
  view === 'photo_drill' && (
    <DrillShell
      title="Photo Drill"
      breadcrumb={['Diagnostic Drills', 'Visual Diagnostics', 'Photo Drill']}
      onBackToHub={() => setView('diagnostic_hub')}
      onBack={() => setView('diagnostic_hub')}
    >
      <PhotoDrillSession onExit={() => setView('diagnostic_hub')} />
    </DrillShell>
  );
}
```

## Support

For questions or issues with the Diagnostic Drill Hub:

1. Check this guide for integration patterns
2. Review `DrillShell.tsx` and `DiagnosticDrillHub.tsx` source code
3. Test navigation flow with console logging
4. Ensure all drill components have `onExit` handlers
