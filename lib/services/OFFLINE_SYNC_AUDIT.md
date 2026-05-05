# Offline Sync Modules Audit

## Current State (updated 2026-05)

There are three offline/sync-related modules with overlapping concerns:

### 1. `lib/services/sync/offlineSync.ts`
- **Purpose**: Queue operations for SRS, performance, etc. when offline; dead letter queue for failed ops.
- **API**: `queueOperation`, `flushPendingToLocalStorage`, `getDeadLetterQueue`, `processPendingOperations`
- **Storage**: `panceai_offline_queue`, `panceai_offline_dead_letter`
- **Used by**: App.tsx, FailedSyncItems, syncManager

### 2. `lib/services/offlineSyncService.ts`
- **Purpose**: Delta sync for performance/SRS/savedQuestion/achievement/streak; conflict resolution.
- **API**: `queueSyncOperation`, `getSyncStatus`, `syncPendingOperations`, `setupAutoSync`
- **Storage**: `panacea_pending_sync_ops`, `panacea_last_sync_time`, `panacea_offline_mode`
- **Used by**: OfflineSyncIndicator

### 3. `lib/services/offline/offlineSyncService.ts`
- **Purpose**: Generic HTTP request queue (queue URL + options); used for review submission.
- **API**: `OfflineSyncService.queueRequest`, `processQueue`, `getQueue`
- **Storage**: `offline-sync-queue`
- **Used by**: OfflineSyncPanel, reviewSubmissionService

## Recommendation

**Short term**: Keep as-is. Each module serves a distinct use case (typed operations vs generic requests; different storage keys avoid collisions).

**Long term**: Consider consolidating into a single `OfflineSyncCoordinator` that:
- Accepts typed operations (SRS, performance, etc.) and generic requests
- Uses a unified queue format with `type` discriminator
- Shares retry logic and dead-letter handling

## User-Facing Copy

**OfflineSyncIndicator** (`components/offline/OfflineSyncIndicator.tsx`) is the single user-facing entry for offline/sync status. All user-visible copy (e.g. "You're offline", "Changes will sync when connection is restored", "N pending", "Up to date") lives there.

## Key Files

| Consumer | Module |
|----------|--------|
| App.tsx (flushPendingToLocalStorage) | sync/offlineSync |
| OfflineSyncIndicator | offlineSyncService (root) |
| reviewSubmissionService | offline/offlineSyncService |
| FailedSyncItems | sync/offlineSync |
