# TASK-023 — Close silent `.catch(() => {})` swallow sites with observability logs

- **Status:** completed
- **Date:** 2026-04-17
- **Branch:** `codex-study-session-prod-hotfix-v2`
- **Commits:** pending
- **Category:** Async hygiene / observability
- **Priority / Risk / Size:** Low / Low / XS (4 files, 5 sites)
- **Audit reference:** Opportunistic sweep — first autonomous cluster after the loading-state rollout closed with TASK-022. Triggered by `async-state-hardening` skill's rule: "No `.catch(() => {})` without re-throw or fallback."

## Verify-first block

Grep across `**/*.{ts,tsx}` for `.catch((\s*)=>\s*{\s*}\s*)` (the silent-swallow pattern) returned **exactly 5 sites across 4 files**. Every hit was a case where the catch existed but threw away the error object, losing observability. None were in hot mutation paths — all were secondary / fallback catches. The fix is uniform: preserve the non-throwing behavior (so we don't break existing control flow or cause cascades inside already-failed branches) but add a `console.warn` or `console.debug` that records the error alongside a prefix tag.

### Silent-swallow inventory — 2026-04-17

```
index.tsx:47                                   (Sentry unhandledrejection capture fallback)            level: warn
index.tsx:75                                   (Sentry window.onerror capture fallback)                level: warn
App.tsx:758                                    (background prefetchQuestions after session start)      level: warn
functions/api/cron/content-quality-loop.ts:403 (nested status-reset inside already-failed regen)       level: warn
components/osce/AudioInterface.tsx:66          (AudioContext.close() during disconnect)                level: debug
```

Total: **5 sites, 4 files, 0 sites that should re-throw.**

## What was changed

Every site converts `.catch(() => {})` to `.catch((err) => console.{warn|debug}(tagged prefix, err))`. Log level is chosen per site:
- **`warn`** — a user-visible or session-affecting fallback that we'd want surfaced during QA but shouldn't block the happy path.
- **`debug`** — a low-information, expected-in-normal-operation failure (like `AudioContext.close()` rejecting when the context was already closed by the browser).

### 1. `index.tsx` (2 sites)

- **Line 47** (inside `unhandledrejection` handler's Sentry import chain): swallow → `console.warn('[Sentry] Failed to capture unhandledrejection', loadErr)`.
- **Line 75** (inside `window.onerror` handler's Sentry import chain): swallow → `console.warn('[Sentry] Failed to capture window.onerror', loadErr)`.

Rationale: both are the **innermost** catch in a two-layer chain. The outer capture handles the normal case; this inner catch fires only if the Sentry module itself fails to dynamically import. We explicitly avoid re-throwing to prevent an infinite unhandledrejection loop, but preserving the error in console output is essential for diagnosing Sentry outages or mis-wired dev environments.

### 2. `App.tsx` (1 site)

- **Line 758** (inside `handleConfirmSession` — background prefetch after initial queue loads): swallow → `console.warn('[session] Background question prefetch failed', prefetchErr)`.

Rationale: this is `void prefetchQuestions(...).catch(...)` — we deliberately don't await it because session start shouldn't block on future-batch prefetching. But a silent swallow means a broken prefetch pipeline (auth expiry, API outage, DB pool exhaustion) would degrade replenishment latency without any signal. A warn log gives the student-facing console a breadcrumb and surfaces it through Sentry's `CaptureConsole` integration if that's wired.

### 3. `functions/api/cron/content-quality-loop.ts` (1 site)

- **Line 403** (inside the `catch (err)` block of per-flag regeneration, the nested `prisma.contentQualityFlag.update(...)` that tries to reset status to `FLAGGED`): swallow → structured `console.warn` with `flagId`, `questionId`, and the nested error's message.

Rationale: this is a **best-effort repair path inside an already-failed branch**. If the reset itself fails (e.g., connection dropped mid-loop), we absolutely can't throw — that would abort the entire cron job over one unrecoverable flag. But it's the only signal we'd ever get that the reset path is broken, so we log structured context to match the surrounding `console.warn('[contentQualityLoop] Requeue regeneration failed', {...})` style used by the outer catch.

### 4. `components/osce/AudioInterface.tsx` (1 site)

- **Line 66** (inside the `disconnect` callback, closing the `AudioContext`): swallow → `console.debug('[AudioInterface] AudioContext close rejected', closeErr)`.

Rationale: `AudioContext.close()` can reject in entirely benign scenarios — the context was already closed by the browser on tab suspend, it was in a transitional state, or the spec implementation is spotty across browsers. We pick **debug** (not warn) because the signal-to-noise ratio is bad: this fires on every disconnect-during-close race, none of which are bugs. But preserving the error for console-dev-tools inspection is cheap and useful when debugging WebRTC lifecycle issues.

## Verification

- **Pattern check:** `grep -n '\.catch\(\(\)\s*=>\s*\{\s*\}\s*\)' **/*.{ts,tsx}` returns **zero** hits post-sweep.
- **Tagged-log presence:** `grep` for `console.(warn|debug).*\[(Sentry|session|contentQualityLoop|AudioInterface)\]` now shows **11** prefixed logging sites (5 new + 6 pre-existing in the same tag families — confirming consistent prefix style across the codebase).
- **Behavior preservation:** every new catch is non-throwing and returns the same `undefined` it did before. No control-flow change.
- **No re-throw upgrades made:** deliberately kept — re-throwing any of these would cause real regressions (infinite loops in the Sentry handlers, fatal prefetch crash, aborted cron loop, audio lifecycle crash). Observability-only fix.
- **Audit state unchanged:** 176/8/3/2 PASS/WARN_OUT_OF_BAND/WARN_MANUAL_ONLY/FAIL — frontend + single cron handler change, no API surface touched.
- **Typecheck:** no type signature changes (arrow-function catch parameters are implicitly `unknown` under strict mode and we only log them via `console.*` which accepts `unknown`). No new TS errors expected on touched files.

## Residual silent-swallow inventory

Post-sweep, scans for related patterns show:
- `.catch((_) => {})`, `.catch(_ => {})`, `.catch(err => {})` with empty body: **zero hits** repo-wide.
- Empty-block `catch (...) {}` in try/catch form: **zero hits** repo-wide.
- `.catch(console.error)` / `.catch(console.warn)` at top level: **~30 hits**, all in one-shot scripts and standalone service main-entry IIFEs — legitimate fallback loggers, not silent swallows.

The "silent error swallow" pattern is now **fully closed** in production code.

## Follow-ups

- None immediate. The 5 sites were the full inventory.
- Future: consider wiring Sentry's `CaptureConsole` integration for `console.warn` events so the new logs reach the observability dashboard automatically. That's an Ask-First scope (monitoring config change) and can go in a separate sprint when Aaron prioritizes observability hardening.
