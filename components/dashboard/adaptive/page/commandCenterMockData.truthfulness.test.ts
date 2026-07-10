/**
 * Phase 7 — dashboard truthfulness guard.
 *
 * Every entry in the command-center *fallback* datasets must be tagged
 * `source: 'mock'`. Widgets rely on that tag to render a visible "mock" /
 * "calibrating" badge instead of presenting placeholder data as real student
 * progress. If someone adds a fallback row without the mock marker (or mislabels
 * it 'analytics'), this test fails — preventing mock data from silently shipping
 * as real.
 */
import { describe, it, expect } from 'vitest';
import {
  fallbackReadinessVitals,
  fallbackStudyPrescriptionTasks,
  fallbackOrganSystemHeatmap,
  fallbackReadinessTimeline,
  fallbackClinicalLabCases,
  fallbackQuestionReviewRows,
} from './commandCenterMockData';

const datasets: Array<{ name: string; rows: Array<{ source?: string }> }> = [
  { name: 'fallbackReadinessVitals', rows: fallbackReadinessVitals },
  { name: 'fallbackStudyPrescriptionTasks', rows: fallbackStudyPrescriptionTasks },
  { name: 'fallbackOrganSystemHeatmap', rows: fallbackOrganSystemHeatmap },
  { name: 'fallbackReadinessTimeline', rows: fallbackReadinessTimeline },
  { name: 'fallbackClinicalLabCases', rows: fallbackClinicalLabCases },
  { name: 'fallbackQuestionReviewRows', rows: fallbackQuestionReviewRows },
];

describe('command-center fallback data is honestly tagged as mock', () => {
  for (const { name, rows } of datasets) {
    it(`${name}: every entry has source === 'mock'`, () => {
      expect(rows.length).toBeGreaterThan(0);
      const mislabeled = rows.filter((r) => r.source !== 'mock');
      expect(
        mislabeled,
        `${name} has ${mislabeled.length} entr(y/ies) not tagged source:'mock' — they could render as real progress`
      ).toEqual([]);
    });
  }
});
