/**
 * Offline Sync Service
 * 
 * Phase 4: Handles offline resilience and debouncing
 * - Debounces save operations (500ms)
 * - Stores operations in localStorage when offline
 * - Auto-retries when connection restored
 */

export interface SyncOperation {
  id: string;
  operation: 'save_progress' | 'submit_quiz' | 'update_settings' | 'flag_question';
  data: any;
  timestamp: number;
  attempts: number;
  status: 'pending' | 'synced' | 'failed';
}

const STORAGE_KEY = 'panacea_offline_queue';
const DEAD_LETTER_QUEUE_KEY = 'panacea_dead_letter_queue';
const MAX_ATTEMPTS = 5;
const RETRY_DELAY = 2000; // 2 seconds
const DEBOUNCE_DELAY = 500; // 500ms as per spec

/**
 * Get offline queue from localStorage
 */
function getQueue(): SyncOperation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[OfflineSync] Failed to read queue:', error);
    return [];
  }
}

/**
 * Save queue to localStorage
 */
function saveQueue(queue: SyncOperation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineSync] Failed to save queue:', error);
  }
}

/**
 * Get dead letter queue from localStorage
 */
export function getDeadLetterQueue(): SyncOperation[] {
  try {
    const stored = localStorage.getItem(DEAD_LETTER_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[OfflineSync] Failed to read dead letter queue:', error);
    return [];
  }
}

/**
 * Save dead letter queue to localStorage
 */
function saveDeadLetterQueue(queue: SyncOperation[]): void {
  try {
    localStorage.setItem(DEAD_LETTER_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineSync] Failed to save dead letter queue:', error);
  }
}

/**
 * Move failed operation to dead letter queue
 */
function moveToDeadLetterQueue(op: SyncOperation): void {
  const deadLetterQueue = getDeadLetterQueue();
  deadLetterQueue.push({
    ...op,
    status: 'failed',
  });
  saveDeadLetterQueue(deadLetterQueue);
  console.warn(`[OfflineSync] Moved to dead letter queue: ${op.operation} (${op.id})`);
}

/**
 * Add operation to offline queue
 */
export function queueOperation(
  operation: SyncOperation['operation'],
  data: any
): string {
  const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const op: SyncOperation = {
    id,
    operation,
    data,
    timestamp: Date.now(),
    attempts: 0,
    status: 'pending',
  };

  const queue = getQueue();
  queue.push(op);
  saveQueue(queue);

  console.log(`[OfflineSync] Queued operation: ${operation} (${id})`);
  
  // Try to sync immediately if online
  if (navigator.onLine) {
    setTimeout(() => processQueue(), 100);
  }

  return id;
}

/**
 * Process queued operations
 * @param token - Optional authentication token for authenticated requests
 */
export async function processQueue(token?: string): Promise<void> {
  if (!navigator.onLine) {
    console.log('[OfflineSync] Offline - skipping queue processing');
    return;
  }

  const queue = getQueue();
  const pending = queue.filter(op => op.status === 'pending' && op.attempts < MAX_ATTEMPTS);

  if (pending.length === 0) {
    return;
  }

  console.log(`[OfflineSync] Processing ${pending.length} pending operations`);

  for (const op of pending) {
    try {
      await syncOperation(op, token);
      op.status = 'synced';
      console.log(`[OfflineSync] ✓ Synced: ${op.operation} (${op.id})`);
    } catch (error: any) {
      op.attempts++;
      if (op.attempts >= MAX_ATTEMPTS) {
        // Permanent failure - move to dead letter queue
        moveToDeadLetterQueue(op);
        op.status = 'failed';
        console.error(`[OfflineSync] ✗ Permanent failure: ${op.operation} (${op.id}) after ${op.attempts} attempts`);
      } else {
        console.warn(`[OfflineSync] Retry ${op.attempts}/${MAX_ATTEMPTS}: ${op.operation} (${op.id})`);
      }
    }
  }

  // Update queue - remove synced and permanently failed items
  const updatedQueue = queue.filter(op => op.status === 'pending');
  saveQueue(updatedQueue);

  // If there are still pending items, schedule another retry
  const stillPending = updatedQueue.filter(op => op.status === 'pending');
  if (stillPending.length > 0) {
    setTimeout(() => processQueue(token), RETRY_DELAY);
  }
}

/**
 * Sync a single operation to the server
 */
async function syncOperation(op: SyncOperation, token?: string): Promise<void> {
  const endpoint = getEndpointForOperation(op.operation);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Attach authentication token if provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(op.data),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

/**
 * Get API endpoint for operation type
 */
function getEndpointForOperation(operation: SyncOperation['operation']): string {
  switch (operation) {
    case 'save_progress':
      return '/api/sync';
    case 'submit_quiz':
      return '/api/analytics/submit';
    case 'update_settings':
      return '/api/user/settings';
    case 'flag_question':
      return '/api/analytics/flag';
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Debounced save function
 * Phase 4: Wait 500ms before hitting the API
 * 
 * Note: Map is automatically cleaned up when timeout executes.
 * For long-running apps, consider periodic cleanup of stale entries.
 * 
 * @param key - Unique key for this operation (for debouncing)
 * @param operation - Type of operation to perform
 * @param data - Data to sync
 * @param delay - Debounce delay in milliseconds
 * @param token - Optional authentication token for authenticated requests
 */
const debouncedSaves = new Map<string, NodeJS.Timeout>();

export function debouncedSave(
  key: string,
  operation: SyncOperation['operation'],
  data: any,
  delay: number = DEBOUNCE_DELAY,
  token?: string
): void {
  // Clear existing timeout for this key
  const existing = debouncedSaves.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  // Set new timeout
  const timeout = setTimeout(() => {
    if (navigator.onLine) {
      // Try direct save
      syncOperation({
        id: key,
        operation,
        data,
        timestamp: Date.now(),
        attempts: 0,
        status: 'pending',
      }, token).catch(() => {
        // If fails, queue for retry
        queueOperation(operation, data);
      });
    } else {
      // Queue immediately if offline
      queueOperation(operation, data);
    }
    // Clean up this entry from the map
    debouncedSaves.delete(key);
  }, delay);

  debouncedSaves.set(key, timeout);
}

/**
 * Clear all pending debounced operations
 * Useful for cleanup on unmount or logout
 */
export function clearDebouncedSaves(): void {
  for (const timeout of debouncedSaves.values()) {
    clearTimeout(timeout);
  }
  debouncedSaves.clear();
}

/**
 * Clear all pending operations (use with caution)
 */
export function clearQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[OfflineSync] Queue cleared');
}

/**
 * Get queue status
 */
export function getQueueStatus(): {
  total: number;
  pending: number;
  synced: number;
  failed: number;
} {
  const queue = getQueue();
  return {
    total: queue.length,
    pending: queue.filter(op => op.status === 'pending').length,
    synced: queue.filter(op => op.status === 'synced').length,
    failed: queue.filter(op => op.status === 'failed').length,
  };
}

/**
 * Helper to retrieve token from getToken function
 */
function retrieveToken(getToken?: () => string | null): string | undefined {
  return getToken ? getToken() || undefined : undefined;
}

/**
 * Set up automatic sync retry on connection restore
 * @param getToken - Optional function to retrieve current authentication token
 */
export function setupAutoSync(getToken?: () => string | null): void {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Connection restored - processing queue');
    processQueue(retrieveToken(getToken));
  });

  window.addEventListener('offline', () => {
    console.log('[OfflineSync] Connection lost - operations will be queued');
  });

  // Process queue on page load
  if (navigator.onLine) {
    setTimeout(() => {
      processQueue(retrieveToken(getToken));
    }, 1000);
  }
}
