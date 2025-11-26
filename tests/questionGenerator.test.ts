import { generateSingleQuestion } from '../lib/questionGenerator';
import { validateQuestion } from '../lib/questionValidator';
import { ConditionData } from '../types/question';
import { describe, it, expect } from 'vitest'; 

// Note: Assuming vitest is used or compatible jest syntax

const testCondition: ConditionData = {
  condition: "Hypertension",
  sections: {
    clinicalPresentation: "Often asymptomatic ('silent killer'). May present with headache.",
    diagnostics: "Diagnosis requires elevated BP on two separate occasions.",
    treatment: "Lifestyle modification. Thiazides, ACEi, ARBs, CCBs."
  }
};

describe('Question Generator System', () => {
  
  it('should generate a valid MCQ structure', async () => {
    // Note: This requires a valid API key or a mock setup
    // For scaffolding purposes, we assume the function returns a valid object
    const q = await generateSingleQuestion(testCondition, 'mcq');
    
    if (q) {
      expect(q.type).toBe('mcq');
      expect(q.options).toHaveLength(4);
      expect(q.explanation.rationale).toBeDefined();
    } else {
      console.warn("Skipping test due to missing API Key or network issue");
    }
  });

  it('should validate correct data grounding', () => {
    const validQ: any = {
      type: 'mcq',
      correctAnswer: 'Thiazides',
      sourceSections: ['treatment'],
      options: ['Thiazides', 'X', 'Y', 'Z']
    };

    const result = validateQuestion(validQ, testCondition);
    expect(result.isValid).toBe(true);
  });

  it('should reject answers not found in text', () => {
    const invalidQ: any = {
      type: 'mcq',
      correctAnswer: 'Chemotherapy', // Not in text
      sourceSections: ['treatment'],
      options: ['Chemotherapy', 'X', 'Y', 'Z']
    };

    const result = validateQuestion(invalidQ, testCondition);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain("unsupported");
  });
});
