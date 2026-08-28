import { describe, expect, it } from 'vitest';
import {
  normalizeDiagnosesResponse,
  normalizeLabCasesResponse,
} from './labCaseService';

describe('labCaseService response normalization', () => {
  it('unwraps lab cases from the API envelope', () => {
    const labCase = {
      id: 'lab_case_1',
      clinicalContext: 'A 42-year-old patient with fatigue and pallor.',
      patientAge: 42,
      patientSex: 'F',
      panels: [
        {
          name: 'Complete Blood Count',
          values: [
            {
              name: 'Hemoglobin',
              value: '8.4',
              unit: 'g/dL',
              referenceRange: '12.0-16.0',
              isAbnormal: true,
              abnormalDirection: 'low',
            },
          ],
        },
      ],
      correctDiagnosis: 'Iron Deficiency Anemia',
      keyFindings: ['Hemoglobin: 8.4 g/dL (low)'],
      explanation: 'Microcytic anemia with low hemoglobin suggests iron deficiency.',
      category: 'hematology',
    };

    const result = normalizeLabCasesResponse({
      ok: true,
      data: {
        success: true,
        cases: [labCase],
        total: 1,
      },
    });

    expect(result.cases).toEqual([labCase]);
    expect(result.total).toBe(1);
  });

  it('unwraps diagnoses from the API envelope', () => {
    const result = normalizeDiagnosesResponse({
      ok: true,
      data: {
        success: true,
        diagnoses: ['Diabetic Ketoacidosis', 'Iron Deficiency Anemia'],
      },
    });

    expect(result.diagnoses).toEqual(['Diabetic Ketoacidosis', 'Iron Deficiency Anemia']);
  });
});
