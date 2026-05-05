import type { Question } from '@/types';

export type StudyModePreference = 'guided' | 'direct';
export type StudyGuidanceLevel = 'foundational' | 'developing' | 'confident';

export interface StudyHintSet {
  metacognitivePrompt: string;
  hints: string[];
}

export interface ScaffoldedExplanation {
  chunks: Array<{ title: string; body: string }>;
  knowledgeCheck: {
    prompt: string;
    reveal: string;
  };
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function buildStudyHintSet(
  question: Pick<Question, 'system' | 'topic' | 'condition' | 'options' | 'correctAnswerIndex'>,
  level: StudyGuidanceLevel
): StudyHintSet {
  const topic = question.condition || question.topic || question.system || 'this topic';
  const basePrompt =
    level === 'foundational'
      ? `Name the organ system and one clue you recognize about ${topic}.`
      : level === 'confident'
        ? `Commit to the key discriminator before you choose an option.`
        : `List your top two choices and the clue that separates them.`;

  return {
    metacognitivePrompt: basePrompt,
    hints: [
      `Start by identifying the task: diagnosis, diagnostic test, management, or mechanism.`,
      `Compare the two most plausible options. Ask what finding would make each one correct.`,
      `Anchor on ${topic}. The best choice should explain the key clue and rule out the closest distractor.`,
    ],
  };
}

export function buildScaffoldedExplanation(
  question: Pick<
    Question,
    | 'rationale'
    | 'condition'
    | 'topic'
    | 'system'
    | 'options'
    | 'correctAnswerIndex'
  >,
  selectedAnswerIndex: number
): ScaffoldedExplanation {
  const correctAnswer = question.options?.[question.correctAnswerIndex] || 'the correct answer';
  const selectedAnswer = question.options?.[selectedAnswerIndex] || 'your answer';
  const explanation = extractExplanationText(question.rationale);
  const sentences = splitSentences(explanation);
  const topic = question.condition || question.topic || question.system || 'this concept';
  const selectedLabel = LETTERS[selectedAnswerIndex] ?? '?';
  const correctLabel = LETTERS[question.correctAnswerIndex] ?? '?';

  return {
    chunks: [
      {
        title: 'Core idea',
        body: sentences[0] || `${correctAnswer} is the best answer for ${topic}.`,
      },
      {
        title: 'Clinical link',
        body:
          sentences.slice(1, 3).join(' ') ||
          `Tie the vignette clues back to ${topic} before comparing answer choices.`,
      },
      {
        title: selectedAnswerIndex === question.correctAnswerIndex ? 'Why it holds' : 'Repair the miss',
        body:
          selectedAnswerIndex === question.correctAnswerIndex
            ? `Your choice (${correctLabel}) matches the key reasoning path.`
            : `You chose ${selectedLabel}: ${selectedAnswer}. The target is ${correctLabel}: ${correctAnswer}. Re-check the clue that separates those two options.`,
      },
    ],
    knowledgeCheck: {
      prompt: `In one sentence, what clue would make ${correctAnswer} the best answer next time?`,
      reveal:
        sentences[sentences.length - 1] ||
        `Look for the discriminator that points to ${topic}, then map it to ${correctAnswer}.`,
    },
  };
}

function extractExplanationText(rationale: Question['rationale']): string {
  if (!rationale) return '';
  if (typeof rationale === 'string') {
    try {
      const parsed = JSON.parse(rationale) as unknown;
      return extractExplanationText(parsed as Question['rationale']);
    } catch {
      return rationale;
    }
  }

  if (typeof rationale === 'object') {
    const record = rationale as unknown as Record<string, unknown>;
    return [
      record.bottomLine,
      record.whyCorrect,
      record.clinicalPearl,
      record.rationale,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ');
  }

  return '';
}

function splitSentences(value: string): string[] {
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .slice(0, 5);
}
