/**
 * FSRS Optimizer Bridge
 * 
 * Translates continuous float grades (1.0–4.0) to discrete integers (1–4)
 * for FSRS optimizer sidecar compatibility without corrupting data.
 * 
 * Math: Uses piecewise linear interpolation with hysteresis bands.
 */

import { Rating } from './fsrs';

/**
 * Convert continuous grade to discrete FSRS rating for optimizer export.
 * 
 * Mapping with hysteresis:
 * - [1.0, 1.5) → Again (1)
 * - [1.5, 2.5) → Hard (2)
 * - [2.5, 3.5) → Good (3)
 * - [3.5, 4.0] → Easy (4)
 */
export function deriveDiscreteFSRSGrade(continuousGrade: number): Rating {
  const clamped = Math.max(1.0, Math.min(4.0, continuousGrade));
  
  if (clamped < 1.5) return Rating.Again;
  if (clamped < 2.5) return Rating.Hard;
  if (clamped < 3.5) return Rating.Good;
  return Rating.Easy;
}

/**
 * Translate continuous decimal rating (float 1.0-4.0) to discrete FSRS grade with weight interpolation.
 * Weight indicates position within the grade bucket (0 at lower bound, 1 at upper bound).
 * For edge cases near boundaries, weight can be used for partial contribution.
 */
export function translateContinuousToDiscrete(
  continuousRating: number
): { grade: Rating; weight: number } {
  const clamped = Math.max(1.0, Math.min(4.0, continuousRating));
  
  // Define bucket boundaries [lower, upper)
  let lower: number, upper: number;
  if (clamped < 1.5) {
    lower = 1.0; upper = 1.5;
  } else if (clamped < 2.5) {
    lower = 1.5; upper = 2.5;
  } else if (clamped < 3.5) {
    lower = 2.5; upper = 3.5;
  } else {
    lower = 3.5; upper = 4.0; // inclusive upper bound
  }
  
  const grade = clamped < 1.5 ? Rating.Again :
                clamped < 2.5 ? Rating.Hard :
                clamped < 3.5 ? Rating.Good : Rating.Easy;
  
  // Compute weight as normalized position within bucket
  const weight = (clamped - lower) / (upper - lower);
  
  return { grade, weight };
}


/**
 * Batch export for optimizer: converts ReviewLog records to discrete grades.
 */
export function exportForOptimizer(reviews: Array<{ grade_continuous: number }>): Array<{ grade: number }> {
  return reviews.map(r => ({
    grade: deriveDiscreteFSRSGrade(r.grade_continuous)
  }));
}
