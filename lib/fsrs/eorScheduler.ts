/**
 * EOR (End of Rotation) Time-Blocked FSRS Scheduler
 *
 * Isolated logic for clamping next-review dates to the rotation window.
 * EOR scheduler MUST NOT schedule reviews past the rotation end date.
 * Uses the same FSRS + implicit-metrics pipeline; no separate rating derivation.
 *
 * Usage: After fsrs.next() returns a due date, call clampDueToRotationWindow
 * when the user is in EOR mode so persisted nextReviewDate is <= rotationEnd.
 */

/**
 * Clamp a due date to the rotation end (EOR test date or rotation end date).
 * Returns the earlier of due and rotationEnd; if rotationEnd is in the past, returns rotationEnd.
 */
export function clampDueToRotationWindow(due: Date, rotationEnd: Date): Date {
  const end = new Date(rotationEnd);
  end.setHours(23, 59, 59, 999);
  return due.getTime() > end.getTime() ? end : due;
}

/**
 * EOR scheduling context: user is in Clinical Year, on an EOR rotation, and has a rotation end date.
 * rotationEnd is typically eorTestDate or rotationEndDate (whichever is set).
 */
export interface EorSchedulingContext {
  rotationEnd: Date;
  rotationStart?: Date;
}

/**
 * Determine if the user is in EOR scheduling context and return the rotation end date.
 * Returns null if not in EOR mode (scheduling is not constrained).
 */
export function getEorRotationEnd(profile: {
  yearInProgram?: string | null;
  currentRotation?: string | null;
  eorTestDate?: string | null;
  rotationEndDate?: string | null;
}): Date | null {
  if (profile.yearInProgram !== 'Clinical Year' || !profile.currentRotation) {
    return null;
  }
  const eorRotations = [
    'Emergency Medicine',
    'Family Medicine',
    'Internal Medicine',
    'Surgery',
    'Pediatrics',
    'Psychiatry',
    'Obstetrics & Gynecology',
  ];
  if (!eorRotations.includes(profile.currentRotation)) {
    return null;
  }
  const endStr = profile.rotationEndDate ?? profile.eorTestDate;
  if (!endStr) return null;
  const d = new Date(endStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Apply EOR clamp to a due date when rotation end is known.
 * Returns the clamped date and whether it was clamped (for analytics).
 */
export function applyEorClampIfNeeded(
  due: Date,
  rotationEnd: Date | null
): { due: Date; wasClamped: boolean } {
  if (!rotationEnd) return { due, wasClamped: false };
  const clamped = clampDueToRotationWindow(due, rotationEnd);
  return { due: clamped, wasClamped: clamped.getTime() !== due.getTime() };
}
