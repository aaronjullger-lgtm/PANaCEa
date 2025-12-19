# DrillShell Migration Guide

## Overview
`DrillShell` is a standardized layout component that unifies the UX across all drill modes. It replaces custom headers and layout code with a consistent, responsive wrapper.

## Component API

```typescript
interface DrillShellProps {
  title: string;              // Drill mode name (e.g., "Rapid Recall")
  subtitle?: string;          // Optional breadcrumb (e.g., "Buzzword Recognition")
  rightAction?: ReactNode;    // Optional slot for score/streak/timer
  onExit: () => void;         // Back to dashboard handler
  children: ReactNode;        // Main content
  fullWidth?: boolean;        // Remove max-width constraint
  noPadding?: boolean;        // Remove padding for edge-to-edge content
  fullScreen?: boolean;       // Use fixed positioning for immersive mode
  backgroundColor?: string;   // Override background (e.g., dark for imaging)
  contentClassName?: string;  // Custom classes for content wrapper
}
```

## Migration Checklist

### For Standard Drill Modes (e.g., RapidRecallDrill, MiniLabDrill)

**Before:**
```tsx
<div className="min-h-screen bg-[var(--color-bg-primary)]">
  <header className="sticky top-0 ...">
    <button onClick={onExit}>Exit</button>
    <h1>Rapid Recall</h1>
    <div>Score: {score}</div>
  </header>
  <main className="max-w-4xl mx-auto px-4 py-6">
    {/* Content */}
  </main>
</div>
```

**After:**
```tsx
<DrillShell
  title="Rapid Recall"
  subtitle="Buzzword Recognition"
  onExit={onExit}
  rightAction={
    <div className="text-sm font-semibold">
      {score} / {totalAttempts}
    </div>
  }
>
  {/* Content - no wrapper needed */}
</DrillShell>
```

### For Immersive Modes (e.g., PhotoDrill, ImagingDrill)

**Before:**
```tsx
<div className="fixed inset-0 bg-slate-950">
  <header className="absolute top-0 w-full ...">
    <button onClick={onExit}>
      <X /> Exit
    </button>
    <h1>Photo Drill</h1>
    <div>Streak: {streak}</div>
  </header>
  <main className="w-full h-full pt-16">
    {/* Content */}
  </main>
</div>
```

**After:**
```tsx
<DrillShell
  title="Photo Drill"
  subtitle="ECG Interpretation"
  fullWidth={true}
  noPadding={true}
  fullScreen={true}
  backgroundColor="bg-slate-950"
  onExit={onExit}
  rightAction={
    <div className="flex items-center gap-3">
      <Flame className="w-5 h-5" />
      <span>{streak}</span>
    </div>
  }
>
  {/* Full-screen content */}
</DrillShell>
```

## Common Patterns

### Pattern 1: Score + Streak Display
```tsx
rightAction={
  <div className="flex items-center gap-4">
    <div className="flex items-center gap-1">
      <Flame className={`w-5 h-5 ${streak > 0 ? 'text-orange-500' : 'text-gray-500'}`} />
      <span className="font-semibold">{streak}</span>
    </div>
    <div className="text-sm">
      {score}/{totalAttempts}
    </div>
  </div>
}
```

### Pattern 2: Timer Display
```tsx
rightAction={
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20">
    <Clock className="w-4 h-4 text-blue-500" />
    <span className="text-sm font-mono">{formatTime(timeRemaining)}</span>
  </div>
}
```

### Pattern 3: Settings Button
```tsx
rightAction={
  <button
    onClick={() => setShowSettings(true)}
    className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]"
  >
    <Settings className="w-5 h-5" />
  </button>
}
```

## Benefits

✅ **Consistency**: All drills look and feel the same  
✅ **Responsive**: Mobile/tablet/desktop handled automatically  
✅ **Maintainable**: Update header styling once, affects all drills  
✅ **Accessible**: Proper ARIA labels and keyboard navigation  
✅ **Flexible**: Support for both standard and immersive layouts  
✅ **Clean Code**: Separates layout concerns from drill logic  

## Files to Migrate

Priority order for maximum impact:

1. ✅ **PhotoDrillSession.tsx** - Example completed
2. **RapidRecallDrill.tsx** - Standard mode with score display
3. **DDxCompareDrill.tsx** - Standard mode with timer
4. **MiniLabDrillSession.tsx** - Uses MiniDrillLayout (can replace)
5. **PharmDrillSession.tsx** - Standard mode
6. **FirstLineDrillSession.tsx** - Standard mode
7. **ConditionDrillSession.tsx** - Standard mode
8. **GuidelineDrillSession.tsx** - Standard mode
9. **FluidElectrolyteMode.tsx** - Specialized mode
10. **AntibioticMode.tsx** - Specialized mode
11. **PatientEncounterMode.tsx** - Conversational mode
12. **CodeBlueSpeedMode.tsx** - Timed challenge
13. **GrandRoundsMode.tsx** - Daily challenge
14. **CramMode.tsx** - Study mode
15. **MedicalWordleMode.tsx** - Game mode

## Testing Checklist

After migration, verify:

- ✅ Back button returns to dashboard
- ✅ Title displays correctly
- ✅ Subtitle (if used) shows breadcrumb
- ✅ Right action slot works (score/timer/settings)
- ✅ Content renders properly on mobile
- ✅ Full-screen modes use entire viewport
- ✅ Header sticky behavior works on scroll
- ✅ Theme toggle affects header correctly
- ✅ Dark mode styling consistent

## Notes

- The `MiniDrillLayout` component can be **deprecated** after migration
- `DrillShell` uses the same glass header styling as `App.tsx`
- For full-screen modes, use `fullScreen={true}` + `noPadding={true}` + `fullWidth={true}`
- Background color can be customized per-mode (e.g., dark for imaging)
