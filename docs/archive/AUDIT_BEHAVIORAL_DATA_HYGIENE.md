# Behavioral Data Hygiene Audit (FSRS Inputs)

**Date:** 2025-02-02  
**Scope:** Duration outliers + Answer-change timestamp consistency for FSRS rating derivation

---

## 1. The "Bathroom Break" Outlier — PARTIAL ⚠️

### Risk

> A user opens a question, goes to the bathroom, comes back 5 minutes later, and answers "Easy." FSRS sees duration = 300s for an "Easy" card. The optimizer might incorrectly learn that "Easy" cards require long thinking times.

### Current Implementation

| Layer | Behavior | Status |
|-------|----------|--------|
| **Implicit rating** (`lib/implicit-metrics.ts`) | `maxValidTime = 180000` (3 min). Responses > 3 min set `flagged: true` | ⚠️ Flags but does not exclude |
| **Rating derivation** | Uses full `timeToFirstClick` for latency ratio. A 300s response → `latencyRatio ≈ 10` → maps to `Rating.Hard` (not Easy) | ✅ Slow responses are downgraded |
| **Duration storage** | `QuestionAttempt.durationMs`, `telemetry.duration_ms` store raw value (e.g. 300000) | ❌ No cap; outliers stored as-is |
| **Schema validation** | `timeSpentMs`: max 3600000 (1 hr); `DrillSubmitReviewSchema`: 3600000 | ❌ Accepts 1-hour durations |
| **Optimization exclusion** | Flagged reviews are not excluded from FSRS update or from optimizer input | ❌ Still influence FSRS |

### Finding

- A 5‑minute bathroom break would be **flagged** and rated **Hard** (not Easy), so the worst-case “Easy with 300s” is mitigated.
- There is **no duration cap**; raw durations up to 1 hour are stored.
- Flagged reviews **still update FSRS** and flow into optimization via `UserProgress.reviewHistory`.
- When ReviewLog is populated, duration will be stored without clamping, potentially skewing analytics and any downstream logic that uses duration.

### Recommendation

1. **Duration cap (e.g. 60s)**  
   - For implicit rating: cap the effective latency used in the ratio to 60s before computing `latencyRatio`.  
   - For storage: clamp `duration` / `responseTimeMs` to 60s before persisting (or document that stored duration is capped).

2. **Exclude from optimization**  
   - When `duration > DURATION_CAP` (e.g. 60s), either:  
     - Mark the review as invalid (e.g. `rating = 0` or `exclude_from_optimization: true`), or  
     - Do not append to ReviewLog / do not include in optimizer input, while still keeping it in QuestionAttempt for history.

3. **Config constant**  
   Add `DURATION_CAP_MS = 60000` to `lib/implicit-metrics.ts` (alongside `maxValidTime`) and use it consistently for capping and exclusion.

---

## 2. The "Answer Change" Ambiguity — INCONSISTENT ⚠️

### Risk

> User clicks "A", hesitates, clicks "B", submits. Which timestamp counts as "Recall Time"?  
> - **Time to First Click** = purer measure of Retrievability (R)  
> - **Time to Submit** = reflects confidence checking, not just memory

### Requirement

> For FSRS, Time to First Click is usually the purer measure of R. Be consistent.

### Current Implementation

| Client / Path | Sends `timeToFirstClick`? | Fallback | Metric Used for Rating |
|---------------|---------------------------|----------|-------------------------|
| **use-condition-drill** | ✅ Yes (`finalMetrics.timeToFirstClick`) | — | Time to First Click |
| **SmartReviewMode** | ❌ No | — | `numericTime` (timeSpentMs) = Time to Submit |
| **QuizView** (session submit) | ✅ Via implicit metrics | — | Depends on payload |
| **drillReviewService** | `timeToFirstClick ?? numericTime` | `numericTime` | First Click when provided, else Submit |

### Code Reference

```typescript
// lib/services/drillReviewService.ts:237–239
const behaviorMetrics: ImplicitBehaviorMetrics = {
  timeToFirstClick: timeToFirstClick ?? numericTime,  // Fallback = Time to Submit
  // ...
};
```

`deriveImplicitRating()` uses `metrics.timeToFirstClick` for the latency ratio. When the client omits it, the server uses `numericTime` (total dwell / submit time).

### Additional Source: Telemetry

`TelemetrySchema` includes `time_to_first_interaction_ms`. If `telemetry` is present, it could be preferred over top-level `timeToFirstClick`. Currently:

- `use-condition-drill` does **not** send `telemetry`
- `SmartReviewMode` does **not** send `timeToFirstClick` or `telemetry`
- Preference order for `timeToFirstClick` is not defined when both top-level and telemetry exist

### Finding

- **Inconsistency:** Some clients send Time to First Click, others force fallback to Time to Submit.
- **SmartReviewMode** always uses Time to Submit for implicit rating.
- **drillReviewService** does not use `telemetry.time_to_first_interaction_ms` when building `behaviorMetrics`.

### Recommendation

1. **Prefer Time to First Click**  
   Use a single resolution order:
   ```
   timeToFirstClick = timeToFirstClick ?? telemetry?.time_to_first_interaction_ms ?? null
   ```
   If still `null`, only then fall back to `numericTime`, and log/warn that Time to Submit is being used.

2. **Update SmartReviewMode**  
   Instrument answer selection and send `timeToFirstClick` (and optionally telemetry) in the submit payload, consistent with `use-condition-drill`.

3. **Documentation**  
   Document that:
   - Implicit rating should use Time to First Click when available.
   - Time to Submit is a fallback only when first click is unknown.

---

## 3. Summary

| Check | Status | Action |
|-------|--------|--------|
| Duration cap (60s) | ❌ Not implemented | Add cap for rating + storage; optionally exclude from optimization |
| Exclude long-duration from optimization | ❌ Not implemented | Exclude or mark invalid when `duration > DURATION_CAP` |
| Time to First Click consistency | ⚠️ Partial | Prefer first click; add telemetry fallback; fix SmartReviewMode |
| Rapid guess (too fast) | ✅ Implemented | MVRT + `rapid_guess` flag |
| Slow response flag | ✅ Implemented | `maxValidTime` flags > 3 min |
| Slow response exclusion | ❌ Not implemented | Flagged reviews still affect FSRS |

---

## 4. References

- Implicit rating: `lib/implicit-metrics.ts` (deriveImplicitRating, DEFAULT_IMPLICIT_CONFIG)
- Review service: `lib/services/drillReviewService.ts` (behaviorMetrics, effectiveDurationMs)
- Telemetry: `types/telemetry.ts` (TelemetryData, time_to_first_interaction_ms)
- Clients: `hooks/game/use-condition-drill.ts`, `components/modes/SmartReviewMode.tsx`
- API: `functions/api/drills/submit-review.ts` (DrillSubmitReviewSchema, TelemetrySchema)
