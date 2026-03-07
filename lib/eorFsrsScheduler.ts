/**
 * EOR (End of Rotation) FSRS Scheduler
 * Time-bounded review scheduler that clamps due dates within a rotation window.
 * Uses the same FSRS algorithm but ensures reviews do not exceed the exam date.
 */

import { FSRS, FSRSCard, defaultParameters } from './fsrs';
import { deriveRotationWindow, addDaysToDate, daysBetween } from './utils/dateUtils';

/**
 * Schedule an EOR review with due date clamping.
 * @param card - Current FSRS card state
 * @param now - Current date/time
 * @param rating - Continuous rating (1.0-4.0) or discrete Rating
 * @param window - Rotation window with start and end dates
 * @returns Updated card and due date (clamped to window)
 */
export function scheduleEorReview(
  card: FSRSCard,
  now: Date,
  rating: number,
  window: { start: Date; end: Date }
): { card: FSRSCard; due: Date } {
  const fsrs = new FSRS(defaultParameters);
  const result = fsrs.next(card, now, rating);

  let due = result.due;
  let scheduledDays = result.card.scheduled_days;

  // Clamp due date to window end if it exceeds
  if (due > window.end) {
    due = window.end;
    scheduledDays = daysBetween(window.end, now);
  }

  // Ensure due date is at least one day after now (minimum interval)
  if (due <= now) {
    due = addDaysToDate(now, 1);
    scheduledDays = 1;
  }

  const updatedCard = {
    ...result.card,
    scheduled_days: scheduledDays,
  };

  return { card: updatedCard, due };
}

/**
 * Helper to schedule a batch of cards for EOR rotation.
 * @param cards - Array of FSRS cards
 * @param now - Current date
 * @param ratings - Corresponding ratings for each card
 * @param eorTestDate - Exam date (ISO string or Date)
 * @param blockDays - Days before exam to start (default 28)
 * @returns Array of scheduled results
 */
export function scheduleEorBatch(
  cards: FSRSCard[],
  now: Date,
  ratings: number[],
  eorTestDate: string | Date,
  blockDays = 28
): Array<{ card: FSRSCard; due: Date }> {
  const window = deriveRotationWindow(eorTestDate, blockDays);
  return cards.map((card, i) =>
    scheduleEorReview(card, now, ratings[i], window)
  );
}

/**
 * Determine whether a card should be included in EOR study.
 * Excludes cards that are already mastered (high stability) and due after exam.
 * @param card - FSRS card
 * @param eorTestDate - Exam date
 * @param stabilityThreshold - Stability threshold for "mastered" (default 100 days)
 * @returns true if card should be included
 */
export function shouldIncludeCardInEor(
  card: FSRSCard,
  eorTestDate: Date,
  stabilityThreshold = 100
): boolean {
  // If card stability is above threshold, consider mastered
  if (card.stability > stabilityThreshold) {
    return false;
  }
  // If next review date (estimated) is after exam date, exclude
  const fsrs = new FSRS(defaultParameters);
  const next = fsrs.next(card, new Date(), 3); // assume Good rating for estimation
  if (next.due > eorTestDate) {
    return false;
  }
  return true;
}