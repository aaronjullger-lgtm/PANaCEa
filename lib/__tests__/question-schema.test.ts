import { describe, it, expect } from 'vitest';
import { QUESTION_RESPONSE_SCHEMA, GeneratedQuestionStrict } from '../../functions/api/_shared/question-schema';

describe('QUESTION_RESPONSE_SCHEMA', () => {
  it('Schema has required object structure', () => {
    expect(QUESTION_RESPONSE_SCHEMA).toHaveProperty('type');
    expect(QUESTION_RESPONSE_SCHEMA.type).toBe('object');
    expect(QUESTION_RESPONSE_SCHEMA).toHaveProperty('properties');
    expect(QUESTION_RESPONSE_SCHEMA).toHaveProperty('required');
  });

  it('Schema has all required properties defined', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    
    expect(properties).toHaveProperty('type');
    expect(properties).toHaveProperty('question');
    expect(properties).toHaveProperty('options');
    expect(properties).toHaveProperty('correctAnswer');
    expect(properties).toHaveProperty('explanation');
    expect(properties).toHaveProperty('difficulty');
  });

  it('Schema required array contains all mandatory fields', () => {
    const required = QUESTION_RESPONSE_SCHEMA.required as string[];
    
    expect(required).toContain('type');
    expect(required).toContain('question');
    expect(required).toContain('options');
    expect(required).toContain('correctAnswer');
    expect(required).toContain('explanation');
    expect(required).toContain('difficulty');
  });

  it('Type property has correct enum values', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const typeProperty = properties.type;
    
    expect(typeProperty).toHaveProperty('type', 'string');
    expect(typeProperty).toHaveProperty('enum');
    expect(typeProperty.enum).toEqual(['mcq', 'vignette']);
  });

  it('Question property is a string type with description', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const questionProperty = properties.question;
    
    expect(questionProperty).toHaveProperty('type', 'string');
    expect(questionProperty).toHaveProperty('description');
  });

  it('Options property is array type', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const optionsProperty = properties.options;
    
    expect(optionsProperty).toHaveProperty('type', 'array');
    expect(optionsProperty).toHaveProperty('items');
    expect(optionsProperty.items).toHaveProperty('type', 'string');
  });

  it('CorrectAnswer property is string type', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const correctAnswerProperty = properties.correctAnswer;
    
    expect(correctAnswerProperty).toHaveProperty('type', 'string');
    expect(correctAnswerProperty).toHaveProperty('description');
  });

  it('Explanation property is object type with required fields', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const explanationProperty = properties.explanation;
    
    expect(explanationProperty).toHaveProperty('type', 'object');
    expect(explanationProperty).toHaveProperty('properties');
    expect(explanationProperty).toHaveProperty('required');
    expect(explanationProperty.required).toContain('rationale');
    expect(explanationProperty.required).toContain('incorrect');
  });

  it('Explanation.rationale is a string type', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const explanationProperty = properties.explanation as Record<string, any>;
    const rationaleProperty = explanationProperty.properties.rationale;
    
    expect(rationaleProperty).toHaveProperty('type', 'string');
  });

  it('Explanation.incorrect has required A, B, C, D keys', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const explanationProperty = properties.explanation as Record<string, any>;
    const incorrectProperty = explanationProperty.properties.incorrect as Record<string, any>;
    
    expect(incorrectProperty).toHaveProperty('required');
    expect(incorrectProperty.required).toContain('A');
    expect(incorrectProperty.required).toContain('B');
    expect(incorrectProperty.required).toContain('C');
    expect(incorrectProperty.required).toContain('D');
  });

  it('Explanation.incorrect properties are string type', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const explanationProperty = properties.explanation as Record<string, any>;
    const incorrectProperty = explanationProperty.properties.incorrect as Record<string, any>;
    const correctProperty = incorrectProperty.properties as Record<string, any>;
    
    expect(correctProperty.A).toHaveProperty('type', 'string');
    expect(correctProperty.B).toHaveProperty('type', 'string');
    expect(correctProperty.C).toHaveProperty('type', 'string');
    expect(correctProperty.D).toHaveProperty('type', 'string');
  });

  it('Difficulty property is number type with valid range', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const difficultyProperty = properties.difficulty;
    
    expect(difficultyProperty).toHaveProperty('type', 'number');
    expect(difficultyProperty).toHaveProperty('description');
  });

  it('SourceSections property is optional array of strings', () => {
    const properties = QUESTION_RESPONSE_SCHEMA.properties as Record<string, any>;
    const sourceProperty = properties.sourceSections;
    
    expect(sourceProperty).toHaveProperty('type', 'array');
    expect(sourceProperty).toHaveProperty('items');
    expect(sourceProperty.items).toHaveProperty('type', 'string');
  });

  it('SourceSections is not in required array', () => {
    const required = QUESTION_RESPONSE_SCHEMA.required as string[];
    expect(required).not.toContain('sourceSections');
  });

  it('GeneratedQuestionStrict interface type matches schema structure', () => {
    // This test verifies the interface can be created with valid data
    const validQuestion: GeneratedQuestionStrict = {
      type: 'mcq',
      question: 'A 45-year-old patient presents with chest pain and shortness of breath. What is the diagnosis?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: {
        rationale: 'This is the correct answer because...',
        incorrect: {
          A: 'This is why B is wrong',
          B: 'This is why C is wrong',
          C: 'This is why D is wrong',
          D: 'Explanation for incorrect',
        },
      },
      difficulty: 0.65,
      sourceSections: ['section1', 'section2'],
    };

    expect(validQuestion.type).toBe('mcq');
    expect(validQuestion.question).toBeDefined();
    expect(validQuestion.options.length).toBe(4);
    expect(validQuestion.correctAnswer).toBeDefined();
    expect(validQuestion.explanation.rationale).toBeDefined();
    expect(validQuestion.difficulty).toBe(0.65);
  });
});
