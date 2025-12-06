import { describe, it, expect } from 'vitest';
import {
  LAB_CONVERSIONS,
  convertLabValue,
  getLocalizedDrugName,
  localizeDrugNamesInText,
  formatLabValue,
  getReferenceRange,
} from '../config/unit-converter';

describe('Unit Converter', () => {
  it('should have lab conversions for common tests', () => {
    expect(LAB_CONVERSIONS.glucose).toBeDefined();
    expect(LAB_CONVERSIONS.creatinine).toBeDefined();
    expect(LAB_CONVERSIONS.bun).toBeDefined();
  });

  it('should convert glucose from US to SI', () => {
    const result = convertLabValue(100, 'glucose', 'us', 'si');
    
    expect(result.value).toBeCloseTo(5.55, 1);
    expect(result.unit).toBe('mmol/L');
  });

  it('should convert glucose from SI to US', () => {
    const result = convertLabValue(5.55, 'glucose', 'si', 'us');
    
    expect(result.value).toBeCloseTo(100, 0);
    expect(result.unit).toBe('mg/dL');
  });

  it('should not convert if same unit system', () => {
    const result = convertLabValue(100, 'glucose', 'us', 'us');
    
    expect(result.value).toBe(100);
    expect(result.unit).toBe('mg/dL');
  });

  it('should convert creatinine correctly', () => {
    const result = convertLabValue(1.0, 'creatinine', 'us', 'si');
    
    expect(result.value).toBeCloseTo(88.4, 1);
    expect(result.unit).toBe('µmol/L');
  });

  it('should format lab values with correct units', () => {
    const usFormat = formatLabValue('glucose', 100, 'us');
    const siFormat = formatLabValue('glucose', 100, 'si');
    
    expect(usFormat).toContain('mg/dL');
    expect(siFormat).toContain('mmol/L');
  });

  it('should get reference ranges in correct units', () => {
    const usRange = getReferenceRange('glucose', 70, 100, 'us');
    const siRange = getReferenceRange('glucose', 70, 100, 'si');
    
    expect(usRange.low).toBe(70);
    expect(usRange.high).toBe(100);
    expect(usRange.unit).toBe('mg/dL');
    
    expect(siRange.low).toBeCloseTo(3.89, 1);
    expect(siRange.high).toBeCloseTo(5.55, 1);
    expect(siRange.unit).toBe('mmol/L');
  });
});

describe('Drug Name Localization', () => {
  it('should localize acetaminophen to paracetamol in UK', () => {
    const ukName = getLocalizedDrugName('acetaminophen', 'uk');
    
    expect(ukName).toBe('Paracetamol');
  });

  it('should localize albuterol to salbutamol globally', () => {
    const globalName = getLocalizedDrugName('albuterol', 'global');
    
    expect(globalName).toBe('Salbutamol');
  });

  it('should keep US names in US convention', () => {
    const usName = getLocalizedDrugName('acetaminophen', 'us');
    
    expect(usName).toBe('Acetaminophen');
  });

  it('should return original if no localization exists', () => {
    const name = getLocalizedDrugName('amoxicillin', 'uk');
    
    expect(name).toBe('amoxicillin');
  });

  it('should localize epinephrine to adrenaline', () => {
    const ukName = getLocalizedDrugName('epinephrine', 'uk');
    
    expect(ukName).toBe('Adrenaline');
  });

  it('should localize drug names in text', () => {
    const text = 'Give Acetaminophen 500mg and Albuterol inhaler.';
    const ukText = localizeDrugNamesInText(text, 'uk');
    
    expect(ukText).toContain('Paracetamol');
    expect(ukText).toContain('Salbutamol');
    expect(ukText).not.toContain('Acetaminophen');
    expect(ukText).not.toContain('Albuterol');
  });

  it('should handle case-insensitive localization', () => {
    const ukName1 = getLocalizedDrugName('ACETAMINOPHEN', 'uk');
    const ukName2 = getLocalizedDrugName('acetaminophen', 'uk');
    
    expect(ukName1).toBe(ukName2);
  });
});

describe('Lab Conversion Edge Cases', () => {
  it('should handle hemoglobin conversion', () => {
    const result = convertLabValue(14.0, 'hemoglobin', 'us', 'si');
    
    expect(result.value).toBe(140);
    expect(result.unit).toBe('g/L');
  });

  it('should handle cholesterol conversion', () => {
    const result = convertLabValue(200, 'cholesterol', 'us', 'si');
    
    expect(result.value).toBeCloseTo(5.18, 1);
    expect(result.unit).toBe('mmol/L');
  });

  it('should round converted values appropriately', () => {
    const result = convertLabValue(123.456, 'glucose', 'us', 'si');
    
    // Should round to 2 decimal places
    expect(result.value.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
  });
});
