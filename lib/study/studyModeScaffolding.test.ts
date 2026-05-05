import { describe, expect, it } from 'vitest';
import {
  buildScaffoldedExplanation,
  buildStudyHintSet,
} from './studyModeScaffolding';

describe('studyModeScaffolding', () => {
  const question = {
    condition: 'Pulmonary embolism',
    topic: 'Pulmonary',
    system: 'PULM',
    options: ['Asthma exacerbation', 'CT pulmonary angiography', 'Chest radiograph', 'Oral amoxicillin'],
    correctAnswerIndex: 1,
    rationale: JSON.stringify({
      bottomLine: 'CT pulmonary angiography is the best diagnostic test for a stable patient with high suspicion for PE.',
      whyCorrect: 'The vignette points to PE because of pleuritic pain, tachycardia, and hypoxemia.',
      clinicalPearl: 'Use pretest probability to choose D-dimer versus imaging.',
    }),
  } as const;

  it('builds level-specific metacognitive prompts and escalating hints', () => {
    const foundational = buildStudyHintSet(question, 'foundational');
    const confident = buildStudyHintSet(question, 'confident');

    expect(foundational.metacognitivePrompt).toContain('organ system');
    expect(confident.metacognitivePrompt).toContain('key discriminator');
    expect(foundational.hints).toHaveLength(3);
    expect(foundational.hints[2]).toContain('key clue');
  });

  it('turns rationale into bite-sized explanation chunks and a knowledge check', () => {
    const scaffold = buildScaffoldedExplanation(question, 0);

    expect(scaffold.chunks).toHaveLength(3);
    expect(scaffold.chunks[0].body).toContain('CT pulmonary angiography');
    expect(scaffold.chunks[2].body).toContain('You chose A');
    expect(scaffold.knowledgeCheck.prompt).toContain('CT pulmonary angiography');
  });
});
