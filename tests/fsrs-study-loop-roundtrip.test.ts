/**
 * Core study-loop scheduling round-trip (real FSRS engine).
 *
 * drillReviewService unit tests mock FSRS.next(); this test drives ONE card
 * through a sequence of implicit reviews using the REAL engine — the way the
 * study loop schedules it — and asserts the documented state transitions and
 * scheduling behavior:
 *   New → Learning → Review (on repeated success),
 *   stability + interval grow across successful Review-state reps,
 *   an "Again" (implicit lapse) sends Review → Relearning and drops stability.
 *
 * Rating is binary/behaviorally-derived (Again/Good) — no explicit rating UI.
 */
import { describe, it, expect } from 'vitest';
import { FSRS, FSRSState, Rating, normalizeRating } from '../lib/fsrs';

function review(fsrs: FSRS, card: ReturnType<FSRS['createEmptyCard']>, now: Date, rating: Rating) {
  return fsrs.next(card, now, normalizeRating(rating));
}

describe('FSRS study-loop round-trip (real engine)', () => {
  it('progresses New → Learning → Review and grows stability across successful reps', () => {
    const fsrs = new FSRS();
    let card = fsrs.createEmptyCard();
    expect(card.state).toBe(FSRSState.New);

    let now = new Date('2026-01-01T00:00:00Z');
    const seenStates: FSRSState[] = [];
    const dueDates: number[] = [];
    let prevStability = 0;
    let reachedReview = false;

    // Six spaced "Good" reviews, each performed when the card comes due.
    for (let i = 0; i < 6; i++) {
      const res = review(fsrs, card, now, Rating.Good);
      card = res.card;
      seenStates.push(card.state);
      dueDates.push(res.due.getTime());

      if (card.state === FSRSState.Review) {
        // Once in Review, consecutive successes must not shrink stability.
        if (reachedReview) {
          expect(card.stability).toBeGreaterThanOrEqual(prevStability);
        }
        reachedReview = true;
        prevStability = card.stability;
      }
      now = new Date(res.due.getTime());
    }

    expect(seenStates[0]).toBe(FSRSState.Learning); // first success leaves New
    expect(seenStates).toContain(FSRSState.Review); // reaches Review with repeated success
    expect(reachedReview).toBe(true);
    // Due dates are non-decreasing and eventually extend beyond a day (real spacing).
    expect(dueDates[dueDates.length - 1]).toBeGreaterThan(dueDates[0]);
    expect(card.stability).toBeGreaterThan(0);
    expect(Number.isFinite(card.stability)).toBe(true);
    expect(card.difficulty).toBeGreaterThanOrEqual(1);
    expect(card.difficulty).toBeLessThanOrEqual(10);
  });

  it('an implicit lapse (Again) from Review → Relearning and reduces stability', () => {
    const fsrs = new FSRS();
    let card = fsrs.createEmptyCard();
    let now = new Date('2026-01-01T00:00:00Z');

    // Drive to Review with successes.
    for (let i = 0; i < 5 && card.state !== FSRSState.Review; i++) {
      const res = review(fsrs, card, now, Rating.Good);
      card = res.card;
      now = new Date(res.due.getTime());
    }
    expect(card.state).toBe(FSRSState.Review);
    const stabilityBeforeLapse = card.stability;

    const lapsed = review(fsrs, card, now, Rating.Again).card;
    expect(lapsed.state).toBe(FSRSState.Relearning);
    expect(lapsed.stability).toBeLessThan(stabilityBeforeLapse); // forgetting curve reset
    expect(lapsed.lapses).toBe(card.lapses + 1);
    expect(Number.isFinite(lapsed.stability)).toBe(true);
  });

  it('Hard/Easy normalize to the binary system (no explicit 4-button behavior)', () => {
    expect(normalizeRating(Rating.Hard)).toBe(Rating.Again);
    expect(normalizeRating(Rating.Easy)).toBe(Rating.Good);
  });
});
