# TASK-024 — Close empty-binding `} catch {` swallow sites in dashboard widgets

- **Status:** completed
- **Date:** 2026-04-17
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** pending (batch with TASK-012 through TASK-023)
- **Category:** Async hygiene / observability
- **Priority / Risk / Size:** Low / Low / XS (6 files, 6 sites)
- **Audit reference:** Follow-up to TASK-023. Scoped to `components/dashboard/` because that is Aaron's first-load surface on every session — breadcrumbs here have the highest observability ROI. Triggered by `async-state-hardening` rule: "No empty-binding `} catch {` without re-throw or fallback, especially in user-facing mutation handlers."

## Verify-first block

Grep for `\} catch \{` across `components/dashboard/**/*.{ts,tsx}` returned **exactly 6 sites across 6 files**:

```
DailyTriad.tsx:102                                    (markTriadReviewed failure)           level: warn
TopicMasteryBreakdown.tsx:41                          (topic-progress fetch failure)        level: warn
StudyPathDashboard/PlanAlternativesModal.tsx:50       (plan-select mutation failure)        level: warn
RecommendationFeed.tsx:75                             (localStorage cache parse failure)    level: debug
DashboardPage.tsx:312                                 (localStorage.setItem rejection)      level: debug
UnifiedDashboard/index.tsx:141                        (localStorage.setItem rejection)      level: debug
```

Total: **6 sites, 6 files, 0 sites that should re-throw.**

All are either (a) a user-facing mutation whose failure is shown via toast/error-state but the underlying error object is lost, or (b) a benign fallback (cache parse, storage quota) where throwing would be wrong but silence leaves zero signal for dev-tools diagnosis.

## What was changed

Every site converts `} catch {` to `} catch (<name>Err) {` with a tagged `console.warn` (user-affecting) or `console.debug` (benign-expected) added as the first statement of the catch block. Existing side effects (`setError`, `toast.error`, `setTimeout` auto-clear, `setMarkError`, fall-through to network fetch) are fully preserved.

### 1. `DailyTriad.tsx` — warn

- **Line 102** (`handleMarkReviewed`): `} catch {` → `} catch (markErr) { console.warn('[DailyTriad] Mark-reviewed failed', markErr); ... }`
- Rationale: student-facing "mark the daily triad as reviewed" action. If the mutation fails (auth expiry, API outage), we set `markError` true with a 3s auto-clear — but the underlying error is lost. A warn log preserves the error for console-dev-tools inspection without changing user-visible behavior.

### 2. `TopicMasteryBreakdown.tsx` — warn

- **Line 41** (`fetchData` in `useEffect`): `} catch {` → `} catch (fetchErr) { console.warn('[TopicMasteryBreakdown] Fetch failed', { conditionId, error: fetchErr }); ... }`
- Rationale: both the non-OK branch (line 39) and the thrown-error branch (line 41) set the same user-facing error message ("Unable to load topic mastery data"), which is fine for UX — but the thrown-error branch completely loses the error. Structured log includes `conditionId` for correlation with backend logs.

### 3. `StudyPathDashboard/PlanAlternativesModal.tsx` — warn

- **Line 50** (`handleSelectAlternative`): `} catch {` → `} catch (selectErr) { console.warn('[PlanAlternativesModal] Plan selection failed', { planId, error: selectErr }); ... }`
- Rationale: user just clicked "select this alternative plan" — a PUT to `/api/study-path/accept`. Failure shows a toast but loses the real error. Structured log includes the `planId` that was attempted, which is essential for debugging "I picked plan X and it didn't save."

### 4. `RecommendationFeed.tsx` — debug

- **Line 75** (inner try inside `fetchRecommendations` cache branch): `} catch {` → `} catch (parseErr) { console.debug('[RecommendationFeed] Cache parse failed, refetching', parseErr); }`
- Rationale: `JSON.parse(cached)` failed — the cache schema changed or the entry is corrupted. Fall-through to network fetch is correct (the comment already said so); we keep that behavior. Debug level (not warn) because this fires on every schema migration without being a bug.

### 5. `DashboardPage.tsx` — debug

- **Line 312** (view-persistence `useEffect`): `} catch {` → `} catch (storageErr) { console.debug('[DashboardPage] localStorage write rejected', storageErr); }`
- Rationale: `localStorage.setItem` rejects when storage is disabled, quota is exceeded, or the user is in Safari private mode. Expected-in-normal-operation; debug level keeps the console clean but preserves the error when someone is actually diagnosing storage issues.

### 6. `UnifiedDashboard/index.tsx` — debug

- **Line 141** (identical view-persistence `useEffect`): same pattern as DashboardPage.tsx.
- Rationale: same as above. These two files share the same localStorage persistence pattern; consolidating them into a shared `usePersistedView` hook is a follow-up, not in scope here.

## Verification

- **Pattern check:** `grep -n '\} catch \{' components/dashboard/**/*.{ts,tsx}` returns **zero** hits post-sweep.
- **Tagged-log presence:** `grep -nE 'console\.(warn|debug).*\[(DailyTriad|TopicMasteryBreakdown|PlanAlternativesModal|RecommendationFeed|DashboardPage|UnifiedDashboard)\]'` returns exactly **6** sites — one per edit. Tag naming matches the `[ComponentName]` convention used by prior TASKs.
- **Behavior preservation:** every new catch is non-throwing and preserves all prior side effects (`setError`, `setMarkError`, `setTimeout`, `toast.error`, `toast.success`, fall-through to network). No control-flow change.
- **No re-throw upgrades:** deliberately kept — re-throwing any of these would cause real regressions (uncaught promise rejection in mutation flow, aborted cache-then-fetch pipeline, React effect error-boundary trip on storage reject).
- **Audit state unchanged:** 176/8/3/2 PASS/WARN_OUT_OF_BAND/WARN_MANUAL_ONLY/FAIL — frontend-only change, no API surface touched.
- **Typecheck impact:** arrow/catch parameters are implicitly `unknown` under strict mode and `console.*` accepts `unknown`. No new TS errors expected on touched files.

## Residual swallow inventory

After this sweep, the remaining `} catch {` sites in the repo (~100 outside `components/dashboard/`) fall into three buckets, scanned but not touched in this task:

- **Legitimate parse-fallback / graceful-fail** in test fixtures, migration scripts, one-shot utilities, and init-time localStorage reads (e.g., `useState` lazy initializers). These do not benefit from warn/debug logs.
- **Service-layer catches** in `lib/services/**` that already log via their own observability helpers (structured `console.warn('[serviceName] ...')` patterns) — no empty bindings.
- **Component-layer catches** outside `components/dashboard/` that are already-scoped candidates for future TASKs (e.g., `components/session/`, `components/drill/`, `components/osce/`). These are higher-risk touches and should be done in their own sprints with component-specific verification.

The "silent swallow in dashboard widgets" subset is now **fully closed**.

## Follow-ups

- Consolidate the duplicated `localStorage.setItem(DASHBOARD_VIEW_KEY, view)` persistence effect between `DashboardPage.tsx` and `UnifiedDashboard/index.tsx` into a shared `usePersistedView` hook. XS-sized refactor; no algorithmic change. Can fold into a future repo-hygiene sprint.
- Next autonomous-queue candidate: either (a) the `components/session/` + `components/drill/` empty-binding catches (higher risk, need per-site review), or (b) the unguarded-`.map()` audit on `possibly-undefined` data in dashboard widgets that haven't been read yet (~40+ widgets). Favor (b) next since it targets actual crash vectors rather than observability-only.
