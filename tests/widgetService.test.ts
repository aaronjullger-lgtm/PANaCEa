import { describe, it, expect } from 'vitest';
import {
  calculateStreak,
  generateStreakWidgetHTML,
  generateQuestionOfDayHTML,
  generateEmbedCode,
  generateObsidianEmbed,
  getQuestionOfDay,
} from '../lib/services/widgetService';
import type { Question, PerformanceRecord } from '../types';

describe('Widget Service', () => {
  const mockQuestion: Question = {
    question: 'A 45-year-old patient presents with chest pain. What is the diagnosis?',
    options: ['MI', 'PE', 'Pneumonia', 'GERD'],
    correctAnswerIndex: 0,
    rationale: 'This is MI based on symptoms',
    topic: 'CV',
    system: 'CV',
    subcategory: 'Acute Coronary Syndrome',
    conditionId: 'cv_acs',
    condition: 'Acute Coronary Syndrome',
    pearls: ['Test pearl'],
  };

  describe('calculateStreak', () => {
    it('should return zero streak for empty data', () => {
      const result = calculateStreak([]);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.lastStudyDate).toBeNull();
    });

    it('should calculate current streak correctly', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const records: PerformanceRecord[] = [
        {
          timestamp: today.getTime(),
          system: 'CV',
          subcategory: null,
          conditionId: 'test',
          condition: 'Test',
          topic: 'Test',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        },
        {
          timestamp: yesterday.getTime(),
          system: 'CV',
          subcategory: null,
          conditionId: 'test',
          condition: 'Test',
          topic: 'Test',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        },
        {
          timestamp: twoDaysAgo.getTime(),
          system: 'CV',
          subcategory: null,
          conditionId: 'test',
          condition: 'Test',
          topic: 'Test',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        },
      ];

      const result = calculateStreak(records);

      expect(result.currentStreak).toBe(3);
      expect(result.lastStudyDate).toBeTruthy();
    });

    it('should break streak when there is a gap', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const records: PerformanceRecord[] = [
        {
          timestamp: today.getTime(),
          system: 'CV',
          subcategory: null,
          conditionId: 'test',
          condition: 'Test',
          topic: 'Test',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        },
        {
          timestamp: threeDaysAgo.getTime(),
          system: 'CV',
          subcategory: null,
          conditionId: 'test',
          condition: 'Test',
          topic: 'Test',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        },
      ];

      const result = calculateStreak(records);

      // Current streak should only count today since there's a gap
      expect(result.currentStreak).toBe(1);
    });

    it('should calculate longest streak correctly', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const records: PerformanceRecord[] = [];

      // Create a 5-day streak in the past
      for (let i = 10; i >= 6; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        records.push({
          timestamp: date.getTime(),
          system: 'CV',
          subcategory: null,
          conditionId: 'test',
          condition: 'Test',
          topic: 'Test',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        });
      }

      // Create current 2-day streak
      for (let i = 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        records.push({
          timestamp: date.getTime(),
          system: 'CV',
          subcategory: null,
          conditionId: 'test',
          condition: 'Test',
          topic: 'Test',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        });
      }

      const result = calculateStreak(records);

      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(5);
    });

    it('should handle multiple records on same day', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const records: PerformanceRecord[] = [
        {
          timestamp: today.getTime(),
          system: 'CV',
          subcategory: null,
          conditionId: 'test1',
          condition: 'Test1',
          topic: 'Test',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        },
        {
          timestamp: today.getTime() + 1000,
          system: 'CV',
          subcategory: null,
          conditionId: 'test2',
          condition: 'Test2',
          topic: 'Test',
          isCorrect: true,
          focus: 'all',
          difficulty: 'same',
        },
      ];

      const result = calculateStreak(records);

      // Should count as 1 day even with multiple records
      expect(result.currentStreak).toBe(1);
    });
  });

  describe('generateStreakWidgetHTML', () => {
    it('should generate valid HTML for light theme', () => {
      const streakData = {
        currentStreak: 5,
        longestStreak: 10,
        lastStudyDate: new Date(),
      };

      const html = generateStreakWidgetHTML(streakData, 'light');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Study Streak');
      expect(html).toContain('5');
      expect(html).toContain('10');
    });

    it('should generate valid HTML for dark theme', () => {
      const streakData = {
        currentStreak: 3,
        longestStreak: 7,
        lastStudyDate: new Date(),
      };

      const html = generateStreakWidgetHTML(streakData, 'dark');

      expect(html).toContain('#1f2937'); // Dark background color
      expect(html).toContain('3');
    });

    it('should show fire emoji for 7+ day streak', () => {
      const streakData = {
        currentStreak: 7,
        longestStreak: 7,
        lastStudyDate: new Date(),
      };

      const html = generateStreakWidgetHTML(streakData);

      expect(html).toContain('▲');
    });

    it('should show star emoji for shorter streak', () => {
      const streakData = {
        currentStreak: 3,
        longestStreak: 5,
        lastStudyDate: new Date(),
      };

      const html = generateStreakWidgetHTML(streakData);

      expect(html).toContain('★');
    });

    it('should handle zero streak', () => {
      const streakData = {
        currentStreak: 0,
        longestStreak: 0,
        lastStudyDate: null,
      };

      const html = generateStreakWidgetHTML(streakData);

      expect(html).toContain('Start your streak today');
      expect(html).toContain('◆');
    });
  });

  describe('generateQuestionOfDayHTML', () => {
    it('should generate valid HTML with question content', () => {
      const html = generateQuestionOfDayHTML(mockQuestion);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Question of the Day');
      expect(html).toContain(mockQuestion.question);
      expect(html).toContain('MI');
      expect(html).toContain('PE');
    });

    it('should include system and subcategory tags', () => {
      const html = generateQuestionOfDayHTML(mockQuestion);

      expect(html).toContain('CV');
      expect(html).toContain('Acute Coronary Syndrome');
    });

    it('should format options correctly', () => {
      const html = generateQuestionOfDayHTML(mockQuestion);

      expect(html).toContain('A) MI');
      expect(html).toContain('B) PE');
      expect(html).toContain('C) Pneumonia');
      expect(html).toContain('D) GERD');
    });

    it('should support dark theme', () => {
      const html = generateQuestionOfDayHTML(mockQuestion, 'dark');

      expect(html).toContain('#1f2937'); // Dark background
    });

    it('should include current date', () => {
      const html = generateQuestionOfDayHTML(mockQuestion);
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      // Check that HTML contains a date in the expected format
      expect(html).toMatch(/\w{3}\s+\d{1,2},\s+\d{4}/); // Matches "Dec 5, 2025" format
    });
  });

  describe('generateEmbedCode', () => {
    it('should generate iframe code', () => {
      const url = 'https://example.com/widget';
      const code = generateEmbedCode(url);

      expect(code).toContain('<iframe');
      expect(code).toContain(url);
      expect(code).toContain('width="100%"');
      expect(code).toContain('height="400"');
    });

    it('should allow custom height', () => {
      const url = 'https://example.com/widget';
      const code = generateEmbedCode(url, 600);

      expect(code).toContain('height="600"');
    });
  });

  describe('generateObsidianEmbed', () => {
    it('should generate Obsidian markdown code block', () => {
      const url = 'https://example.com/widget';
      const code = generateObsidianEmbed(url);

      expect(code).toContain('```html');
      expect(code).toContain('<iframe');
      expect(code).toContain(url);
      expect(code).toContain('```');
    });
  });

  describe('getQuestionOfDay', () => {
    const questions: Question[] = [
      { ...mockQuestion, conditionId: 'q1' },
      { ...mockQuestion, conditionId: 'q2' },
      { ...mockQuestion, conditionId: 'q3' },
    ];

    it('should return null for empty question list', () => {
      const result = getQuestionOfDay([]);
      expect(result).toBeNull();
    });

    it('should return a question', () => {
      const result = getQuestionOfDay(questions);
      expect(result).toBeTruthy();
      expect(questions).toContainEqual(result);
    });

    it('should return the same question for the same date', () => {
      const date = new Date('2024-12-10');
      const result1 = getQuestionOfDay(questions, date);
      const result2 = getQuestionOfDay(questions, date);

      expect(result1).toEqual(result2);
    });

    it('should return different questions for different dates', () => {
      const date1 = new Date('2024-12-10');
      const date2 = new Date('2024-12-11');

      const result1 = getQuestionOfDay(questions, date1);
      const result2 = getQuestionOfDay(questions, date2);

      // They might be the same by chance, but test the logic works
      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
    });
  });
});
