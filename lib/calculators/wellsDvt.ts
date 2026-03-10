/**
 * Wells' DVT Criteria - Deep vein thrombosis probability
 */

export interface WellsDVTInput {
  activeCA: boolean;
  paralysis: boolean;
  bedridden: boolean;
  tenderness: boolean;
  entireLegSwollen: boolean;
  calfSwelling: boolean;
  pittingEdema: boolean;
  collateralVeins: boolean;
  previousDVT: boolean;
  alternativeDiagnosis: boolean;
}

export function calculateWellsDVT(input: WellsDVTInput): number {
  const {
    activeCA,
    paralysis,
    bedridden,
    tenderness,
    entireLegSwollen,
    calfSwelling,
    pittingEdema,
    collateralVeins,
    previousDVT,
    alternativeDiagnosis,
  } = input;
  return (
    (activeCA ? 1 : 0) +
    (paralysis ? 1 : 0) +
    (bedridden ? 1 : 0) +
    (tenderness ? 1 : 0) +
    (entireLegSwollen ? 1 : 0) +
    (calfSwelling ? 1 : 0) +
    (pittingEdema ? 1 : 0) +
    (collateralVeins ? 1 : 0) +
    (previousDVT ? 1 : 0) +
    (alternativeDiagnosis ? -2 : 0)
  );
}
