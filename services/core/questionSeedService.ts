/**
 * Question Seed Service
 *
 * Task 111: "Vignette Permutation" Storage
 * - Store question seeds with variables for permutation
 * - Generate unique questions at runtime by picking random variables
 * - Ensure users never see the exact same text twice
 */

import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

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
export async function createQuestionSeed(seedData: QuestionSeedData) {
  const seed = await prisma.questionSeed.create({
    data: {
      id: uuidv4(),
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
      updatedAt: new Date(),
    },
  });

  return seed;
}

/**
 * Assemble a unique question from a seed by picking random variables
 */
export async function assembleQuestionFromSeed(seedId: string) {
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

  // Return assembled question
  // const questionData = seed.questionData || {};
  const assembledQuestion = {
    id: uuidv4(), // Each assembled question gets a unique ID
    seedId: seed.id,
    conditionId: seed.conditionId,
    type: seed.questionType,
    question: questionText,
    correctAnswer: seed.correctAnswer,
    options: shuffleArray([seed.correctAnswer, ...(seed.distractors as any)]),
    explanation: {
      rationale: seed.explanation,
    },
    difficulty: seed.difficulty,
    variables: selectedVariables, // Track which variables were used
    corePathology: seed.corePathology,
  };

  return assembledQuestion;
}

/**
 * Assemble multiple unique questions from available seeds matching a filter
 */
export async function assembleQuestionsFromSeeds(
  filter: {
    conditionId?: string;
    system?: string;
    difficulty?: string;
    questionType?: string;
  },
  count: number = 10
) {
  // Find matching seeds
  const where: any = {};
  if (filter.conditionId) where.conditionId = filter.conditionId;
  if (filter.system) where.system = filter.system;
  if (filter.difficulty) where.difficulty = filter.difficulty;
  if (filter.questionType) where.questionType = filter.questionType;

  const seeds = await prisma.questionSeed.findMany({
    where,
    orderBy: { usageCount: 'asc' }, // Prefer less-used seeds
  });

  if (seeds.length === 0) {
    return [];
  }

  const assembledQuestions = [];

  for (let i = 0; i < count; i++) {
    // Pick a seed (cycle through them if we need more questions than seeds)
    const seed = seeds[i % seeds.length];
    const question = await assembleQuestionFromSeed(seed.id);
    assembledQuestions.push(question);
  }

  return assembledQuestions;
}

/**
 * Create example seed for appendicitis (from problem statement)
 */
export async function createAppendicitisSeed() {
  const seed = await createQuestionSeed({
    conditionId: 'appendicitis',
    questionType: 'vignette',
    system: 'GI',
    corePathology: 'Appendicitis',
    variables: {
      Age: [10, 25, 60],
      Sex: ['Male', 'Female'],
      Presentation: ['Classic', 'Retrocecal'],
      Vitals: ['Stable', 'Septic'],
    },
    template: `A {{Age}}-year-old {{Sex}} presents to the emergency department with right lower quadrant pain. The presentation is {{Presentation}}. Vital signs show {{Vitals}} hemodynamics. What is the most likely diagnosis?`,
    correctAnswer: 'Acute appendicitis',
    explanation:
      'Appendicitis typically presents with periumbilical pain that migrates to the right lower quadrant. Retrocecal appendicitis may have atypical presentations. Early recognition and surgical intervention are key to preventing perforation and sepsis.',
    distractors: ['Cholecystitis', 'Diverticulitis', 'Mesenteric ischemia'],
    difficulty: 'medium',
  });

  return seed;
}

/**
 * Get seed statistics
 */
export async function getSeedStats() {
  const [totalSeeds, byCondition, bySystem, mostUsed, leastUsed] = await Promise.all([
    prisma.questionSeed.count(),
    prisma.questionSeed.groupBy({
      by: ['conditionId'],
      _count: true,
    }),
    prisma.questionSeed.groupBy({
      by: ['system'],
      _count: true,
    }),
    prisma.questionSeed.findMany({
      orderBy: { usageCount: 'desc' },
      take: 5,
      select: { id: true, corePathology: true, usageCount: true },
    }),
    prisma.questionSeed.findMany({
      orderBy: { usageCount: 'asc' },
      take: 5,
      select: { id: true, corePathology: true, usageCount: true },
    }),
  ]);

  return {
    totalSeeds,
    byCondition,
    bySystem,
    mostUsed,
    leastUsed,
  };
}

/**
 * Update seed variables (for maintenance/improvement)
 */
export async function updateSeedVariables(seedId: string, newVariables: Record<string, any[]>) {
  const seed = await prisma.questionSeed.update({
    where: { id: seedId },
    data: {
      variables: newVariables,
      updatedAt: new Date(),
    },
  });

  return seed;
}

/**
 * Preview all possible permutations of a seed (for testing)
 */
export async function previewSeedPermutations(seedId: string, limit: number = 10) {
  const seed = await prisma.questionSeed.findUnique({
    where: { id: seedId },
  });

  if (!seed) {
    throw new Error('Question seed not found');
  }

  const variables = seed.variables as Record<string, any[]>;
  const variableKeys = Object.keys(variables);

  // Calculate total possible permutations
  let totalPermutations = 1;
  for (const key of variableKeys) {
    const values = variables[key];
    if (Array.isArray(values)) {
      totalPermutations *= values.length;
    }
  }

  // Generate sample permutations with balanced distribution
  const samples = [];
  for (let i = 0; i < Math.min(limit, totalPermutations); i++) {
    const selectedVariables: Record<string, any> = {};

    // Use a more balanced distribution algorithm
    // Calculate the index for each variable independently
    let tempIndex = i;
    for (const key of variableKeys) {
      const values = variables[key];
      if (Array.isArray(values) && values.length > 0) {
        const index = tempIndex % values.length;
        selectedVariables[key] = values[index];
        tempIndex = Math.floor(tempIndex / values.length);
      }
    }

    let questionText = seed.template;
    for (const [key, value] of Object.entries(selectedVariables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      questionText = questionText.replace(placeholder, String(value));
    }

    samples.push({
      permutationNumber: i + 1,
      variables: selectedVariables,
      questionText,
    });
  }

  return {
    seedId: seed.id,
    corePathology: seed.corePathology,
    totalPermutations,
    samplesShown: samples.length,
    samples,
  };
}

/**
 * Delete old or unused seeds (cleanup)
 */
export async function cleanupUnusedSeeds(minUsageCount: number = 0, daysOld: number = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deleted = await prisma.questionSeed.deleteMany({
    where: {
      usageCount: { lte: minUsageCount },
      createdAt: { lt: cutoffDate },
    },
  });

  return { deletedCount: deleted.count };
}
