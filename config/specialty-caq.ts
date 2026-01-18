/**
 * Specialty CAQ Track Configuration
 * DLC (Downloadable Content) packs for post-graduate specialization
 */

import type { SpecialtyCAQPack } from '@/types';

export const SPECIALTY_CAQ_PACKS: SpecialtyCAQPack[] = [
  {
    id: 'orthopedics',
    name: 'Orthopedic Surgery CAQ',
    description:
      'Advanced orthopedic cases: fractures, sports medicine, joint replacements, and surgical decision-making.',
    releaseDate: '2025-01-15',
  },
  {
    id: 'dermatology',
    name: 'Dermatology CAQ',
    description:
      'Comprehensive derm: lesion identification, biopsy interpretation, procedural dermatology, and cosmetic procedures.',
    releaseDate: '2025-02-01',
  },
  {
    id: 'psychiatry',
    name: 'Psychiatry CAQ',
    description:
      'Advanced psych: complex medication management, therapy modalities, crisis intervention, and psychopharmacology.',
    releaseDate: '2025-02-15',
  },
  {
    id: 'emergency_medicine',
    name: 'Emergency Medicine CAQ',
    description:
      'ER mastery: trauma protocols, critical procedures, toxicology, and high-acuity decision-making.',
    releaseDate: '2025-03-01',
  },
];

/**
 * Check if a specialty pack is unlocked for the user
 */
export function isSpecialtyPackUnlocked(
  specialtyId: string,
  userPurchases: string[] = []
): boolean {
  return userPurchases.includes(specialtyId);
}

/**
 * Get available specialty packs (released and not expired)
 */
export function getAvailableSpecialtyPacks(): SpecialtyCAQPack[] {
  const now = new Date();
  return SPECIALTY_CAQ_PACKS.filter((pack) => {
    if (!pack.releaseDate) return true;
    const releaseDate = new Date(pack.releaseDate);
    return releaseDate <= now;
  });
}
