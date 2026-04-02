import { describe, it, expect } from 'vitest';
import {
  type QuickRefContext,
  type QuickRefData,
  type VitalRef,
  type NormalLabRef,
  type ClinicalPearlRef,
  type DifferentialFeature,
} from '../lib/services/clinicalQuickRefService';

// ─── Type Contracts ────────────────────────────────────────────────────────

describe('clinicalQuickRefService type contracts', () => {
  it('QuickRefContext allows system-only queries', () => {
    const ctx: QuickRefContext = { system: 'Cardiovascular' };
    expect(ctx.system).toBe('Cardiovascular');
    expect(ctx.conditionId).toBeUndefined();
  });

  it('QuickRefContext allows conditionId-only queries', () => {
    const ctx: QuickRefContext = { conditionId: 'cond-123' };
    expect(ctx.conditionId).toBe('cond-123');
    expect(ctx.system).toBeUndefined();
  });

  it('QuickRefContext supports optional tags', () => {
    const ctx: QuickRefContext = {
      system: 'Pulmonary',
      conditionId: 'cond-456',
      conditionName: 'Pneumonia',
      tags: ['infectious', 'lower-resp'],
    };
    expect(ctx.tags).toHaveLength(2);
  });

  it('QuickRefData shape includes all expected fields', () => {
    const data: QuickRefData = {
      normalLabs: [],
      vitalRanges: [],
      relevantPearls: [],
      differentialFeatures: [],
      relatedConditions: [],
    };
    expect(data.normalLabs).toEqual([]);
    expect(data.vitalRanges).toEqual([]);
    expect(data.relevantPearls).toEqual([]);
    expect(data.differentialFeatures).toEqual([]);
    expect(data.relatedConditions).toEqual([]);
  });

  it('NormalLabRef includes clinicalSignificance as optional', () => {
    const lab: NormalLabRef = {
      name: 'WBC',
      normalRange: '4.5-11.0',
      unit: 'K/uL',
    };
    expect(lab.clinicalSignificance).toBeUndefined();

    const labWithSig: NormalLabRef = {
      name: 'Troponin',
      normalRange: '<0.04',
      unit: 'ng/mL',
      clinicalSignificance: 'Elevated in MI',
    };
    expect(labWithSig.clinicalSignificance).toBe('Elevated in MI');
  });

  it('VitalRef has name, normalRange, and unit', () => {
    const v: VitalRef = {
      name: 'Heart Rate',
      normalRange: '60-100',
      unit: 'bpm',
    };
    expect(v.name).toBe('Heart Rate');
    expect(v.normalRange).toBe('60-100');
    expect(v.unit).toBe('bpm');
  });

  it('ClinicalPearlRef source and conditionName are optional', () => {
    const minimal: ClinicalPearlRef = { content: 'test pearl' };
    expect(minimal.source).toBeUndefined();
    expect(minimal.conditionName).toBeUndefined();

    const full: ClinicalPearlRef = {
      content: 'STEMI door-to-balloon < 90 min',
      source: "Harrison's",
      conditionName: 'STEMI',
    };
    expect(full.source).toBe("Harrison's");
  });

  it('DifferentialFeature distinguishingFeatures is a string array', () => {
    const df: DifferentialFeature = {
      conditionName: 'PE',
      distinguishingFeatures: ['pleuritic chest pain', 'tachycardia', 'DVT history'],
    };
    expect(df.distinguishingFeatures).toHaveLength(3);
    expect(df.conditionName).toBe('PE');
  });

  it('relatedConditions is a string array (condition names)', () => {
    const data: QuickRefData = {
      normalLabs: [],
      vitalRanges: [],
      relevantPearls: [],
      differentialFeatures: [],
      relatedConditions: ['Heart Failure', 'Cardiomyopathy'],
    };
    expect(data.relatedConditions).toContain('Heart Failure');
    expect(data.relatedConditions).toHaveLength(2);
  });
});
