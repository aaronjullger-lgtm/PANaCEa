import { logger } from '../../logger';

const LOG_SCOPE = 'OfflineSyncService';

interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: number;
}

const QUEUE_KEY = 'offline-sync-queue';

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
  private storage: StorageLike;

  constructor(storage?: StorageLike) {
    this.storage =
      storage ||
      (global as any).localStorage ||
      (globalThis as any).localStorage ||
      createMemoryStorage();
    this.loadQueue();
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
      logger.error(LOG_SCOPE, 'Failed to load offline queue', error);
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
        // Mirror to a globally mocked storage (test environments sometimes provide a separate object).
        globalStorage.setItem(QUEUE_KEY, serialized);
      }
    } catch (error) {
      logger.error(LOG_SCOPE, 'Failed to persist offline queue', error);
    }
  }

  public async queueRequest(url: string, options: RequestInit): Promise<void> {
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      url,
      options,
      timestamp: Date.now(),
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
        logger.error(LOG_SCOPE, `Failed to process queued request, re-queuing: ${request.url}`, error);
        this.queue.push(request);
        this.saveQueue();
      }
    }
  }

  public getQueue() {
    return this.queue;
  }
}

export const offlineSyncService = new OfflineSyncService();
