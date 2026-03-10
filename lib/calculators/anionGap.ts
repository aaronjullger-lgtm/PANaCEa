/**
 * Anion Gap - AG = Na⁺ − (Cl⁻ + HCO₃⁻)
 * Corrected AG = AG + 2.5 × (4 − albumin)
 */

export function anionGap(na: number, cl: number, hco3: number): number | null {
  if (!na || !cl || !hco3) return null;
  return Math.round(na - cl - hco3);
}

export function correctedAnionGap(ag: number, albumin: number): number | null {
  if (!albumin) return null;
  return Math.round(ag + 2.5 * (4 - albumin));
}
