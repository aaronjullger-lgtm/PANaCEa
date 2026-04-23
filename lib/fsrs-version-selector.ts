/**
 * FSRS Version Selector
 *
 * Dispatcher that returns either a v6 FSRS instance or a v7-alpha FSRSv7
 * instance based on the persisted `version` tag on parameters.
 *
 * Usage:
 *   const scheduler = selectFSRS(userParams);
 *   const result = scheduler.next(card, now, rating);
 *
 * Both v6 and v7 implement the same next() contract, so callers in
 * drillReviewService can be version-agnostic.
 *
 * Default is always v6 — no user is migrated to v7-alpha implicitly.
 * Adoption happens via an explicit `version: '7-alpha'` on the params,
 * set by the v7 enrollment path (admin flag, calibration-promoted,
 * or fresh-user policy).
 */

import { FSRS, FSRSParameters, defaultParameters } from './fsrs';
import { FSRSv7, type FSRSAlgorithmVersion } from './fsrs-v7';

export interface VersionedFSRSParameters extends FSRSParameters {
  version?: FSRSAlgorithmVersion;
}

/**
 * Pick v6 or v7 implementation based on the params' version tag.
 *
 * Contract:
 *   - version === '7-alpha' AND w.length === 29 → FSRSv7 (fractional intervals,
 *     8-parameter forgetting curve placeholder, refined same-day model)
 *   - Anything else → FSRS v6 (integer-day intervals, single-parameter curve)
 *
 * Falling back to v6 on malformed input is intentional — callers cannot
 * accidentally run v7 math against v6-length weights.
 */
export function selectFSRS(params?: VersionedFSRSParameters): FSRS | FSRSv7 {
  if (!params) return new FSRS(defaultParameters);
  const v: FSRSAlgorithmVersion = params.version ?? '6';
  if (v === '7-alpha' && params.w.length === 29) {
    return new FSRSv7(params);
  }
  return new FSRS(params);
}

/**
 * Infer the algorithm version from a loaded parameter array length.
 * 21 → '6', 29 → '7-alpha', anything else → '6' (safe fallback).
 */
export function inferVersion(w: number[] | null | undefined): FSRSAlgorithmVersion {
  if (Array.isArray(w) && w.length === 29) return '7-alpha';
  return '6';
}

/** True iff params are running the v7-alpha algorithm. */
export function isV7Alpha(params: VersionedFSRSParameters | null | undefined): boolean {
  if (!params) return false;
  return params.version === '7-alpha' && params.w.length === 29;
}

/**
 * Resolve the algorithm version for a user given BOTH a persisted tag
 * (PersonalizedFSRSParams.version) AND the weights array. Priority order:
 *
 *   1. Persisted tag wins if it matches the weights-length contract
 *      (e.g. tag '7-alpha' AND w.length === 29)
 *   2. Otherwise infer from w.length
 *   3. Fallback '6'
 *
 * Rule 1 guards against the pre-migration state where `version` might be
 * absent (undefined) OR the post-migration state where a tag might drift
 * from the array length (corruption). Inference remains the safety net.
 *
 * @param persistedVersion - value from PersonalizedFSRSParams.version
 *                           (undefined if the column does not exist yet)
 * @param w - the actual weights array
 */
export function resolveVersion(
  persistedVersion: string | null | undefined,
  w: number[] | null | undefined
): FSRSAlgorithmVersion {
  const inferred = inferVersion(w);

  if (persistedVersion === '7-alpha' && Array.isArray(w) && w.length === 29) {
    return '7-alpha';
  }
  if (persistedVersion === '6' && Array.isArray(w) && w.length === 21) {
    return '6';
  }
  // Tag absent, unknown, or disagrees with weights → trust inference.
  return inferred;
}
