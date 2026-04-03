/**
 * FSRS Web Worker — Off-main-thread spaced repetition calculations.
 *
 * Moves FSRS v6 stability/difficulty/scheduling math off the main thread
 * to prevent UI jank during bulk operations (end-of-session with 50+ cards).
 * Exposed via Comlink for ergonomic typed async calls.
 *
 * Single-card calculations stay on the main thread (overhead not worth it).
 * Only batch operations benefit from worker offloading.
 *
 * @see lib/workers/fsrsWorkerClient.ts — client wrapper
 * @see lib/fsrs.ts — FSRS v6 algorithm
 */

import * as Comlink from 'comlink';
import {
  FSRS,
  type FSRSCard,
  type FSRSParameters,
  type Rating,
  defaultParameters,
} from '../fsrs';

/** Serializable card data (Date fields as ISO strings for transfer) */
export interface SerializableFSRSCard {
  stability: number;
  difficulty: number;
  state: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review: string; // ISO string
}

export interface BatchItem {
  card: SerializableFSRSCard;
  rating: number;
  now?: string; // ISO string, defaults to current time
}

export interface BatchResult {
  card: SerializableFSRSCard;
  due: string; // ISO string
}

/** Convert serializable card to FSRS card (restore Date) */
function toFSRSCard(s: SerializableFSRSCard): FSRSCard {
  return {
    ...s,
    last_review: new Date(s.last_review),
  };
}

/** Convert FSRS card to serializable form (Date → ISO string) */
function fromFSRSCard(c: FSRSCard): SerializableFSRSCard {
  return {
    ...c,
    last_review: c.last_review instanceof Date
      ? c.last_review.toISOString()
      : String(c.last_review),
  };
}

/**
 * Worker API exposed via Comlink
 */
const workerApi = {
  /**
   * Calculate next review for a single card.
   * (Prefer main-thread for single calls; this is for completeness.)
   */
  calculateNext(
    card: SerializableFSRSCard,
    rating: number,
    params?: FSRSParameters,
    now?: string
  ): { card: SerializableFSRSCard; due: string } {
    const fsrs = new FSRS(params ?? defaultParameters);
    const result = fsrs.next(
      toFSRSCard(card),
      now ? new Date(now) : new Date(),
      rating as Rating
    );
    return {
      card: fromFSRSCard(result.card),
      due: result.due.toISOString(),
    };
  },

  /**
   * Batch calculate next reviews for multiple cards.
   * This is the primary use case — end-of-session bulk scheduling.
   */
  batchCalculate(
    items: BatchItem[],
    params?: FSRSParameters
  ): BatchResult[] {
    const fsrs = new FSRS(params ?? defaultParameters);
    return items.map((item) => {
      const result = fsrs.next(
        toFSRSCard(item.card),
        item.now ? new Date(item.now) : new Date(),
        item.rating as Rating
      );
      return {
        card: fromFSRSCard(result.card),
        due: result.due.toISOString(),
      };
    });
  },

  /**
   * Calculate retrievability for multiple cards in bulk.
   * Used for retention forecast displays.
   */
  batchRetrievability(
    items: Array<{ elapsed_days: number; stability: number }>,
    params?: FSRSParameters
  ): number[] {
    const fsrs = new FSRS(params ?? defaultParameters);
    return items.map((item) =>
      fsrs.calculateRetrievability(item.elapsed_days, item.stability)
    );
  },

  /** Health check — verify worker is alive */
  ping(): string {
    return 'pong';
  },
};

export type FSRSWorkerApi = typeof workerApi;

Comlink.expose(workerApi);
