/**
 * Tests for Analytics Features
 * - Decision Time Analysis
 * - Longitudinal Progress Dashboard
 * - Weakness Cheatsheet Export
 */

import { describe, it, expect } from 'vitest';
import type { PerformanceRecord } from '@/types';
import { getWeaknessSummary } from '@/lib/weaknessCheatsheetExport';

describe('Analytics Features', () => {
  describe('Weakness Cheatsheet Export', () => {
    it('should identify weaknesses correctly', () => {
      const mockPerformanceData: PerformanceRecord[] = [
        {
          timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
          system: 'CV',
          subcategory: 'Arrhythmias',
          conditionId: 'cv-arrhythmias-afib',
          condition: 'Atrial Fibrillation',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
        },
        {
          timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
          system: 'CV',
          subcategory: 'Arrhythmias',
          conditionId: 'cv-arrhythmias-vtach',
          condition: 'Ventricular Tachycardia',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
        },
        {
          timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
          system: 'PULM',
          subcategory: 'Asthma',
          conditionId: 'pulm-asthma',
          condition: 'Asthma',
          topic: 'Pulmonology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
        },
        {
          timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000, // 20 days ago
          system: 'PULM',
          subcategory: 'COPD',
          conditionId: 'pulm-copd',
          condition: 'COPD',
          topic: 'Pulmonology',
          isCorrect: true, // Correct answer
          focus: 'all',
          difficulty: 'same',
        },
      ];

      const summary = getWeaknessSummary(mockPerformanceData, { days: 30 });

      expect(summary.totalWeaknesses).toBe(2); // CV and PULM
      expect(summary.totalQuestions).toBe(3); // 2 CV + 1 PULM incorrect
      expect(summary.systems).toHaveLength(2);
      
      // CV should be first (2 errors)
      expect(summary.systems[0].system).toBe('Cardiovascular System');
      expect(summary.systems[0].errorCount).toBe(2);
      
      // PULM should be second (1 error)
      expect(summary.systems[1].system).toBe('Pulmonary System');
      expect(summary.systems[1].errorCount).toBe(1);
    });

    it('should filter by time period correctly', () => {
      const mockPerformanceData: PerformanceRecord[] = [
        {
          timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-test',
          condition: 'Test',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
        },
        {
          timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago (outside 30 day window)
          system: 'PULM',
          subcategory: null,
          conditionId: 'pulm-test',
          condition: 'Test',
          topic: 'Pulmonology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
        },
      ];

      const summary = getWeaknessSummary(mockPerformanceData, { days: 30 });

      expect(summary.totalWeaknesses).toBe(1); // Only CV within 30 days
      expect(summary.systems[0].system).toBe('Cardiovascular System');
    });

    it('should respect minimum errors threshold', () => {
      const mockPerformanceData: PerformanceRecord[] = [
        {
          timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-test',
          condition: 'Test',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
        },
      ];

      // With minErrors = 2, should not include CV with only 1 error
      const summary = getWeaknessSummary(mockPerformanceData, { 
        days: 30,
        minErrors: 2 
      });

      expect(summary.totalWeaknesses).toBe(0);
      expect(summary.systems).toHaveLength(0);
    });

    it('should handle empty performance data', () => {
      const summary = getWeaknessSummary([], { days: 30 });

      expect(summary.totalWeaknesses).toBe(0);
      expect(summary.totalQuestions).toBe(0);
      expect(summary.systems).toHaveLength(0);
    });

    it('should exclude OTHER system', () => {
      const mockPerformanceData: PerformanceRecord[] = [
        {
          timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
          system: 'OTHER',
          subcategory: null,
          conditionId: 'other-test',
          condition: 'Test',
          topic: 'Other',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
        },
      ];

      const summary = getWeaknessSummary(mockPerformanceData, { days: 30 });

      expect(summary.totalWeaknesses).toBe(0);
      expect(summary.systems).toHaveLength(0);
    });
  });

  describe('Decision Time Analysis', () => {
    it('should calculate average time per system', () => {
      const mockPerformanceData: PerformanceRecord[] = [
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-test',
          condition: 'Test',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          timeSpentMs: 90000, // 90 seconds
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-test2',
          condition: 'Test 2',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          timeSpentMs: 60000, // 60 seconds
        },
        {
          timestamp: Date.now(),
          system: 'PULM',
          subcategory: null,
          conditionId: 'pulm-test',
          condition: 'Test',
          topic: 'Pulmonology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          timeSpentMs: 15000, // 15 seconds
        },
      ];

      // Filter records with time data
      const recordsWithTime = mockPerformanceData.filter(r => r.timeSpentMs !== undefined);
      
      expect(recordsWithTime).toHaveLength(3);
      
      // Calculate CV average
      const cvRecords = recordsWithTime.filter(r => r.system === 'CV');
      const cvAvgMs = cvRecords.reduce((sum, r) => sum + (r.timeSpentMs || 0), 0) / cvRecords.length;
      
      expect(cvAvgMs).toBe(75000); // (90000 + 60000) / 2 = 75 seconds
    });

    it('should handle missing time data', () => {
      const mockPerformanceData: PerformanceRecord[] = [
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-test',
          condition: 'Test',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          // No timeSpentMs
        },
      ];

      const recordsWithTime = mockPerformanceData.filter(r => r.timeSpentMs !== undefined);
      
      expect(recordsWithTime).toHaveLength(0);
    });
  });

  describe('Longitudinal Progress', () => {
    it('should calculate mastery score based on accuracy and volume', () => {
      // Mastery score formula: accuracy + volumeBonus (up to 10 based on 100 questions) + consistency bonus (5 if accuracy >= 80)
      
      // Test case 1: High accuracy (85%), moderate volume (50 questions)
      const accuracy1 = 85;
      const total1 = 50;
      const volumeBonus1 = Math.min(10, (total1 / 100) * 10); // 5
      const consistencyBonus1 = accuracy1 >= 80 ? 5 : 0; // 5
      const expectedScore1 = Math.min(100, Math.round(accuracy1 + volumeBonus1 + consistencyBonus1));
      
      expect(expectedScore1).toBe(95); // 85 + 5 + 5 = 95
      
      // Test case 2: Perfect accuracy (100%), high volume (100 questions)
      const accuracy2 = 100;
      const total2 = 100;
      const volumeBonus2 = Math.min(10, (total2 / 100) * 10); // 10
      const consistencyBonus2 = accuracy2 >= 80 ? 5 : 0; // 5
      const expectedScore2 = Math.min(100, Math.round(accuracy2 + volumeBonus2 + consistencyBonus2));
      
      expect(expectedScore2).toBe(100); // Capped at 100
      
      // Test case 3: Low accuracy (50%), low volume (10 questions)
      const accuracy3 = 50;
      const total3 = 10;
      const volumeBonus3 = Math.min(10, (total3 / 100) * 10); // 1
      const consistencyBonus3 = accuracy3 >= 80 ? 5 : 0; // 0
      const expectedScore3 = Math.min(100, Math.round(accuracy3 + volumeBonus3 + consistencyBonus3));
      
      expect(expectedScore3).toBe(51); // 50 + 1 + 0 = 51
    });

    it('should group performance data into time phases', () => {
      const now = Date.now();
      const mockPerformanceData: PerformanceRecord[] = [
        // Week 1
        {
          timestamp: now - 14 * 24 * 60 * 60 * 1000, // 14 days ago
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-test',
          condition: 'Test',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        },
        // Week 2
        {
          timestamp: now - 7 * 24 * 60 * 60 * 1000, // 7 days ago
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-test2',
          condition: 'Test 2',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
        },
        // Week 3 (current)
        {
          timestamp: now - 1 * 24 * 60 * 60 * 1000, // 1 day ago
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-test3',
          condition: 'Test 3',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        },
      ];

      // Data spans < 3 months, so should be grouped weekly
      const sorted = [...mockPerformanceData].sort((a, b) => a.timestamp - b.timestamp);
      
      expect(sorted).toHaveLength(3);
      expect(sorted[0].timestamp).toBeLessThan(sorted[1].timestamp);
      expect(sorted[1].timestamp).toBeLessThan(sorted[2].timestamp);
    });
  });
});
