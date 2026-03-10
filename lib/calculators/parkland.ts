/**
 * Parkland Formula - Burn resuscitation
 * 4 mL × kg × % TBSA in first 24 h; half in first 8 h from burn, half over next 16 h
 */

export interface ParklandResult {
  total24: number;
  first8h: number;
  next16h: number;
}

export function parkland(weightKg: number, tbsaPercent: number): ParklandResult | null {
  if (!weightKg || !tbsaPercent || weightKg <= 0 || tbsaPercent <= 0) return null;
  const total24 = Math.round(4 * weightKg * tbsaPercent);
  const first8h = Math.round(total24 / 2);
  const next16h = total24 - first8h;
  return { total24, first8h, next16h };
}
