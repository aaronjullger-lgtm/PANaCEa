interface QuestionSeedData {
  conditionId: string;
  questionType: string;
  system?: string;
  corePathology: string;
  variables: Record<string, any[]>;
  template: string;
  correctAnswer: string;
  explanation: string;
  distractors: string[];
  difficulty: string;
}

/**
 * Create a new question seed
 */
export async function createQuestionSeed(prisma: any, seedData: QuestionSeedData) {
  const seed = await prisma.questionSeed.create({
    data: {
      conditionId: seedData.conditionId,
      questionType: seedData.questionType,
      system: seedData.system,
      corePathology: seedData.corePathology,
      variables: seedData.variables,
      template: seedData.template,
      correctAnswer: seedData.correctAnswer,
      explanation: seedData.explanation,
      distractors: seedData.distractors,
      difficulty: seedData.difficulty,
    },
  });

  return seed;
}

/**
 * Assemble a unique question from a seed by picking random variables
 */
export async function assembleQuestionFromSeed(prisma: any, seedId: string) {
  const seed = await prisma.questionSeed.findUnique({
    where: { id: seedId },
  });

  if (!seed) {
    throw new Error('Question seed not found');
  }

  // Parse variables
  const variables = seed.variables as Record<string, any[]>;
  const selectedVariables: Record<string, any> = {};

  // Pick random value for each variable
  for (const [key, values] of Object.entries(variables)) {
    if (Array.isArray(values) && values.length > 0) {
      const randomIndex = Math.floor(Math.random() * values.length);
      selectedVariables[key] = values[randomIndex];
    }
  }

  // Replace placeholders in template
  let questionText = seed.template;
  for (const [key, value] of Object.entries(selectedVariables)) {
    // Replace all occurrences of {{variableName}} with the selected value
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    questionText = questionText.replace(placeholder, String(value));
  }

  // Update usage stats
  await prisma.questionSeed.update({
    where: { id: seedId },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  // Shuffle options using Fisher-Yates algorithm for unbiased randomization
  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const options = shuffleArray([seed.correctAnswer, ...seed.distractors]);

  return {
    id: seed.id,
    question: questionText,
    options,
    correctAnswer: seed.correctAnswer,
    explanation: seed.explanation,
    system: seed.system,
    difficulty: seed.difficulty,
    type: seed.questionType,
    variables: selectedVariables,
  };
}

/**
 * Assemble multiple questions from seeds matching filter
 */
export async function assembleQuestionsFromSeeds(prisma: any, filter: any, count: number = 10) {
  const where: any = {};
  if (filter.system) where.system = filter.system;
  if (filter.difficulty) where.difficulty = filter.difficulty;
  if (filter.conditionId) where.conditionId = filter.conditionId;

  const seeds = await prisma.questionSeed.findMany({
    where,
    take: count * 2, // Fetch more to randomize
  });

  // Shuffle seeds
  const shuffledSeeds = seeds.sort(() => 0.5 - Math.random()).slice(0, count);

  const questions = [];
  for (const seed of shuffledSeeds) {
    const question = await assembleQuestionFromSeed(prisma, seed.id);
    questions.push(question);
  }

  return questions;
}

/**
 * Get seed statistics
 */
export async function getSeedStats(prisma: any) {
  const total = await prisma.questionSeed.count();
  const bySystem = await prisma.questionSeed.groupBy({
    by: ['system'],
    _count: { id: true },
  });

  return {
    total,
    bySystem: bySystem.reduce((acc: any, curr: any) => {
      acc[curr.system || 'unknown'] = curr._count.id;
      return acc;
    }, {}),
  };
}
