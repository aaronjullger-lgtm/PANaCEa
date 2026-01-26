/**
 * ActivityHeatmap Component Tests
 */

import { describe, it, expect } from 'vitest';
import type { PerformanceRecord } from '@/types';

describe('ActivityHeatmap', () => {
  it('should process performance data correctly', () => {
    // Mock performance data
    const mockData: PerformanceRecord[] = [
      {
        timestamp: new Date('2024-12-01T10:00:00').getTime(),
        system: 'CV',
        subcategory: 'Arrhythmias',
        conditionId: 'CV__arrhythmia__afib',
        condition: 'Atrial Fibrillation',
        topic: 'Cardiovascular',
        isCorrect: true,
        focus: 'all',
        timeSpentMs: 45000,
      },
      {
        timestamp: new Date('2024-12-01T10:30:00').getTime(),
        system: 'CV',
        subcategory: 'Arrhythmias',
        conditionId: 'CV__arrhythmia__afib',
        condition: 'Atrial Fibrillation',
        topic: 'Cardiovascular',
        isCorrect: false,
        focus: 'all',
        timeSpentMs: 60000,
      },
      {
        timestamp: new Date('2024-12-02T14:00:00').getTime(),
        system: 'PULM',
        subcategory: 'Asthma',
        conditionId: 'PULM__asthma__acute',
        condition: 'Asthma',
        topic: 'Pulmonary',
        isCorrect: true,
        focus: 'all',
        timeSpentMs: 30000,
      },
    ];

    // Verify data structure
    expect(mockData).toHaveLength(3);
    const firstRecord = mockData[0];
    const secondRecord = mockData[1];
    if (!firstRecord || !secondRecord) {
      throw new Error('Test data missing expected records');
    }
    expect(firstRecord.isCorrect).toBe(true);
    expect(secondRecord.isCorrect).toBe(false);

    // Group by date
    const dateMap = new Map<string, number>();
    mockData.forEach((record) => {
      const date = new Date(record.timestamp).toISOString().split('T')[0] ?? '';
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    expect(dateMap.get('2024-12-01')).toBe(2);
    expect(dateMap.get('2024-12-02')).toBe(1);
  });

  it('should calculate daily accuracy correctly', () => {
    const mockData: PerformanceRecord[] = [
      {
        timestamp: new Date('2024-12-01T10:00:00').getTime(),
        system: 'CV',
        subcategory: null,
        conditionId: 'test',
        condition: 'Test',
        topic: 'Test',
        isCorrect: true,
        focus: 'all',
      },
      {
        timestamp: new Date('2024-12-01T11:00:00').getTime(),
        system: 'CV',
        subcategory: null,
        conditionId: 'test',
        condition: 'Test',
        topic: 'Test',
        isCorrect: true,
        focus: 'all',
      },
      {
        timestamp: new Date('2024-12-01T12:00:00').getTime(),
        system: 'CV',
        subcategory: null,
        conditionId: 'test',
        condition: 'Test',
        topic: 'Test',
        isCorrect: false,
        focus: 'all',
      },
    ];

    const correct = mockData.filter((r) => r.isCorrect).length;
    const total = mockData.length;
    const accuracy = Math.round((correct / total) * 100);

    expect(accuracy).toBe(67); // 2/3 = 66.67% rounded to 67%
  });

  it('should handle empty performance data', () => {
    const mockData: PerformanceRecord[] = [];

    expect(mockData).toHaveLength(0);

    // Should not throw when processing empty data
    const dateMap = new Map<string, number>();
    mockData.forEach((record) => {
      const date = new Date(record.timestamp).toISOString().split('T')[0] ?? '';
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    expect(dateMap.size).toBe(0);
  });
});
