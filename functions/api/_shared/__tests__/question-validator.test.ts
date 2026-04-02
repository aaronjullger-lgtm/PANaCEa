import { describe, it, expect } from 'vitest';
import { validateGeneratedQuestion } from '../question-validator';
import { GeneratedQuestionStrict } from '../question-schema';

describe('validateGeneratedQuestion', () => {
  const createValidQuestion = (overrides?: Partial<GeneratedQuestionStrict>): GeneratedQuestionStrict => ({
    type: 'mcq',
    question: 'A 45-year-old patient presents with chest pain and shortness of breath. Physical exam reveals elevated heart rate and blood pressure. What is the most likely diagnosis?',
    options: ['Myocardial infarction', 'Pulmonary embolism', 'Pericarditis', 'Aortic dissection'],
    correctAnswer: 'Myocardial infarction',
    explanation: {
      rationale: 'The clinical presentation is consistent with acute myocardial infarction due to the combination of chest pain, dyspnea, and hemodynamic instability.',
      incorrect: {
        A: 'While pulmonary embolism can present with chest pain and dyspnea, it typically lacks the hemodynamic severity seen here.',
        B: 'Pericarditis usually presents with pleuritic chest pain that worsens with lying down.',
        C: 'Aortic dissection presents with severe tearing pain, often with neurological findings.',
        D: 'This is the correct answer.',
      },
    },
    difficulty: 0.65,
    ...overrides,
  });

  it('Valid question passes validation', () => {
    const question = createValidQuestion();
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('correctAnswer mismatch detected', () => {
    const question = createValidQuestion({
      correctAnswer: 'Non-existent option',
    });
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('correctAnswer'))).toBe(true);
  });

  it('Duplicate options detected (case-insensitive)', () => {
    const question = createValidQuestion({
      options: [
        'Myocardial infarction',
        'Pulmonary embolism',
        'myocardial infarction', // Duplicate with different case
        'Aortic dissection',
      ],
    });
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate options'))).toBe(true);
  });

  it('Short stem detected', () => {
    const question = createValidQuestion({
      question: 'Short question?',
    });
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('too short'))).toBe(true);
  });

  it('Difficulty out of range detected', () => {
    const question = createValidQuestion({
      difficulty: 1.5,
    });
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Difficulty'))).toBe(true);
  });

  it('Empty incorrect explanation detected', () => {
    const question = createValidQuestion({
      explanation: {
        rationale: 'Valid rationale',
        incorrect: {
          A: '',
          B: 'Valid explanation',
          C: 'Valid explanation',
          D: 'Valid explanation',
        },
      },
    });
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('explanation.incorrect.A'))).toBe(true);
  });

  it('Whitespace-only incorrect explanation detected', () => {
    const question = createValidQuestion({
      explanation: {
        rationale: 'Valid rationale',
        incorrect: {
          A: '   ',
          B: 'Valid explanation',
          C: 'Valid explanation',
          D: 'Valid explanation',
        },
      },
    });
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('explanation.incorrect.A'))).toBe(true);
  });

  it('Multiple errors caught simultaneously', () => {
    const question = createValidQuestion({
      question: 'Short',
      correctAnswer: 'Invalid',
      difficulty: 2.5,
      explanation: {
        rationale: 'Valid',
        incorrect: {
          A: '',
          B: '',
          C: 'Valid',
          D: 'Valid',
        },
      },
    });
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    expect(result.errors.some(e => e.includes('correctAnswer'))).toBe(true);
    expect(result.errors.some(e => e.includes('Difficulty'))).toBe(true);
  });

  it('Diagnosis leak in stem detected (pneumonia)', () => {
    const question = createValidQuestion({
      question: 'A 65-year-old with pneumonia presents with fever and cough. What is the underlying cause?',
    });
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('pneumonia'))).toBe(true);
  });

  it('Diagnosis leak in stem detected (afib)', () => {
    const question = createValidQuestion({
      question: 'A patient with afib presents with palpitations. What medication is most appropriate?',
    });
    const result = validateGeneratedQuestion(question);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('afib'))).toBe(true);
  });

  it('Common medical words do not trigger false diagnosis leak warnings', () => {
    const question = createValidQuestion({
      question: 'A 55-year-old patient presents with symptoms over the past week. History of blood pressure elevation. What is the diagnosis?',
    });
    const result = validateGeneratedQuestion(question);
    // Should pass because "patient", "history", "blood", "pressure" are stop words
    expect(result.valid).toBe(true);
  });
});
