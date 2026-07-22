# Optimizer UI Logic Audit

**Date:** 2025-02-02  
**Scope:** Minimum sample size, outlier filtering, "Optimize Algorithm" button behavior

---

## 1. Minimum Sample Size — PARTIAL ⚠️

### Issue

> 50 reviews is extremely low for machine learning convergence. The default weights are often better than weights trained on n=50.

### Current Implementation

| Location | Threshold | Enforcement |
|----------|-----------|-------------|
| `lib/fsrs-optimizer.ts` | `MIN_REVIEWS_FOR_OPTIMIZATION = 500` | ✅ Correct |
| `functions/api/user/fsrs-params.ts` | Uses `canOptimize(allSnapshots.length)` | ✅ Returns 400 INSUFFICIENT_DATA if < 500 |
| `FSRSOptimizer.tsx` (UI) | Info text: "Requires 500+ valid reviews" | ✅ Correct messaging |
| **Optimize button** | Not disabled when `canOptimize === false` | ❌ User can click with &lt; 500 reviews |

### Finding

- The backend already requires 500+ reviews; optimization is rejected for smaller datasets.
- The UI correctly states "Requires 500+ valid reviews" and "Need X more reviews for personalization."
- The **Optimize button is not disabled** when `canOptimize` is false. Users with &lt; 500 reviews can click and receive a 400 error instead of a disabled button.

### Note on CMRR Optimizer

`lib/cmrr-optimizer.ts` uses `MIN_REVIEWS_FOR_OPTIMIZATION = 50` for CMRR (Compute Minimum Recommended Retention). That is a separate, lighter-weight calculation, not the FSRS parameter optimizer.

### Recommendation

1. **Disable the button when `!canOptimize`** in `FSRSOptimizer.tsx`:
   ```tsx
   disabled={isOptimizing || !canOptimize}
   ```
2. Keep the 500 threshold; no change needed there.

---

## 2. Outlier Filtering — NOT IMPLEMENTED ❌

### Risks

1. **Duration &lt; 500ms** — Impossible reading speed; indicates rapid-guessing or spam.
2. **Rating variance 0** — User pressed the same rating for everything (e.g. all "Easy"), not meaningful for optimization.

### Current Data Path

The optimizer uses **`UserProgress.reviewHistory`**, which stores `ReviewSnapshot`:

```typescript
// lib/fsrs.ts - ReviewSnapshot
{
  date: string;      // ISO
  stability: number;
  difficulty: number;
  rating: Rating;    // 1-4
  state: FSRSState;
}
```

**ReviewSnapshot does not include duration.** The current optimization pipeline cannot filter by duration.

### Where Duration Exists

| Location | Has duration? |
|----------|---------------|
| `UserProgress.reviewHistory` (ReviewSnapshot) | ❌ No |
| `ReviewLog` (when populated) | ✅ Yes (`duration` / `responseTimeMs`) |
| `QuestionAttempt` | ✅ Yes (`durationMs`, `telemetryJson`) |

### Finding

- **Duration filter**: Not possible with the current data source. When the optimizer switches to ReviewLog (per prior audit), add: exclude reviews where `duration < 500` (or `responseTimeMs < 500`).
- **Rating variance filter**: Can be implemented today. Before feeding snapshots to `runFullOptimization`, reject if all ratings are identical (variance 0). Alternatively, reject per-day sessions where rating variance is 0.

### Recommendation

1. **Add sanity filter before optimization** (in `functions/api/user/fsrs-params.ts` or in `runFullOptimization` / `convertSnapshots`):
   - Compute rating variance of the snapshot set.
   - If variance is 0 (all same rating), return 400 with message like "Insufficient rating diversity for optimization."
2. **When using ReviewLog**, add:
   - Exclude reviews where `duration < 500` (ms).
   - Optionally exclude days where all reviews have the same rating (per-day variance 0).

---

## 3. Sanity Filter Implementation Sketch

### Rating variance check (implementable now)

```typescript
function hasRatingDiversity(ratings: number[]): boolean {
  if (ratings.length < 2) return false;
  const unique = new Set(ratings);
  return unique.size > 1;
}

// Before runFullOptimization:
const ratings = allSnapshots.map(s => s.rating);
if (!hasRatingDiversity(ratings)) {
  return createErrorResponse(
    request,
    'Optimization requires variety in your ratings (mix of Again/Hard/Good/Easy). All identical ratings cannot be optimized.',
    400,
    'INSUFFICIENT_RATING_DIVERSITY',
    env
  );
}
```

### Duration filter (when ReviewLog is used)

```typescript
// When querying ReviewLog:
const reviews = await prisma.reviewLog.findMany({
  where: {
    userId,
    review_type: 'real',
    duration: { gte: 500 },  // Exclude < 500ms
    // ...
  },
  // ...
});
```

### Per-day variance filter (optional, for ReviewLog)

Group reviews by `review_date` (day), compute rating variance per day. Exclude days where variance is 0. More complex; can be a follow-up.

---

## 4. Summary

| Check | Status | Action |
|-------|--------|--------|
| Minimum 500 reviews | ✅ Implemented | Keep as is |
| Button disabled when &lt; 500 | ❌ Not implemented | Add `disabled={!canOptimize}` |
| Exclude duration &lt; 500ms | ❌ Not possible | Add when using ReviewLog |
| Exclude rating variance 0 | ❌ Not implemented | Add sanity filter before optimization |

---

## 5. References

- FSRSOptimizer: `components/settings/FSRSOptimizer.tsx`
- fsrs-params API: `functions/api/user/fsrs-params.ts`
- MIN_REVIEWS: `lib/fsrs-optimizer.ts` line 146
- ReviewSnapshot: `lib/fsrs.ts` (createReviewSnapshot)
- ReviewLog schema: `prisma/schema.prisma` (duration, responseTimeMs)
