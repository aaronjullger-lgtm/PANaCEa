import { describe, expect, it } from 'vitest';
import { buildScaffoldedExplanation, buildStudyHintSet } from './studyModeScaffolding';

describe('studyModeScaffolding', () => {
  const question = {
    condition: 'Pulmonary embolism',
    topic: 'Pulmonary',
    system: 'PULM',
    options: [
      'Asthma exacerbation',
      'CT pulmonary angiography',
      'Chest radiograph',
      'Oral amoxicillin',
    ],
    correctAnswerIndex: 1,
    rationale: JSON.stringify({
      bottomLine:
        'CT pulmonary angiography is the best diagnostic test for a stable patient with high suspicion for PE.',
      whyCorrect:
        'The vignette points to PE because of pleuritic pain, tachycardia, and hypoxemia.',
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

  it('adapts explanation scaffolding to foundational learners', () => {
    const scaffold = buildScaffoldedExplanation(question, 0, {
      guidanceLevel: 'foundational',
    });

    expect(scaffold.chunks[0]).toEqual(
      expect.objectContaining({
        title: 'Orient the problem',
      })
    );
    expect(scaffold.chunks[0].body).toContain('Start by naming the task and system');
    expect(scaffold.chunks[1].body).toContain('Then connect one clue directly');
    expect(scaffold.knowledgeCheck.prompt).toContain('What is the task');
  });

  it('uses learner reflection and hint history in the knowledge check', () => {
    const scaffold = buildScaffoldedExplanation(question, 1, {
      guidanceLevel: 'confident',
      learnerReflection: 'Pleuritic chest pain plus hypoxemia after surgery',
      hintsViewed: 2,
    });

    expect(scaffold.chunks[2].body).toContain('tempting distractor');
    expect(scaffold.knowledgeCheck.prompt).toContain('Pleuritic chest pain');
    expect(scaffold.knowledgeCheck.prompt).toContain('without rereading the hint');
    expect(scaffold.knowledgeCheck.reveal).toContain('hint path should become a recall cue');
  });
});
