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

export interface StudyScaffoldContext {
  guidanceLevel?: StudyGuidanceLevel;
  learnerReflection?: string;
  hintsViewed?: number;
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
    'rationale' | 'condition' | 'topic' | 'system' | 'options' | 'correctAnswerIndex'
  >,
  selectedAnswerIndex: number,
  context: StudyScaffoldContext = {}
): ScaffoldedExplanation {
  const correctAnswer = question.options?.[question.correctAnswerIndex] || 'the correct answer';
  const selectedAnswer = question.options?.[selectedAnswerIndex] || 'your answer';
  const explanation = extractExplanationText(question.rationale);
  const sentences = splitSentences(explanation);
  const topic = question.condition || question.topic || question.system || 'this concept';
  const selectedLabel = LETTERS[selectedAnswerIndex] ?? '?';
  const correctLabel = LETTERS[question.correctAnswerIndex] ?? '?';
  const guidanceLevel = context.guidanceLevel ?? 'developing';
  const learnerReflection = context.learnerReflection?.trim() ?? '';
  const hintsViewed = Math.max(0, context.hintsViewed ?? 0);
  const reflectionAnchor = summarizeLearnerReflection(learnerReflection);

  return {
    chunks: [
      {
        title: guidanceLevel === 'foundational' ? 'Orient the problem' : 'Core idea',
        body: buildCoreIdeaBody(guidanceLevel, topic, correctAnswer, sentences[0]),
      },
      {
        title: 'Clinical link',
        body: buildClinicalLinkBody(guidanceLevel, topic, correctAnswer, sentences.slice(1, 3)),
      },
      {
        title:
          selectedAnswerIndex === question.correctAnswerIndex ? 'Why it holds' : 'Repair the miss',
        body: buildAnswerRepairBody({
          guidanceLevel,
          selectedAnswerIndex,
          correctAnswerIndex: question.correctAnswerIndex,
          selectedLabel,
          correctLabel,
          selectedAnswer,
          correctAnswer,
          topic,
        }),
      },
    ],
    knowledgeCheck: {
      prompt: buildKnowledgeCheckPrompt({
        guidanceLevel,
        correctAnswer,
        reflectionAnchor,
        hintsViewed,
      }),
      reveal: buildKnowledgeCheckReveal({
        guidanceLevel,
        topic,
        correctAnswer,
        fallback: sentences[sentences.length - 1],
        reflectionAnchor,
        hintsViewed,
      }),
    },
  };
}

function buildCoreIdeaBody(
  guidanceLevel: StudyGuidanceLevel,
  topic: string,
  correctAnswer: string,
  firstSentence?: string
): string {
  if (guidanceLevel === 'foundational') {
    return `Start by naming the task and system for ${topic}. ${firstSentence || `${correctAnswer} is the best answer for this question.`}`;
  }

  if (guidanceLevel === 'confident') {
    return `${firstSentence || `${correctAnswer} is the best answer for ${topic}.`} Defend it against the closest distractor instead of rereading passively.`;
  }

  return firstSentence || `${correctAnswer} is the best answer for ${topic}.`;
}

function buildClinicalLinkBody(
  guidanceLevel: StudyGuidanceLevel,
  topic: string,
  correctAnswer: string,
  sentences: string[]
): string {
  const evidence =
    sentences.join(' ') ||
    `Tie the vignette clues back to ${topic} before comparing answer choices.`;

  if (guidanceLevel === 'foundational') {
    return `${evidence} Then connect one clue directly to ${correctAnswer}.`;
  }

  if (guidanceLevel === 'confident') {
    return `${evidence} Name the single discriminator that would change your answer.`;
  }

  return evidence;
}

function buildAnswerRepairBody({
  guidanceLevel,
  selectedAnswerIndex,
  correctAnswerIndex,
  selectedLabel,
  correctLabel,
  selectedAnswer,
  correctAnswer,
  topic,
}: {
  guidanceLevel: StudyGuidanceLevel;
  selectedAnswerIndex: number;
  correctAnswerIndex: number;
  selectedLabel: string;
  correctLabel: string;
  selectedAnswer: string;
  correctAnswer: string;
  topic: string;
}): string {
  if (selectedAnswerIndex === correctAnswerIndex) {
    if (guidanceLevel === 'confident') {
      return `Your choice (${correctLabel}) matches the key reasoning path. Now explain why a tempting distractor is less complete.`;
    }

    return `Your choice (${correctLabel}) matches the key reasoning path.`;
  }

  const base = `You chose ${selectedLabel}: ${selectedAnswer}. The target is ${correctLabel}: ${correctAnswer}.`;

  if (guidanceLevel === 'foundational') {
    return `${base} First identify what ${selectedAnswer} explains, then what it fails to explain about ${topic}.`;
  }

  if (guidanceLevel === 'confident') {
    return `${base} Force a one-clue contrast: what finding rules in ${correctAnswer} over ${selectedAnswer}?`;
  }

  return `${base} Re-check the clue that separates those two options.`;
}

function buildKnowledgeCheckPrompt({
  guidanceLevel,
  correctAnswer,
  reflectionAnchor,
  hintsViewed,
}: {
  guidanceLevel: StudyGuidanceLevel;
  correctAnswer: string;
  reflectionAnchor: string | null;
  hintsViewed: number;
}): string {
  const prompt =
    guidanceLevel === 'foundational'
      ? `What is the task, and what one clue points to ${correctAnswer}?`
      : guidanceLevel === 'confident'
        ? `What clue would make the closest distractor tempting, and what clue still favors ${correctAnswer}?`
        : `In one sentence, what clue would make ${correctAnswer} the best answer next time?`;

  const reflectionPrompt = reflectionAnchor
    ? ` Reconcile that with your first clue: "${reflectionAnchor}".`
    : '';
  const hintPrompt = hintsViewed > 0 ? ' Name it without rereading the hint.' : '';

  return `${prompt}${reflectionPrompt}${hintPrompt}`;
}

function buildKnowledgeCheckReveal({
  guidanceLevel,
  topic,
  correctAnswer,
  fallback,
  reflectionAnchor,
  hintsViewed,
}: {
  guidanceLevel: StudyGuidanceLevel;
  topic: string;
  correctAnswer: string;
  fallback?: string;
  reflectionAnchor: string | null;
  hintsViewed: number;
}): string {
  const base =
    fallback ||
    `Look for the discriminator that points to ${topic}, then map it to ${correctAnswer}.`;

  const levelCue =
    guidanceLevel === 'foundational'
      ? `Start broad, then attach the clue to ${correctAnswer}.`
      : guidanceLevel === 'confident'
        ? `Use the distractor contrast to stress-test ${correctAnswer}.`
        : `Keep the clue-to-answer link explicit.`;

  const reflectionCue = reflectionAnchor
    ? ` Compare this against your first clue: "${reflectionAnchor}".`
    : '';
  const hintCue = hintsViewed > 0 ? ' The hint path should become a recall cue, not a crutch.' : '';

  return `${base} ${levelCue}${reflectionCue}${hintCue}`.trim();
}

function summarizeLearnerReflection(value: string): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 90) return normalized;
  return `${normalized.slice(0, 87).trim()}...`;
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
    return [record.bottomLine, record.whyCorrect, record.clinicalPearl, record.rationale]
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
