/**
 * Osmolar Gap - Calculated = 2×Na + glucose/18 + BUN/2.8 (mOsm/kg)
 * Gap = Measured osmolality − Calculated
 */

export function calculatedOsmolarity(na: number, glucose: number, bun: number): number {
  return 2 * na + (glucose || 0) / 18 + (bun || 0) / 2.8;
}

export function osmolarGap(measuredOsmolality: number, calculated: number): number {
  return Math.round((measuredOsmolality - calculated) * 10) / 10;
}
