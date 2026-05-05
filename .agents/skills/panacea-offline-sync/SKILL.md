---
name: "panacea-offline-sync"
description: "Use this skill for PANaCEa offline-first behavior, PWA cache, sync queues, queued answers, retry/idempotency, service worker behavior, local persistence, tab close recovery, stale data, and bugs where user progress can be lost or duplicated."
---

# PANaCEa Offline Sync

Use when the task touches reliability across bad networks, reloads, tab close, duplicate submissions, or PWA caching.

## First Files

- `lib/services/sync/syncManager.ts`
- `lib/services/sync/offlineSync.ts`
- `lib/services/sync/offlineStore.ts`
- `utils/preferencesSync.ts`
- `components/session/QuizView.tsx` for answer/session recovery
- `vite.config.ts` and `public/manifest*` for PWA/service worker behavior
- `functions/api/_shared/submission-idempotency.ts`
- `functions/api/_shared/__tests__/submission-idempotency.test.ts`
- `lib/services/OFFLINE_SYNC_AUDIT.md` if the task is broad

## Reliability Rules

- Student progress must be at-least-once queued client-side and exactly-once or idempotent server-side.
- Preserve stable submission IDs across retries.
- Do not advance/dismiss critical UI state unless queue or server persistence has accepted the event.
- Tab-close flushing must be lightweight and must not depend on React state being current.
- Rehydration must distinguish "no saved session" from corrupt or stale saved session.

## PWA Rules

- Do not cache authenticated API responses with generic public strategies.
- Keep static asset caching separate from clinical/content freshness rules.
- If service worker behavior changes, verify update/refresh paths and offline fallback behavior.
- Respect existing cache ID/versioning in `vite.config.ts`.

## Debug Workflow

1. Identify the event that can be lost or duplicated.
2. Trace client state -> local queue/store -> network call -> endpoint idempotency -> server writes.
3. Check retry/backoff and how conflicts are resolved.
4. Add a test for duplicate submit or failed-first retry before changing broad flow code.
5. Verify online, offline, reload, and rapid double-submit cases when feasible.

## Validation

- Targeted Vitest for queue/idempotency helpers.
- `npm run typecheck` when contracts change.
- Playwright for session flows, reload recovery, or PWA behavior.
- Manual browser test if service worker caching is involved.

## Common Traps

- Generating a new submission ID on every retry
- Letting a queued answer update local stats twice
- Caching `/api/*` responses in the service worker without auth/freshness analysis
- Assuming `navigator.onLine` means the API is reachable
- Fixing reload recovery in one session mode while drill modes still drop state
