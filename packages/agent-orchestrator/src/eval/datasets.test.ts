import { describe, it, expect } from 'vitest';
import {
  DATASETS,
  DATASET_NAMES,
  getDataset,
  describeDatasets,
  type DatasetCase,
} from './datasets';

// ─── DATASETS constant ───────────────────────────────────────────────────────

describe('DATASETS', () => {
  it('contains 8 dataset keys', () => {
    expect(Object.keys(DATASETS)).toHaveLength(8);
  });

  it('each dataset has at least 1 case', () => {
    for (const [name, cases] of Object.entries(DATASETS)) {
      expect(cases.length, `${name} should have cases`).toBeGreaterThanOrEqual(1);
    }
  });

  it('each case has required fields', () => {
    for (const [name, cases] of Object.entries(DATASETS)) {
      for (const tc of cases) {
        expect(tc.id, `${name}/${tc.id} missing id`).toBeTruthy();
        expect(tc.agentRole, `${name}/${tc.id} missing agentRole`).toBeTruthy();
        expect(tc.input, `${name}/${tc.id} missing input`).toBeTruthy();
      }
    }
  });

  it('content-audit dataset has 3 cases', () => {
    expect(DATASETS['content-audit']).toHaveLength(3);
  });

  it('code-reviewer dataset has 4 cases', () => {
    expect(DATASETS['code-reviewer']).toHaveLength(4);
  });

  it('clinical-validator dataset has 3 cases', () => {
    expect(DATASETS['clinical-validator']).toHaveLength(3);
  });

  it('code-reviewer clean case expects APPROVE and forbids REQUEST_CHANGES', () => {
    const cleanCase = DATASETS['code-reviewer']!.find((c) => c.id === 'cr-004')!;
    expect(cleanCase.expectedContains).toContain('APPROVE');
    expect(cleanCase.expectedNotContains).toContain('REQUEST_CHANGES');
  });

  it('clinical-validator cv-002 expects INCORRECT and beta-blocker', () => {
    const tc = DATASETS['clinical-validator']!.find((c) => c.id === 'cv-002')!;
    expect(tc.expectedContains).toContain('INCORRECT');
    expect(tc.expectedContains).toContain('beta-blocker');
  });
});

// ─── DATASET_NAMES ───────────────────────────────────────────────────────────

describe('DATASET_NAMES', () => {
  it('matches DATASETS keys', () => {
    expect(DATASET_NAMES).toEqual(Object.keys(DATASETS));
  });

  it('includes all expected roles', () => {
    const expected = [
      'content-audit',
      'ddx-generator',
      'soap-note-grader',
      'feedback-summarizer',
      'diagnostic-workup-advisor',
      'code-reviewer',
      'clinical-validator',
      'security-auditor',
    ];
    for (const name of expected) {
      expect(DATASET_NAMES).toContain(name);
    }
  });
});

// ─── getDataset ──────────────────────────────────────────────────────────────

describe('getDataset', () => {
  it('returns dataset for valid name', () => {
    const ds = getDataset('content-audit');
    expect(ds).not.toBeNull();
    expect(ds).toHaveLength(3);
    expect(ds![0]!.agentRole).toBe('content-audit');
  });

  it('returns null for unknown name', () => {
    expect(getDataset('nonexistent')).toBeNull();
  });

  it('returns correct dataset for each role', () => {
    for (const name of DATASET_NAMES) {
      const ds = getDataset(name);
      expect(ds, `getDataset("${name}") should not be null`).not.toBeNull();
      expect(ds![0]!.agentRole).toBe(name);
    }
  });
});

// ─── describeDatasets ────────────────────────────────────────────────────────

describe('describeDatasets', () => {
  it('returns one entry per dataset', () => {
    const descriptions = describeDatasets();
    expect(descriptions).toHaveLength(DATASET_NAMES.length);
  });

  it('each entry has name, caseCount, and agentRole', () => {
    const descriptions = describeDatasets();
    for (const desc of descriptions) {
      expect(desc.name).toBeTruthy();
      expect(desc.caseCount).toBeGreaterThanOrEqual(1);
      expect(desc.agentRole).toBeTruthy();
    }
  });

  it('caseCount matches actual dataset length', () => {
    const descriptions = describeDatasets();
    for (const desc of descriptions) {
      const ds = getDataset(desc.name);
      expect(desc.caseCount).toBe(ds!.length);
    }
  });

  it('agentRole matches first case agentRole', () => {
    const descriptions = describeDatasets();
    for (const desc of descriptions) {
      const ds = getDataset(desc.name);
      expect(desc.agentRole).toBe(ds![0]!.agentRole);
    }
  });

  it('content-audit entry is correct', () => {
    const descriptions = describeDatasets();
    const ca = descriptions.find((d) => d.name === 'content-audit')!;
    expect(ca.caseCount).toBe(3);
    expect(ca.agentRole).toBe('content-audit');
  });
});
