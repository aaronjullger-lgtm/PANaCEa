/**
 * GFR (MDRD) - Glomerular filtration rate estimation
 * Formula: 175 × (Cr)^-1.154 × (Age)^-0.203 × [0.742 if female] × [1.212 if Black]
 */

export interface GFRInput {
  age: number;
  creatinine: number;
  sex: 'male' | 'female';
  race: 'black' | 'other';
}

export function calculateGFR(input: GFRInput): number | null {
  const { age, creatinine, sex, race } = input;
  if (!age || !creatinine || age <= 0 || creatinine <= 0) return null;
  let gfr = 175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203);
  if (sex === 'female') gfr *= 0.742;
  if (race === 'black') gfr *= 1.212;
  return Math.round(gfr);
}
