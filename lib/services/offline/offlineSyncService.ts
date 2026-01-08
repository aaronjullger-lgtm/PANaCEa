interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: number;
}

const QUEUE_KEY = 'offline-sync-queue';

export class OfflineSyncService {
  private queue: QueuedRequest[] = [];

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
  }

  private loadQueue() {
    if (typeof window === 'undefined') return;
    const storedQueue = localStorage.getItem(QUEUE_KEY);
    if (storedQueue) {
      this.queue = JSON.parse(storedQueue);
    }
  }

  private saveQueue() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
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
    if (typeof window === 'undefined' || !navigator.onLine) {
      return;
    }

    const requestsToProcess = [...this.queue];
    this.queue = [];
    this.saveQueue();

    for (const request of requestsToProcess) {
      try {
        await fetch(request.url, request.options);
      } catch (error) {
        console.error('Failed to process queued request, re-queuing:', request, error);
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
