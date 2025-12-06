/**
 * Unit Converter and Drug Localization
 * Toggle between US Standard and SI units, and regional drug naming
 */

import type { UnitSystem, DrugNamingConvention } from '@/types';

/**
 * Lab value conversion factors and units
 * Structure: { labName: { us: { unit, factor }, si: { unit, factor } } }
 * To convert from US to SI: value_si = value_us * si.factor
 * To convert from SI to US: value_us = value_si / si.factor
 */
export const LAB_CONVERSIONS = {
  glucose: {
    us: { unit: 'mg/dL', factor: 1 },
    si: { unit: 'mmol/L', factor: 0.0555 }, // mg/dL × 0.0555 = mmol/L
  },
  bun: {
    us: { unit: 'mg/dL', factor: 1 },
    si: { unit: 'mmol/L', factor: 0.357 },
  },
  creatinine: {
    us: { unit: 'mg/dL', factor: 1 },
    si: { unit: 'µmol/L', factor: 88.4 },
  },
  calcium: {
    us: { unit: 'mg/dL', factor: 1 },
    si: { unit: 'mmol/L', factor: 0.25 },
  },
  cholesterol: {
    us: { unit: 'mg/dL', factor: 1 },
    si: { unit: 'mmol/L', factor: 0.0259 },
  },
  triglycerides: {
    us: { unit: 'mg/dL', factor: 1 },
    si: { unit: 'mmol/L', factor: 0.0113 },
  },
  bilirubin: {
    us: { unit: 'mg/dL', factor: 1 },
    si: { unit: 'µmol/L', factor: 17.1 },
  },
  hemoglobin: {
    us: { unit: 'g/dL', factor: 1 },
    si: { unit: 'g/L', factor: 10 },
  },
};

/**
 * Convert lab value between unit systems
 */
export function convertLabValue(
  value: number,
  labName: keyof typeof LAB_CONVERSIONS,
  fromSystem: UnitSystem,
  toSystem: UnitSystem
): { value: number; unit: string } {
  if (fromSystem === toSystem) {
    const config = LAB_CONVERSIONS[labName][fromSystem];
    return { value, unit: config.unit };
  }
  
  const conversion = LAB_CONVERSIONS[labName];
  
  if (fromSystem === 'us' && toSystem === 'si') {
    const convertedValue = value * conversion.si.factor;
    return {
      value: Math.round(convertedValue * 100) / 100,
      unit: conversion.si.unit,
    };
  } else {
    // SI to US
    const convertedValue = value / conversion.si.factor;
    return {
      value: Math.round(convertedValue * 100) / 100,
      unit: conversion.us.unit,
    };
  }
}

/**
 * Drug name localization mappings
 */
export const DRUG_NAME_LOCALIZATION: Record<string, Record<DrugNamingConvention, string>> = {
  // US → UK/Global differences
  acetaminophen: {
    us: 'Acetaminophen',
    uk: 'Paracetamol',
    global: 'Paracetamol',
  },
  albuterol: {
    us: 'Albuterol',
    uk: 'Salbutamol',
    global: 'Salbutamol',
  },
  epinephrine: {
    us: 'Epinephrine',
    uk: 'Adrenaline',
    global: 'Adrenaline',
  },
  norepinephrine: {
    us: 'Norepinephrine',
    uk: 'Noradrenaline',
    global: 'Noradrenaline',
  },
  meperidine: {
    us: 'Meperidine',
    uk: 'Pethidine',
    global: 'Pethidine',
  },
  furosemide: {
    us: 'Furosemide',
    uk: 'Furosemide',
    global: 'Furosemide', // Same in all regions
  },
  hydralazine: {
    us: 'Hydralazine',
    uk: 'Hydralazine',
    global: 'Hydralazine',
  },
  // Add more as needed
};

/**
 * Get localized drug name
 */
export function getLocalizedDrugName(
  drugName: string,
  convention: DrugNamingConvention = 'us'
): string {
  const lowerName = drugName.toLowerCase();
  
  if (DRUG_NAME_LOCALIZATION[lowerName]) {
    return DRUG_NAME_LOCALIZATION[lowerName][convention];
  }
  
  // If no localization exists, return original
  return drugName;
}

/**
 * Convert all drug names in text to specified convention
 */
export function localizeDrugNamesInText(
  text: string,
  convention: DrugNamingConvention = 'us'
): string {
  let localizedText = text;
  
  Object.entries(DRUG_NAME_LOCALIZATION).forEach(([baseForm, localizations]) => {
    // Replace all conventions with target convention
    Object.values(localizations).forEach(drugName => {
      const regex = new RegExp(`\\b${drugName}\\b`, 'gi');
      localizedText = localizedText.replace(regex, localizations[convention]);
    });
  });
  
  return localizedText;
}

/**
 * Format lab value with unit based on user preference
 */
export function formatLabValue(
  labName: keyof typeof LAB_CONVERSIONS,
  value: number,
  unitSystem: UnitSystem
): string {
  const config = LAB_CONVERSIONS[labName][unitSystem];
  
  if (unitSystem === 'si') {
    // Convert from US to SI
    const converted = convertLabValue(value, labName, 'us', 'si');
    return `${converted.value} ${converted.unit}`;
  }
  
  return `${value} ${config.unit}`;
}

/**
 * Get reference ranges adjusted for unit system
 */
export function getReferenceRange(
  labName: keyof typeof LAB_CONVERSIONS,
  usLow: number,
  usHigh: number,
  unitSystem: UnitSystem
): { low: number; high: number; unit: string } {
  if (unitSystem === 'us') {
    return {
      low: usLow,
      high: usHigh,
      unit: LAB_CONVERSIONS[labName].us.unit,
    };
  }
  
  const convertedLow = convertLabValue(usLow, labName, 'us', 'si');
  const convertedHigh = convertLabValue(usHigh, labName, 'us', 'si');
  
  return {
    low: convertedLow.value,
    high: convertedHigh.value,
    unit: convertedLow.unit,
  };
}

/**
 * Example reference ranges (US standard values)
 */
export const COMMON_REFERENCE_RANGES = {
  glucose_fasting: { low: 70, high: 100 }, // mg/dL
  glucose_random: { low: 70, high: 140 }, // mg/dL
  bun: { low: 7, high: 20 }, // mg/dL
  creatinine: { low: 0.6, high: 1.2 }, // mg/dL
  calcium: { low: 8.5, high: 10.5 }, // mg/dL
  cholesterol_total: { low: 0, high: 200 }, // mg/dL (desirable)
  cholesterol_ldl: { low: 0, high: 100 }, // mg/dL (optimal)
  cholesterol_hdl: { low: 40, high: 999 }, // mg/dL (higher is better)
  triglycerides: { low: 0, high: 150 }, // mg/dL
  hemoglobin_male: { low: 13.5, high: 17.5 }, // g/dL
  hemoglobin_female: { low: 12.0, high: 15.5 }, // g/dL
};
