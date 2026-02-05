/**
 * Media type mapping: category (API) ↔ type (DB) ↔ modality (drill UI)
 * Single source of truth for admin upload, mediaStorageService, and drills/media.
 */

/** API/upload category (e.g. form field, storage folder) */
export type MediaCategory = 'ecg' | 'derm' | 'radiology' | 'labs' | 'diagrams';

/** DB MediaAsset.type values; used by drills/media typeFilters */
export type MediaType = 'ekg' | 'photo' | 'imaging' | 'labs' | 'diagram' | 'other';

/** Drill UI modality (PhotoCase.modality) */
export type DrillModality = 'ecg' | 'xray' | 'derm';

export const MEDIA_CATEGORIES: MediaCategory[] = [
  'ecg',
  'derm',
  'radiology',
  'labs',
  'diagrams',
];

/** Category → DB type (persist this so drills/media typeFilters match) */
export function categoryToType(category: MediaCategory): MediaType {
  const map: Record<MediaCategory, MediaType> = {
    ecg: 'ekg',
    derm: 'photo',
    radiology: 'imaging',
    labs: 'labs',
    diagrams: 'diagram',
  };
  return map[category] ?? 'other';
}

/** DB type → API category */
export function typeToCategory(type: string): MediaCategory {
  const normalized = type.toLowerCase();
  const map: Record<string, MediaCategory> = {
    ekg: 'ecg',
    ecg: 'ecg',
    photo: 'derm',
    derm: 'derm',
    imaging: 'radiology',
    xray: 'radiology',
    radiology: 'radiology',
    labs: 'labs',
    diagram: 'diagrams',
  };
  return map[normalized] ?? 'derm';
}

/** DB type → drill modality (PhotoCase) */
export function typeToModality(type: string): DrillModality {
  const normalized = type.toLowerCase();
  if (normalized === 'ekg' || normalized === 'ecg') return 'ecg';
  if (
    normalized === 'imaging' ||
    normalized === 'xray' ||
    normalized === 'radiology'
  )
    return 'xray';
  if (normalized === 'photo' || normalized === 'derm') return 'derm';
  return 'xray';
}

/** Modality query param → DB type values for WHERE type IN (...) */
export function modalityToTypeFilters(
  modality: DrillModality
): string[] {
  const filters: Record<DrillModality, string[]> = {
    ecg: ['ekg', 'ecg', 'ECG', 'EKG'],
    derm: ['photo', 'derm', 'PHOTO', 'DERM'],
    xray: ['imaging', 'xray', 'IMAGING', 'XRAY', 'X-Ray', 'radiology'],
  };
  return filters[modality] ?? [...filters.ecg, ...filters.derm, ...filters.xray];
}

/** All drill-suitable DB types (for no modality filter) */
export function allDrillTypes(): string[] {
  return [
    'ekg',
    'ecg',
    'ECG',
    'EKG',
    'photo',
    'derm',
    'PHOTO',
    'DERM',
    'imaging',
    'xray',
    'IMAGING',
    'XRAY',
    'X-Ray',
  ];
}
