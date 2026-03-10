/**
 * PERC Rule - Pulmonary embolism rule-out (low-risk patients only)
 * All 8 criteria absent → PERC negative → PE ruled out
 */

export interface PERCInput {
  age50: boolean;
  heartRate100: boolean;
  o2sat95: boolean;
  unilateralLegSwelling: boolean;
  hemoptysis: boolean;
  recentSurgery: boolean;
  priorPE: boolean;
  hormoneUse: boolean;
}

export function isPERCNegative(input: PERCInput): boolean {
  return !(
    input.age50 ||
    input.heartRate100 ||
    input.o2sat95 ||
    input.unilateralLegSwelling ||
    input.hemoptysis ||
    input.recentSurgery ||
    input.priorPE ||
    input.hormoneUse
  );
}

export function percPositiveCount(input: PERCInput): number {
  return [
    input.age50,
    input.heartRate100,
    input.o2sat95,
    input.unilateralLegSwelling,
    input.hemoptysis,
    input.recentSurgery,
    input.priorPE,
    input.hormoneUse,
  ].filter(Boolean).length;
}
