# Privacy & Telemetry Storage Audit

**Date:** 2025-02-02  
**Scope:** Local vs Cloud, optimizer execution location, multi-device sync of ReviewLog/review history

---

## 1. "Client-Side WebAssembly" — MISLEADING ✅ (Architecture Differs)

### Screenshot / Documentation Claim

> "Optimization runs client-side using WebAssembly."

### Actual Implementation

| Component | Claimed | Actual |
|-----------|---------|--------|
| **Optimization execution** | Client-side WASM | **Server-side** (POST `/api/user/fsrs-params`) |
| **Algorithm** | WASM binding | L-BFGS in TypeScript (`lib/fsrs-optimizer.ts`) |
| **Data location** | Downloaded to client / IndexedDB | **Fetched on server** from PostgreSQL (UserProgress) |
| **Parameters storage** | Local | **Backend** (`PersonalizedFSRSParams` table) |

**Evidence:**

```typescript
// services/optimizer/fsrsOptimizer.ts
"This provides a simpler integration than client-side WASM while still delivering personalized parameters."
const response = await fetch('/api/user/fsrs-params', { method: 'POST', ... });
```

The client only triggers the API. The server loads `UserProgress.reviewHistory` from the database and runs the optimizer there. No WASM, no client-side optimization, no IndexedDB for review logs.

### Recommendation

- Update UI copy and docs to: "Optimization runs on our servers using your review history."
- Remove or correct any "client-side WASM" references.

---

## 2. Data Source & Sync — PARTIAL ⚠️

### Current Data Flow

| Step | Where | Data |
|------|-------|------|
| 1. User reviews | Client (any device) | Submits to `/api/drills/submit-review` |
| 2. Server writes | Edge/Cloudflare | `submitDrillReview` → `UserProgress` (fsrsCard, reviewHistory) |
| 3. Optimizer fetches | Server | `prisma.userProgress.findMany({ where: { userId } })` |
| 4. Optimizer runs | Server | L-BFGS on aggregated snapshots |

UserProgress lives in the backend database. All devices that successfully call submit-review update the same UserProgress records (by userId + conditionId). When optimization runs, it reads from the DB and therefore sees reviews from all devices.

### Sync Before Optimization

```typescript
// FSRSOptimizer.tsx
await syncManager.syncAll(token).catch(() => {});
```

`syncManager.syncAll()` syncs:

- **Pending answers** → `/api/questions/attempt` (QuestionAttempt, UserQuestionSeen)
- **Pending pearl actions** → pearl endpoints

It does **not** sync to the path that updates UserProgress. UserProgress is updated only by `submit-review` (drills/submit-review). The syncManager queue is for a different flow (questions/attempt).

### Gap: Offline / Failed submit-review

- QuizView calls both `queueAnswer` and `fetch(SUBMIT_REVIEW)`.
- If `submit-review` fails (offline, 4xx/5xx), it fails silently. There is no retry queue for submit-review.
- `queueAnswer` syncs to `questions/attempt`, which creates QuestionAttempt but does **not** update UserProgress.reviewHistory.
- Offline reviews that go through queueAnswer only will **never** appear in UserProgress and will be missing from optimization.

### ReviewLog Status

- ReviewLog is **not** written in production (per prior audit).
- When it is added, it should be written server-side in the same flow as UserProgress (e.g. in `submitDrillReview`). Then it will be centralized in the DB, and multi-device sync is not an issue as long as all devices hit the same API.

---

## 3. Multi-Device Sync Risk — MITIGATED (with caveats)

### Scenario

> User reviews on Phone, then runs optimization on Laptop. Does the Laptop optimizer see Phone reviews?

### Answer

**Yes, if**:

- Phone reviews were submitted via `submit-review` and reached the server.
- UserProgress is updated server-side on submit.

Optimization runs on the server and reads from the database. It does not depend on the device that triggers it. All devices share the same UserProgress records.

### Exceptions

1. **Offline reviews** that are only queued to `queueAnswer` and synced to `questions/attempt` never reach UserProgress and are excluded from optimization.
2. **ReviewLog**: When introduced, it must be written server-side in the same flow. Then it will be synced by design (single source of truth in the DB).

---

## 4. Recommendations

1. **Clarify documentation**
   - State that optimization runs **server-side**.
   - Remove or correct references to "client-side WASM" and "ReviewLogs downloaded to client."

2. **ReviewLog implementation**
   - When adding ReviewLog writes, do so **server-side** in `submitDrillReview` (or equivalent).
   - Ensure no client-only storage of review history for optimization.

3. **submit-review retry**
   - Add a retry queue for failed submit-review calls (similar to syncManager for answers).
   - On success, ensure UserProgress (and eventually ReviewLog) is updated so offline reviews eventually reach the optimizer.

4. **syncManager vs submit-review**
   - Document that `syncManager.syncAll` flushes questions/attempt data, but UserProgress is updated only by submit-review.
   - Consider whether queueAnswer flows should also update UserProgress (or a parallel path) so offline sessions contribute to optimization once synced.

---

## 5. Summary

| Check | Status | Notes |
|-------|--------|-------|
| Optimization runs client-side | ❌ No | Runs server-side via API |
| ReviewLogs in IndexedDB | ❌ No | Not used; data in PostgreSQL |
| Full history for optimization | ✅ Yes | Server fetches all UserProgress for user |
| Multi-device consistency | ✅ Yes | Single DB source; optimizer device-agnostic |
| Offline reviews in optimizer | ⚠️ Partial | Only if submit-review succeeded; queueAnswer path does not update UserProgress |

---

## 6. References

- FSRSOptimizer: `components/settings/FSRSOptimizer.tsx`
- fsrsOptimizer service: `services/optimizer/fsrsOptimizer.ts`
- fsrs-params API: `functions/api/user/fsrs-params.ts`
- syncManager: `lib/services/sync/syncManager.ts`
- submit-review: `functions/api/drills/submit-review.ts`, `lib/services/drillReviewService.ts`
- questions/attempt: `functions/api/questions/attempt.ts`
