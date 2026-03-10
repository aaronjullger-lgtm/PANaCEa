/**
 * Wells' PE Criteria - Pulmonary embolism probability
 */

export interface WellsPEInput {
  clinicalDVT: boolean;
  peMoreLikely: boolean;
  tachycardia: boolean;
  immobilization: boolean;
  previousPE: boolean;
  hemoptysis: boolean;
  malignancy: boolean;
}

export function calculateWellsPE(input: WellsPEInput): number {
  const {
    clinicalDVT,
    peMoreLikely,
    tachycardia,
    immobilization,
    previousPE,
    hemoptysis,
    malignancy,
  } = input;
  return (
    (clinicalDVT ? 3 : 0) +
    (peMoreLikely ? 3 : 0) +
    (tachycardia ? 1.5 : 0) +
    (immobilization ? 1.5 : 0) +
    (previousPE ? 1.5 : 0) +
    (hemoptysis ? 1 : 0) +
    (malignancy ? 1 : 0)
  );
}
