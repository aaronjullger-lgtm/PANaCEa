# Comprehensive Audit — Post-Implementation

**Role:** Senior Full-Stack Architect & Quality Assurance Lead  
**Scope:** Plan fidelity, repo consistency, logic/security, brittleness/scalability, refactoring opportunities for the recent implementation (Commuter Mode, WASM Sync, AI Latency Masking, Battery Drain, DOM Bloat, Image Optimization).

---

## 1. Plan Fidelity

| Plan Item | Status | Edge Cases / Gaps |
|-----------|--------|-------------------|
| **Commuter Mode — Optimistic updates** | ✅ | QuizView queues via `syncManager.queueAnswer`; fire-and-forget for implicitMetrics/FSRS. No duplicate `recordQuestionAttempt` in QuizView. |
| **Commuter Mode — 50-card buffer** | ✅ | `INITIAL_QUEUE_SIZE` = 50 in App + SessionContext; QuizView `LOW_QUEUE_THRESHOLD` 20, `BATCH_SIZE` 25. |
| **WASM Sync — Merge review logs** | ✅ | `userProgressService.updateUserProgressWithHistory` uses atomic `array_append` for `reviewHistory`. |
| **WASM Sync — Re-hydration before optimize** | ✅ | FSRSOptimizer calls `syncManager.syncAll(token)` before `optimizeFSRSParameters`. |
| **AI Latency — Streaming** | ✅ | Virtual OSCE debrief and Quiz "Explain differently" use streaming; Core PANCE uses pre-generated rationale. |
| **Battery Drain — FSRS in worker** | ✅ | FSRS runs server-side only; documented. |
| **Battery Drain — Low power + GPU** | ✅ | `useLowPowerMode` (getBattery + prefers-reduced-motion); GPU layers and animation gating in MomentumIndicator, ActivityHeatmap, StreakFlame, IntelligenceHub, SystemRadarChart, SystemComparison. |
| **DOM Bloat — Virtualization** | ✅ | QuestionPerformanceDashboard uses VirtualizedTableBody; VirtualizedPerformanceRecordList exists for future History tab. |
| **Image Optimization — Zoom on demand** | ✅ | API returns `thumbnailUrl` + `highResUrl`; PhotoDrillSession shows thumbnail first, "Full resolution" loads high-res. |
| **Image Optimization — Preload next** | ✅ | PhotoDrillSession preloads `queue[currentCaseIndex + 1]` thumbnail in background. |

**Omissions:** None critical. Optional: pan/zoom gesture UI for high-res image (currently swap only); History tab not yet implemented (component ready).

---

## 2. Repo Consistency

- **Naming:** New hooks `useLowPowerMode`, `useReducedMotion`; components `VirtualizedTableBody`, `VirtualizedPerformanceRecordList` follow PascalCase/camelCase. Audit docs use `AUDIT_*.md`.
- **Folder structure:** Hooks in `hooks/`, UI in `components/ui/` or `components/analytics/`, API in `functions/api/`, shared lib in `lib/` — matches project.
- **Styling:** Tailwind + CSS variables (`var(--color-*)`), Lucide icons — consistent.
- **Edge runtime:** No Node APIs in `functions/`; Prisma via `createEdgePrismaClient(context.env.DATABASE_URL)`.
- **Minor:** `resolveImageUrl` lives only in PhotoDrillSession; if reused elsewhere, move to `lib/` (e.g. `lib/utils/imageUrl.ts`).

---

## 3. Logic & Security

### Critical / High

1. **useLowPowerMode — Battery listener leak (race)**  
   `batteryCleanup` is assigned inside `getBattery().then()`. If the component unmounts before the promise resolves, the effect cleanup runs with `batteryCleanup` still `undefined`, so battery listeners are never removed. **Fix:** Store cleanup in a ref set inside the `.then()`, and in the effect cleanup call `ref.current?.()`. (See Critical Fixes below.)

2. **FSRSOptimizer — Silent sync failure**  
   `syncManager.syncAll(token).catch(() => {})` swallows errors. If sync fails, the user may optimize on stale data without feedback. **Recommendation:** At least log; optionally show a non-blocking toast ("Sync had issues; other devices may have newer data").

3. **Media API — Public endpoint**  
   `/api/drills/media` is public (no auth). Documented as intentional for reference data. Ensure MediaAsset only exposes approved, non-PII content; no change required if already constrained.

### Data fetching & state

- **SyncManager → /api/questions/attempt:** Payload matches Attempt schema (`questionId`, `wasCorrect`, `timeSpentMs`, `system`, `conditionId`, `mode: 'session'`). No double-record from QuizView (attempt path is queue-only).
- **API response shape:** Media API returns `{ data: PhotoCase[] }`; `use-photo-drill` now uses `body?.data` when not array — correct.
- **Env:** Functions use `context.env` / `env.DATABASE_URL`, `env.GEMINI_API_KEY`; no `process.env` in Edge handlers — correct.

---

## 4. Holes & Scalability

- **VirtualizedTableBody:** Depends on `parentRef.current` being set. If the parent is conditionally rendered or ref is attached late, first frame may have no scroll element; TanStack Virtual tolerates null. No hard failure.
- **PhotoDrillSession preload:** Uses `queue[currentCaseIndex + 1]`. If queue is refilled asynchronously, index may briefly be out of bounds; guard `if (!nextCaseData) return` is present — OK.
- **userProgressService atomic append:** Uses raw `array_append`. If Prisma or DB schema changes `reviewHistory` type, the raw SQL could break. Document that this path is sensitive to schema.
- **SyncManager retry:** `scheduleRetry` uses a simple backoff. Under heavy load, many pending answers could cause repeated sync bursts; consider rate-limiting or batching if needed later.
- **Image optimization:** When both `thumbnailUrl` and `highResUrl` are null/undefined, `imageUrl` is used everywhere; behavior is correct. If the API ever returns only `originalUrl` and no thumbnail, current mapping still yields one URL for display.

---

## 5. Refactoring Opportunities

- **resolveImageUrl:** Duplicated only in PhotoDrillSession. Extract to e.g. `lib/utils/resolveImageUrl.ts` (or `lib/utils/media.ts`) and reuse for any drill or media URL resolution.
- **VirtualizedPerformanceRecordList:** Not yet used. When adding a History tab, pass a scroll container ref and `performanceData`; avoid mapping full array to DOM.
- **VirtualizedTableBody empty state:** Returns a single div for "No data"; QuestionPerformanceDashboard passes custom `emptyMessage`. Consistent; no change required.
- **Low-power vs reduced-motion:** Several components use both `useLowPowerMode` and `useReducedMotion` (e.g. StreakFlame). Pattern is clear; could add a small helper `useReduceAnimations()` that returns `useReducedMotion() || useLowPowerMode()` if more components need the same combo.

---

## 6. Summary

| Category | Critical Fixes | Logical Omissions | Technical Debt | Verification Steps |
|----------|----------------|-------------------|----------------|--------------------|
| **Count** | 1 (battery cleanup race) | 0 | 3 (silent sync, resolveImageUrl, reduceAnimations helper) | 5 |

---

## Verification Steps

1. **Commuter / Sync:** Offline, answer a question → go online → confirm `/api/questions/attempt` is called and attempt appears (e.g. in DB or dashboard). Confirm no duplicate attempt for one answer.
2. **Battery / Low power:** In DevTools throttle or use a device with low battery; confirm heavy animations (e.g. heatmap cells, streak flame) are reduced or instant. Toggle `prefers-reduced-motion` and recheck.
3. **Virtualization:** Open admin Question Performance table with 100+ rows; scroll and confirm only a small number of row DOM nodes (inspect Elements). Confirm no layout jump.
4. **Image optimization:** Use Photo Drill with an asset that has both thumbnail and original; confirm first paint is thumbnail and "Full resolution" loads the high-res image. Confirm next-case image preload (e.g. Network tab) when advancing.
5. **FSRS re-hydration:** With pending offline answers, open Settings → run FSRS Optimizer; confirm sync runs first (e.g. network or logs) and optimization completes without error.
