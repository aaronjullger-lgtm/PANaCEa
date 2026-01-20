/**
 * Offline-first sync service with delta syncing
 * Ensures app works 100% offline and syncs when connection returns
 * Critical for hospitals with poor connectivity (lead-lined walls, etc.)
 */

// Debug logging - set to true to re-enable verbose logs
const DEBUG_OFFLINE_SYNC = false;

interface SyncOperation {
  id: string;
  type: 'performance' | 'srs' | 'savedQuestion' | 'achievement' | 'streak';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retries: number;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: Array<{
    operation: SyncOperation;
    reason: string;
  }>;
}

interface ConflictResolution {
  strategy: 'client-wins' | 'server-wins' | 'newest-wins' | 'merge';
}

/**
 * Maximum number of operations to sync in a single batch
 */
const BATCH_SIZE = 50;

/**
 * Maximum retry attempts for failed operations
 */
const MAX_RETRIES = 3;

/**
 * LocalStorage keys
 */
const STORAGE_KEYS = {
  PENDING_OPS: 'panacea_pending_sync_ops',
  LAST_SYNC: 'panacea_last_sync_time',
  OFFLINE_MODE: 'panacea_offline_mode',
};

/**
 * Queue an operation for syncing
 */
export function queueSyncOperation(
  type: SyncOperation['type'],
  operation: SyncOperation['operation'],
  data: any
): void {
  try {
    const op: SyncOperation = {
      id: generateOperationId(),
      type,
      operation,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    const pending = getPendingOperations();
    pending.push(op);
    savePendingOperations(pending);

    if (DEBUG_OFFLINE_SYNC) console.log(`[OfflineSync] Queued ${operation} ${type} operation`);
  } catch (error) {
    console.error('[OfflineSync] Failed to queue operation:', error);
  }
}

/**
 * Get all pending operations
 */
function getPendingOperations(): SyncOperation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PENDING_OPS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[OfflineSync] Failed to get pending operations:', error);
    return [];
  }
}

/**
 * Save pending operations
 */
function savePendingOperations(operations: SyncOperation[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PENDING_OPS, JSON.stringify(operations));
  } catch (error) {
    console.error('[OfflineSync] Failed to save pending operations:', error);
  }
}

/**
 * Generate a unique operation ID
 */
function generateOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get offline mode status
 */
export function isOfflineMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.OFFLINE_MODE) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set offline mode
 */
export function setOfflineMode(offline: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_MODE, offline.toString());
  } catch (error) {
    console.error('[OfflineSync] Failed to set offline mode:', error);
  }
}

/**
 * Sync all pending operations
 */
export async function syncPendingOperations(
  authToken?: string,
  conflictResolution: ConflictResolution = { strategy: 'newest-wins' }
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    conflicts: [],
  };

  try {
    if (!isOnline()) {
      if (DEBUG_OFFLINE_SYNC) console.log('[OfflineSync] Cannot sync - device is offline');
      return { ...result, success: false };
    }

    const pending = getPendingOperations();

    if (pending.length === 0) {
      if (DEBUG_OFFLINE_SYNC) console.log('[OfflineSync] No pending operations to sync');
      return result;
    }

    if (DEBUG_OFFLINE_SYNC)
      console.log(`[OfflineSync] Syncing ${pending.length} pending operations...`);

    // Process in batches
    const batches = chunkArray(pending, BATCH_SIZE);
    const remaining: SyncOperation[] = [];

    for (const batch of batches) {
      for (const op of batch) {
        try {
          const synced = await syncSingleOperation(op, authToken, conflictResolution);

          if (synced) {
            result.synced++;
          } else {
            // Increment retry count
            op.retries++;

            if (op.retries < MAX_RETRIES) {
              remaining.push(op);
            } else {
              result.failed++;
              console.error(`[OfflineSync] Operation ${op.id} failed after ${MAX_RETRIES} retries`);
            }
          }
        } catch (error) {
          console.error(`[OfflineSync] Error syncing operation ${op.id}:`, error);
          op.retries++;

          if (op.retries < MAX_RETRIES) {
            remaining.push(op);
          } else {
            result.failed++;
          }
        }
      }
    }

    // Save remaining operations
    savePendingOperations(remaining);

    // Update last sync time
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

    if (DEBUG_OFFLINE_SYNC)
      console.log(
        `[OfflineSync] Sync complete - ${result.synced} synced, ${result.failed} failed, ${remaining.length} remaining`
      );

    return result;
  } catch (error) {
    console.error('[OfflineSync] Sync failed:', error);
    return { ...result, success: false };
  }
}

/**
 * Sync a single operation
 */
async function syncSingleOperation(
  op: SyncOperation,
  authToken?: string,
  conflictResolution: ConflictResolution = { strategy: 'newest-wins' }
): Promise<boolean> {
  try {
    const endpoint = getEndpointForOperation(op);
    const method = getMethodForOperation(op.operation);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(endpoint, {
      method,
      headers,
      body: JSON.stringify(op.data),
    });

    if (response.ok) {
      return true;
    }

    // Handle 401 Unauthorized - do NOT retry, mark as failed
    if (response.status === 401) {
      console.warn(`[OfflineSync] Operation ${op.id} failed with 401 Unauthorized - authentication required`);
      // Mark as permanently failed by setting retries to max
      op.retries = MAX_RETRIES;
      return false;
    }

    // Handle conflicts (409 status)
    if (response.status === 409) {
      const serverData = await response.json();
      const resolved = await resolveConflict(op, serverData, conflictResolution);

      if (resolved) {
        // Retry with resolved data
        return syncSingleOperation({ ...op, data: resolved }, authToken, conflictResolution);
      }

      return false;
    }

    console.error(`[OfflineSync] Operation ${op.id} failed with status ${response.status}`);
    return false;
  } catch (error) {
    console.error(`[OfflineSync] Error syncing operation ${op.id}:`, error);
    return false;
  }
}

/**
 * Get API endpoint for operation
 */
function getEndpointForOperation(op: SyncOperation): string {
  const baseUrl = '/api';

  switch (op.type) {
    case 'performance':
      return `${baseUrl}/performance`;
    case 'srs':
      return `${baseUrl}/srs`;
    case 'savedQuestion':
      return `${baseUrl}/saved-questions`;
    case 'achievement':
      return `${baseUrl}/achievements`;
    case 'streak':
      return `${baseUrl}/streaks`;
    default:
      throw new Error(`Unknown operation type: ${op.type}`);
  }
}

/**
 * Get HTTP method for operation
 */
function getMethodForOperation(operation: SyncOperation['operation']): string {
  switch (operation) {
    case 'create':
      return 'POST';
    case 'update':
      return 'PUT';
    case 'delete':
      return 'DELETE';
    default:
      return 'POST';
  }
}

/**
 * Resolve sync conflict
 */
async function resolveConflict(
  clientOp: SyncOperation,
  serverData: any,
  resolution: ConflictResolution
): Promise<any | null> {
  switch (resolution.strategy) {
    case 'client-wins':
      return clientOp.data;

    case 'server-wins':
      return null; // Discard client changes

    case 'newest-wins': {
      // Compare timestamps
      const clientTime = clientOp.timestamp;
      const serverTime = serverData.updatedAt ? new Date(serverData.updatedAt).getTime() : 0;
      return clientTime > serverTime ? clientOp.data : null;
    }

    case 'merge': {
      // Merge non-conflicting fields
      return {
        ...serverData,
        ...clientOp.data,
      };
    }

    default:
      return clientOp.data;
  }
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get sync status
 */
export function getSyncStatus(): {
  pendingCount: number;
  lastSyncTime: number | null;
  isOffline: boolean;
} {
  const pending = getPendingOperations();
  const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);

  return {
    pendingCount: pending.length,
    lastSyncTime: lastSync ? parseInt(lastSync, 10) : null,
    isOffline: isOfflineMode() || !isOnline(),
  };
}

/**
 * Clear all pending operations (use with caution)
 */
export function clearPendingOperations(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_OPS);
    if (DEBUG_OFFLINE_SYNC) console.log('[OfflineSync] Cleared all pending operations');
  } catch (error) {
    console.error('[OfflineSync] Failed to clear pending operations:', error);
  }
}

/**
 * Setup automatic sync on connection restore
 * @param getToken - Optional async function to retrieve current authentication token
 */
export function setupAutoSync(getToken?: () => Promise<string | null>): () => void {
  const handleOnline = async () => {
    if (DEBUG_OFFLINE_SYNC) console.log('[OfflineSync] Connection restored, syncing...');
    setOfflineMode(false);

    // Get fresh token if function provided
    let authToken: string | undefined;
    if (getToken) {
      try {
        const token = await getToken();
        authToken = token || undefined;
      } catch (error) {
        console.error('[OfflineSync] Failed to get auth token:', error);
      }
    }

    await syncPendingOperations(authToken);
  };

  const handleOffline = () => {
    if (DEBUG_OFFLINE_SYNC) console.log('[OfflineSync] Connection lost, entering offline mode');
    setOfflineMode(true);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Check current status
  if (isOnline() && !isOfflineMode()) {
    handleOnline();
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Export pending operations for debugging
 */
export function exportPendingOperations(): string {
  const pending = getPendingOperations();
  return JSON.stringify(pending, null, 2);
}

/**
 * Import pending operations (for debugging/recovery)
 */
export function importPendingOperations(data: string): void {
  try {
    const operations = JSON.parse(data);
    savePendingOperations(operations);
    if (DEBUG_OFFLINE_SYNC) console.log(`[OfflineSync] Imported ${operations.length} operations`);
  } catch (error) {
    console.error('[OfflineSync] Failed to import operations:', error);
  }
}
