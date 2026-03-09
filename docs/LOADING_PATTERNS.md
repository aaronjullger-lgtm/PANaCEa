# Loading & Skeleton Patterns

Use consistent loading components for a unified UX across the app.

## Patterns

### 1. Full-page route load (Suspense)

Use `Loader` with a contextual message for route-level lazy loading:

```tsx
<Suspense fallback={<Loader message="Loading practice modes…" />}>
  <PracticePage />
</Suspense>
```

**File:** `components/loading/Loader.tsx`

### 2. In-page section load (Suspense)

Use `Skeleton` for section/card placeholders inside a page:

```tsx
<Suspense fallback={<Skeleton height={256} className="rounded-xl" />}>
  <ActivityHeatmap ... />
</Suspense>
```

**File:** `components/loading/SkeletonLoader.tsx` (Skeleton)

### 3. Drill/session start

Use `DrillLoadingState` or `QuestionSkeleton` for drill mode loading:

```tsx
{isLoading ? (
  <DrillLoadingState message="Preparing your question…" variant="question" />
) : (
  <QuestionContent />
)}
```

**Files:** `components/drill/DrillLoadingState.tsx`, `components/loading/SkeletonLoader.tsx` (QuestionSkeleton)

### 4. Dashboard / Command Center

Use `CommandCenterSkeleton` for the main dashboard lazy load:

```tsx
<Suspense fallback={<CommandCenterSkeleton />}>
  <CommandCenterHub />
</Suspense>
```

**File:** `components/loading/SkeletonLoader.tsx` (CommandCenterSkeleton)

## Design tokens

All loading components use semantic tokens per the design system:

- `--color-bg-tertiary` for skeleton backgrounds (not pure black)
- `--color-text-muted` for secondary text
- `slate-700` / `slate-800` for skeleton pulse (blue-gray)

## Avoid

- Raw `<div className="animate-pulse bg-gray-800" />` — use Skeleton
- Ad hoc "Loading…" strings — use Loader with message
- `Loader2` icon without a consistent wrapper — use Loader for full-page, Skeleton for section
