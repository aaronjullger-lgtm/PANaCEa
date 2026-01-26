import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMissedQuestionsToday,
  questionToAnkiCard,
  exportToAnkiText,
  exportToAnkiConnect,
  exportMissedTodayToAnki,
} from '../lib/services/ankiExportService';
import type { Question, PerformanceRecord } from '../types';

describe('Anki Export Service', () => {
  const mockQuestion: Question = {
    question:
      'A 45-year-old patient presents with chest pain. What is the most appropriate next step?',
    options: ['Obtain ECG', 'Give aspirin', 'Send home with follow-up', 'Order CT scan'],
    correctAnswerIndex: 0,
    rationale: 'ECG is the first step in evaluating chest pain to rule out acute MI.',
    topic: 'CV',
    system: 'CV',
    subcategory: 'Acute Coronary Syndrome',
    conditionId: 'CV__acs__unstable_angina',
    condition: 'Acute Coronary Syndrome',
    pearls: [
      'ECG should be obtained within 10 minutes',
      'Serial troponins are important',
      'MONA protocol: Morphine, Oxygen, Nitroglycerin, Aspirin',
    ],
  };

  const mockPerformanceRecords: PerformanceRecord[] = [
    {
      timestamp: Date.now(),
      system: 'CV',
      subcategory: 'Acute Coronary Syndrome',
      conditionId: 'CV__acs__unstable_angina',
      condition: 'Acute Coronary Syndrome',
      topic: 'CV',
      isCorrect: false,
      focus: 'all',
    },
    {
      timestamp: Date.now() - 86400000, // Yesterday
      system: 'CV',
      subcategory: 'Acute Coronary Syndrome',
      conditionId: 'CV__acs__unstable_angina',
      condition: 'Acute Coronary Syndrome',
      topic: 'CV',
      isCorrect: false,
      focus: 'all',
    },
  ];

  describe('getMissedQuestionsToday', () => {
    it('should return questions missed today', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayRecords: PerformanceRecord[] = [
        {
          timestamp: today.getTime(),
          system: 'CV',
          subcategory: 'Acute Coronary Syndrome',
          conditionId: 'CV__acs__unstable_angina',
          condition: 'Acute Coronary Syndrome',
          topic: 'CV',
          isCorrect: false,
          focus: 'all',
        },
      ];

      const missedQuestions = [mockQuestion];
      const result = getMissedQuestionsToday(todayRecords, missedQuestions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockQuestion);
    });

    it('should not return questions missed on previous days', () => {
      const yesterdayRecord: PerformanceRecord = {
        timestamp: Date.now() - 86400000, // Yesterday
        system: 'CV',
        subcategory: null,
        conditionId: 'different_condition',
        condition: 'Different Condition',
        topic: 'Different Topic',
        isCorrect: false,
        focus: 'all',
      };

      const missedQuestions: Question[] = [
        {
          ...mockQuestion,
          condition: 'Different Condition',
          topic: 'Different Topic',
        },
      ];

      const result = getMissedQuestionsToday([yesterdayRecord], missedQuestions);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when no questions were missed today', () => {
      const correctRecord: PerformanceRecord = {
        ...mockPerformanceRecords[0],
        isCorrect: true,
      };

      const result = getMissedQuestionsToday([correctRecord], [mockQuestion]);
      expect(result).toHaveLength(0);
    });
  });

  describe('questionToAnkiCard', () => {
    it('should convert question to Anki card format', () => {
      const card = questionToAnkiCard(mockQuestion);

      expect(card.front).toContain(mockQuestion.question);
      expect(card.front).toContain('A) Obtain ECG');
      expect(card.front).toContain('B) Give aspirin');

      expect(card.back).toContain('Answer: A)');
      expect(card.back).toContain('Obtain ECG');
      expect(card.back).toContain(mockQuestion.rationale);

      expect(card.tags).toContain('PANaCEa');
      expect(card.tags).toContain('PANCE');
      expect(card.tags).toContain('CV');

      expect(card.guid).toBe(mockQuestion.conditionId);
    });

    it('should include pearls when option is enabled', () => {
      const card = questionToAnkiCard(mockQuestion, { includePearls: true });

      expect(card.back).toContain('Key Pearls:');
      expect(card.back).toContain('ECG should be obtained within 10 minutes');
    });

    it('should exclude pearls when option is disabled', () => {
      const card = questionToAnkiCard(mockQuestion, { includePearls: false });

      expect(card.back).not.toContain('Key Pearls:');
    });

    it('should exclude rationale when option is disabled', () => {
      const card = questionToAnkiCard(mockQuestion, { includeRationale: false });

      expect(card.back).not.toContain('Explanation:');
      expect(card.back).not.toContain(mockQuestion.rationale);
    });

    it('should sanitize condition name for tags', () => {
      const questionWithSpecialChars: Question = {
        ...mockQuestion,
        condition: 'Type 2 Diabetes (DM2)',
      };

      const card = questionToAnkiCard(questionWithSpecialChars);

      expect(card.tags.some((tag) => tag.includes('Type_2_Diabetes_DM2'))).toBe(true);
    });
  });

  describe('exportToAnkiText', () => {
    it('should export questions in Anki text format', () => {
      const questions = [mockQuestion];
      const result = exportToAnkiText(questions);

      expect(result).toContain('#separator:tab');
      expect(result).toContain('#html:true');
      expect(result).toContain('#deck:PANaCEa_Missed_Questions');
      expect(result).toContain('#tags column:3');
      expect(result).toContain(mockQuestion.question.replace(/\n/g, '<br>'));
    });

    it('should use custom deck name when provided', () => {
      const questions = [mockQuestion];
      const result = exportToAnkiText(questions, { deckName: 'MyCustomDeck' });

      expect(result).toContain('#deck:MyCustomDeck');
    });

    it('should handle multiple questions', () => {
      const question2: Question = {
        ...mockQuestion,
        question: 'Different question',
        condition: 'Different condition',
      };

      const questions = [mockQuestion, question2];
      const result = exportToAnkiText(questions);

      expect(result).toContain(mockQuestion.question.replace(/\n/g, '<br>'));
      expect(result).toContain('Different question');
    });
  });

  describe('exportToAnkiConnect', () => {
    it('should export questions in AnkiConnect API format', () => {
      const questions = [mockQuestion];
      const result = exportToAnkiConnect(questions);

      expect(result).toHaveProperty('action', 'addNotes');
      expect(result).toHaveProperty('version', 6);
      expect(result).toHaveProperty('params');

      const params = (result as any).params;
      expect(params.notes).toHaveLength(1);
      expect(params.notes[0].deckName).toBe('PANaCEa_Missed_Questions');
      expect(params.notes[0].modelName).toBe('Basic');
      expect(params.notes[0].fields).toHaveProperty('Front');
      expect(params.notes[0].fields).toHaveProperty('Back');
      expect(params.notes[0].tags).toContain('PANaCEa');
    });

    it('should use custom deck name when provided', () => {
      const questions = [mockQuestion];
      const result = exportToAnkiConnect(questions, { deckName: 'CustomDeck' });

      const params = (result as any).params;
      expect(params.notes[0].deckName).toBe('CustomDeck');
    });
  });

  describe('exportMissedTodayToAnki', () => {
    beforeEach(() => {
      // Mock document methods for download functionality
      if (!global.document) {
        (global as any).document = {};
      }
      if (!global.document.body) {
        (global.document as any).body = {};
      }
      global.document.createElement = vi.fn().mockReturnValue({
        href: '',
        download: '',
        click: vi.fn(),
      });
      global.document.body.appendChild = vi.fn();
      global.document.body.removeChild = vi.fn();
      if (!global.URL) {
        (global as any).URL = {};
      }
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
      global.URL.revokeObjectURL = vi.fn();
    });

    it('should export missed questions from today', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayRecords: PerformanceRecord[] = [
        {
          timestamp: today.getTime(),
          system: 'CV',
          subcategory: 'Acute Coronary Syndrome',
          conditionId: 'CV__acs__unstable_angina',
          condition: 'Acute Coronary Syndrome',
          topic: 'CV',
          isCorrect: false,
          focus: 'all',
        },
      ];

      const missedQuestions = [mockQuestion];
      const result = exportMissedTodayToAnki(todayRecords, missedQuestions);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should return error when no questions were missed today', () => {
      const result = exportMissedTodayToAnki([], []);

      expect(result.success).toBe(false);
      expect(result.count).toBe(0);
      expect(result.error).toBe('No questions were missed today');
    });

    it('should handle errors gracefully', () => {
      // Mock to throw error
      const mockPerf: any[] = [
        {
          timestamp: Date.now(),
          isCorrect: false,
          condition: 'Test',
        },
      ];

      // Force an error by passing invalid data
      global.URL.createObjectURL = vi.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });

      const result = exportMissedTodayToAnki(mockPerf, [mockQuestion]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
