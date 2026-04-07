/**
 * Clinical Adjacency Map — TARGETED Session Interleaving
 *
 * Defines which organ systems share physiological, pharmacological, or
 * pathophysiological relationships. Used by the TARGETED session queue
 * builder to preferentially interleave FSRS-due cards from systems that
 * are clinically related to the primary study system.
 *
 * This promotes transfer learning: reviewing adjacent systems right after
 * the primary system reinforces cross-system pattern recognition, which
 * mirrors how real PANCE questions frequently bridge multiple systems.
 *
 * Adjacency is bidirectional — if CV is adjacent to Pulmonary, Pulmonary
 * is adjacent to CV. The map is intentionally one-directional in definition
 * but both directions are used in scoring.
 *
 * Canonical system names match NCCPA_2025_BLUEPRINT keys.
 */

export const ADJACENT_SYSTEMS: Readonly<Record<string, readonly string[]>> = {
  Cardiovascular: ['Pulmonary', 'Nephrology', 'Endocrine'],
  Pulmonary: ['Cardiovascular', 'Infectious Disease', 'Hematology'],
  Nephrology: ['Cardiovascular', 'Endocrine', 'Genitourinary'],
  'Infectious Disease': ['Pulmonary', 'Hematology', 'Gastrointestinal'],
  Neurological: ['Psychiatry', 'Cardiovascular'],
  Psychiatry: ['Neurological'],
  Hematology: ['Infectious Disease', 'Nephrology', 'Gastrointestinal'],
  Endocrine: ['Cardiovascular', 'Nephrology', 'Reproductive'],
  Gastrointestinal: ['Infectious Disease', 'Hematology'],
  Musculoskeletal: ['Neurological', 'Hematology'],
  Reproductive: ['Endocrine', 'Genitourinary'],
  Dermatology: ['Infectious Disease', 'Hematology'],
  HEENT: ['Neurological', 'Infectious Disease'],
  Genitourinary: ['Nephrology', 'Reproductive'],
  'Emergency Medicine': ['Cardiovascular', 'Pulmonary', 'Neurological'],
};

/**
 * Compute the adjacency multiplier for a due card relative to the session's
 * primary system.
 *
 * @param cardSystem    Canonical system name of the due card.
 * @param primarySystem Canonical system name the user chose for this TARGETED session.
 * @returns 2.0 if same system, 1.5 if adjacent, 1.0 otherwise.
 */
export function getAdjacencyMultiplier(
  cardSystem: string,
  primarySystem: string
): number {
  if (cardSystem === primarySystem) return 2.0;
  if (ADJACENT_SYSTEMS[primarySystem]?.includes(cardSystem)) return 1.5;
  return 1.0;
}

/**
 * Compute the full adjacency-weighted priority score for a due card.
 *
 * priorityScore = fsrsOverdueness × adjacencyMultiplier
 *
 * fsrsOverdueness = days overdue (0 for cards due today — still eligible).
 *
 * @param dueDateMs      Card's next-review timestamp (milliseconds).
 * @param nowMs          Current time (milliseconds). Injectable for tests.
 * @param cardSystem     Canonical system name of the card.
 * @param primarySystem  Canonical system the user is studying.
 */
export function computeAdjacencyPriority(
  dueDateMs: number,
  nowMs: number,
  cardSystem: string,
  primarySystem: string
): number {
  const daysOverdue = Math.max(0, (nowMs - dueDateMs) / (1000 * 60 * 60 * 24));
  const adjacencyMultiplier = getAdjacencyMultiplier(cardSystem, primarySystem);
  return daysOverdue * adjacencyMultiplier;
}
