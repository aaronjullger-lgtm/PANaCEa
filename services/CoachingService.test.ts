import { describe, it, expect } from 'vitest';
import {
  calculateUserMetrics,
  generateStudyPrescription,
  analyzeSearchHistory,
  type UserMetrics,
  type SearchHistoryEntry
} from './CoachingService';
import type { PerformanceRecord } from '@/types';

describe('CoachingService', () => {
  describe('calculateUserMetrics', () => {
    it('should return empty metrics for empty data', () => {
      const metrics = calculateUserMetrics([]);
      
      expect(metrics.totalQuestions).toBe(0);
      expect(metrics.overallAccuracy).toBe(0);
      expect(metrics.averageQuestionTime).toBe(0);
      expect(metrics.secondGuessRate).toBe(0);
    });

    it('should calculate average question time correctly', () => {
      const mockData: PerformanceRecord[] = [
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: 'Cardiology',
          conditionId: 'cv-1',
          condition: 'MI',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          timeSpentMs: 30000
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: 'Cardiology',
          conditionId: 'cv-2',
          condition: 'CHF',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
          timeSpentMs: 60000
        }
      ];

      const metrics = calculateUserMetrics(mockData);
      expect(metrics.averageQuestionTime).toBe(45000); // (30000 + 60000) / 2
    });

    it('should calculate second-guess rate correctly', () => {
      const mockData: PerformanceRecord[] = [
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-1',
          condition: 'MI',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          finalAnswerWasChanged: true
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-2',
          condition: 'CHF',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
          finalAnswerWasChanged: false
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-3',
          condition: 'Arrhythmia',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          finalAnswerWasChanged: true
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-4',
          condition: 'HTN',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          finalAnswerWasChanged: false
        }
      ];

      const metrics = calculateUserMetrics(mockData);
      expect(metrics.secondGuessRate).toBe(50); // 2 out of 4 changed
    });

    it('should calculate overall accuracy correctly', () => {
      const mockData: PerformanceRecord[] = [
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-1',
          condition: 'MI',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same'
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-2',
          condition: 'CHF',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same'
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-3',
          condition: 'Arrhythmia',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same'
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-4',
          condition: 'HTN',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same'
        }
      ];

      const metrics = calculateUserMetrics(mockData);
      expect(metrics.overallAccuracy).toBe(75); // 3 out of 4 correct
    });

    it('should calculate vignette stamina correctly', () => {
      const mockData: PerformanceRecord[] = [
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-1',
          condition: 'MI',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          questionWordCount: 50 // Short
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-2',
          condition: 'CHF',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
          questionWordCount: 150 // Long
        },
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-3',
          condition: 'Arrhythmia',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
          questionWordCount: 200 // Long
        }
      ];

      const metrics = calculateUserMetrics(mockData);
      
      expect(metrics.vignetteStamina.shortQuestions.total).toBe(1);
      expect(metrics.vignetteStamina.shortQuestions.correct).toBe(1);
      expect(metrics.vignetteStamina.longQuestions.total).toBe(2);
      expect(metrics.vignetteStamina.longQuestions.correct).toBe(1);
    });
  });

  describe('generateStudyPrescription', () => {
    it('should recommend more questions for insufficient data', () => {
      const mockData: PerformanceRecord[] = Array(5).fill({
        timestamp: Date.now(),
        system: 'CV',
        subcategory: null,
        conditionId: 'cv-1',
        condition: 'MI',
        topic: 'Cardiology',
        isCorrect: true,
        focus: 'all',
        difficulty: 'same'
      });

      const prescription = generateStudyPrescription(mockData);
      
      expect(prescription.prescription).toContain('at least 10 questions');
      expect(prescription.confidence).toBe(0);
    });

    it('should identify vignette stamina issues', () => {
      const mockData: PerformanceRecord[] = [
        // Short questions - high accuracy
        ...Array(5).fill(null).map(() => ({
          timestamp: Date.now(),
          system: 'CV' as any,
          subcategory: null,
          conditionId: 'cv-1',
          condition: 'MI',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'topic' as any,
          difficulty: 'same' as any,
          questionWordCount: 20
        })),
        // Long questions - low accuracy
        ...Array(5).fill(null).map(() => ({
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-2',
          condition: 'CHF',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same',
          questionWordCount: 150
        }))
      ];

      const prescription = generateStudyPrescription(mockData);
      
      expect(prescription.prescription).toContain('longer vignettes');
      expect(prescription.focusAreas.some(area => 
        area.toLowerCase().includes('stamina') || area.toLowerCase().includes('reading')
      )).toBe(true);
    });

    it('should identify high second-guess rate', () => {
      const mockData: PerformanceRecord[] = Array(10).fill(null).map(() => ({
        timestamp: Date.now(),
        system: 'CV',
        subcategory: null,
        conditionId: 'cv-1',
        condition: 'MI',
        topic: 'Cardiology',
        isCorrect: true,
        focus: 'all',
        difficulty: 'same',
        finalAnswerWasChanged: true // Everyone changes their answer
      }));

      const prescription = generateStudyPrescription(mockData);
      
      expect(prescription.prescription).toContain('change your answer');
    });

    it('should find optimal time slot', () => {
      const now = new Date();
      const hour8AM = new Date(now);
      hour8AM.setHours(8, 0, 0, 0);
      
      const mockData: PerformanceRecord[] = [
        // High performance at 8 AM
        ...Array(5).fill(null).map(() => ({
          timestamp: hour8AM.getTime(),
          system: 'CV' as any,
          subcategory: null,
          conditionId: 'cv-1',
          condition: 'MI',
          topic: 'Cardiology',
          isCorrect: true,
          focus: 'all' as any,
          difficulty: 'same' as any
        })),
        // Low performance at other times
        ...Array(5).fill(null).map(() => ({
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-2',
          condition: 'CHF',
          topic: 'Cardiology',
          isCorrect: false,
          focus: 'all',
          difficulty: 'same'
        }))
      ];

      const prescription = generateStudyPrescription(mockData);
      
      expect(prescription.optimalTimeSlot).toBeDefined();
      expect(prescription.prescription).toContain('perform best during');
    });

    it('should increase confidence with more data', () => {
      const smallDataset: PerformanceRecord[] = Array(10).fill({
        timestamp: Date.now(),
        system: 'CV',
        subcategory: null,
        conditionId: 'cv-1',
        condition: 'MI',
        topic: 'Cardiology',
        isCorrect: true,
        focus: 'all',
        difficulty: 'same'
      });

      const largeDataset: PerformanceRecord[] = Array(50).fill({
        timestamp: Date.now(),
        system: 'CV',
        subcategory: null,
        conditionId: 'cv-1',
        condition: 'MI',
        topic: 'Cardiology',
        isCorrect: true,
        focus: 'all',
        difficulty: 'same'
      });

      const smallPrescription = generateStudyPrescription(smallDataset);
      const largePrescription = generateStudyPrescription(largeDataset);
      
      expect(largePrescription.confidence).toBeGreaterThan(smallPrescription.confidence);
    });
  });

  describe('analyzeSearchHistory', () => {
    it('should identify frequently searched terms', () => {
      const searchHistory: SearchHistoryEntry[] = [
        { query: 'pneumonia', timestamp: Date.now(), resultCount: 5 },
        { query: 'pneumonia', timestamp: Date.now(), resultCount: 5 },
        { query: 'copd', timestamp: Date.now(), resultCount: 3 },
        { query: 'asthma', timestamp: Date.now(), resultCount: 4 },
        { query: 'copd', timestamp: Date.now(), resultCount: 3 },
        { query: 'pneumonia', timestamp: Date.now(), resultCount: 5 }
      ];

      const performanceData: PerformanceRecord[] = [];

      const analysis = analyzeSearchHistory(searchHistory, performanceData);
      
      expect(analysis.frequentlySearched[0]).toBe('pneumonia'); // Most searched
      expect(analysis.frequentlySearched).toContain('copd');
    });

    it('should identify rarely drilled topics', () => {
      const searchHistory: SearchHistoryEntry[] = [
        { query: 'pneumonia', timestamp: Date.now(), resultCount: 5 },
        { query: 'pneumonia', timestamp: Date.now(), resultCount: 5 },
        { query: 'copd', timestamp: Date.now(), resultCount: 3 }
      ];

      const performanceData: PerformanceRecord[] = [
        {
          timestamp: Date.now(),
          system: 'CV',
          subcategory: null,
          conditionId: 'cv-1',
          condition: 'MI',
          topic: 'Cardiology', // Not pneumonia or COPD
          isCorrect: true,
          focus: 'all',
          difficulty: 'same'
        }
      ];

      const analysis = analyzeSearchHistory(searchHistory, performanceData);
      
      // Pneumonia and COPD are searched but not drilled
      expect(analysis.rarelyDrilled).toContain('pneumonia');
      expect(analysis.rarelyDrilled).toContain('copd');
    });

    it('should handle empty search history', () => {
      const analysis = analyzeSearchHistory([], []);
      
      expect(analysis.frequentlySearched).toEqual([]);
      expect(analysis.rarelyDrilled).toEqual([]);
    });
  });
});
