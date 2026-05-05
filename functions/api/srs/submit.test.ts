import { describe, expect, it } from 'vitest';
import { synthesizeLegacySrsSelectedAnswer } from './submit';

describe('legacy SRS submit adapter', () => {
  const questionData = {
    options: ['Observe', 'Treat', 'Refer'],
    correctAnswer: 'B',
  };

  it('uses the real submitted answer when the legacy client supplies it', () => {
    expect(
      synthesizeLegacySrsSelectedAnswer(questionData, {
        isCorrect: true,
        userAnswer: 'Treat',
      })
    ).toBe('Treat');
  });

  it('synthesizes a correct selected answer for old clients without userAnswer', () => {
    expect(
      synthesizeLegacySrsSelectedAnswer(questionData, {
        isCorrect: true,
      })
    ).toBe('Treat');
  });

  it('synthesizes a non-correct selected answer for old incorrect submissions', () => {
    expect(
      synthesizeLegacySrsSelectedAnswer(questionData, {
        isCorrect: false,
      })
    ).toBe('Observe');
  });

  it('fails closed when neither userAnswer nor a correct answer can be resolved', () => {
    expect(
      synthesizeLegacySrsSelectedAnswer(
        { options: ['Observe', 'Treat'] },
        {
          isCorrect: true,
        }
      )
    ).toBeNull();
  });
});
