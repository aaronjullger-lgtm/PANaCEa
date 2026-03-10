/**
 * CHA₂DS₂-VASc - Stroke risk in atrial fibrillation
 */

export interface CHADS2VAScInput {
  chf: boolean;
  hypertension: boolean;
  age75: boolean;
  diabetes: boolean;
  stroke: boolean;
  vascular: boolean;
  age65: boolean;
  female: boolean;
}

export function calculateCHADS2VASc(input: CHADS2VAScInput): number {
  const { chf, hypertension, age75, diabetes, stroke, vascular, age65, female } = input;
  return (
    (chf ? 1 : 0) +
    (hypertension ? 1 : 0) +
    (age75 ? 2 : 0) +
    (diabetes ? 1 : 0) +
    (stroke ? 2 : 0) +
    (vascular ? 1 : 0) +
    (age65 && !age75 ? 1 : 0) +
    (female ? 1 : 0)
  );
}
