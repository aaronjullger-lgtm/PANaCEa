import { logger } from '../../logger';

const LOG_SCOPE = 'OfflineSyncService';
const offlineSyncLogger = logger.scope(LOG_SCOPE);

/** Maximum sync attempts before an item is dead-lettered. */
const MAX_ATTEMPTS = 5;

interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: number;
  attempts: number;
  lastError?: string;
  deadLettered?: boolean;
}

const QUEUE_KEY = 'offline-sync-queue';
const DEAD_LETTER_KEY = 'offline-sync-dead-letter';

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?: (key: string) => void;
};

function createMemoryStorage(): StorageLike {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? (store[key] ?? null) : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
}

export class OfflineSyncService {
  private queue: QueuedRequest[] = [];
  private deadLetter: QueuedRequest[] = [];
  private storage: StorageLike;

  constructor(storage?: StorageLike) {
    this.storage =
      storage ||
      (global as any).localStorage ||
      (globalThis as any).localStorage ||
      createMemoryStorage();
    this.loadQueue();
    this.loadDeadLetter();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
  }

  private loadQueue() {
    try {
      const storedQueue = this.storage.getItem?.(QUEUE_KEY);
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue);
      }
    } catch (error) {
      offlineSyncLogger.error('Failed to load offline queue', { error });
    }
  }

  private loadDeadLetter() {
    try {
      const stored = this.storage.getItem?.(DEAD_LETTER_KEY);
      if (stored) {
        this.deadLetter = JSON.parse(stored);
      }
    } catch (error) {
      offlineSyncLogger.error('Failed to load dead-letter queue', { error });
    }
  }

  private saveQueue() {
    try {
      const serialized = JSON.stringify(this.queue);
      this.storage.setItem(QUEUE_KEY, serialized);

      const globalStorage = (global as any)?.localStorage;
      if (
        globalStorage &&
        globalStorage !== this.storage &&
        typeof globalStorage.setItem === 'function'
      ) {
        globalStorage.setItem(QUEUE_KEY, serialized);
      }
    } catch (error) {
      offlineSyncLogger.error('Failed to persist offline queue', { error });
    }
  }

  private saveDeadLetter() {
    try {
      this.storage.setItem(DEAD_LETTER_KEY, JSON.stringify(this.deadLetter));
    } catch (error) {
      offlineSyncLogger.error('Failed to persist dead-letter queue', { error });
    }
  }

  /** Move a request to the dead-letter queue after exhausting retries. */
  private moveToDeadLetter(request: QueuedRequest): void {
    request.deadLettered = true;
    this.deadLetter.push(request);
    this.saveDeadLetter();
    offlineSyncLogger.warn(`Request dead-lettered after ${request.attempts} attempts: ${request.url}`);
  }

  public async queueRequest(url: string, options: RequestInit): Promise<void> {
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      url,
      options,
      timestamp: Date.now(),
      attempts: 0,
    };
    this.queue.push(request);
    this.saveQueue();
  }

  public async processQueue(): Promise<void> {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!online) {
      return;
    }

    const requestsToProcess = [...this.queue];
    this.queue = [];
    this.saveQueue();

    for (const request of requestsToProcess) {
      try {
        await fetch(request.url, request.options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        request.attempts++;
        request.lastError = message;

        if (request.attempts >= MAX_ATTEMPTS) {
          this.moveToDeadLetter(request);
        } else {
          offlineSyncLogger.warn(
            `Request failed (attempt ${request.attempts}/${MAX_ATTEMPTS}), re-queuing: ${request.url}`,
            { error }
          );
          this.queue.push(request);
          this.saveQueue();
        }
      }
    }
  }

  public getQueue(): QueuedRequest[] {
    return this.queue;
  }

  public getDeadLetter(): QueuedRequest[] {
    return this.deadLetter;
  }

  /** Remove a single dead-lettered item by id. */
  public removeDeadLetter(id: string): void {
    this.deadLetter = this.deadLetter.filter((r) => r.id !== id);
    this.saveDeadLetter();
  }

  /** Clear all dead-lettered items. */
  public clearDeadLetter(): void {
    this.deadLetter = [];
    this.saveDeadLetter();
  }
}

export const offlineSyncService = new OfflineSyncService();
