/**
 * CURB-65 - Pneumonia severity (community-acquired pneumonia)
 */

export interface CURB65Input {
  confusion: boolean;
  urea: boolean;
  respiratory: boolean;
  bloodPressure: boolean;
  age: boolean;
}

export function calculateCURB65(input: CURB65Input): number {
  return [
    input.confusion,
    input.urea,
    input.respiratory,
    input.bloodPressure,
    input.age,
  ].filter(Boolean).length;
}
