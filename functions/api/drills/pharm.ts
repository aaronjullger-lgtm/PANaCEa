// functions/api/drills/pharm.ts
// GET endpoint for pharmacology drill questions

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  authenticatedEndpoint,
  AuthenticatedContext,
  ValidatedContext,
} from '../_shared/middleware';
import { pharmDrillQuerySchema } from '../_shared/zodSchemas';
import { z } from 'zod';

type PharmDrillQuery = z.infer<typeof pharmDrillQuerySchema>;

export interface PharmQuestion {
  id: string;
  type: PharmQuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  drugName: string;
  drugClass: string | string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export type PharmQuestionType =
  | 'mechanism'
  | 'side_effect'
  | 'contraindication'
  | 'drug_class'
  | 'antidote'
  | 'interaction'
  | 'clinical_use';

interface Drug {
  id: string;
  genericName: string;
  brandName: string | null;
  drugClass: string[];
  mechanismOfAction: string | null;
  indications: string[];
  contraindications: string[];
  sideEffects: string[];
  interactions: string[];
  dosing: string | null;
  tags: string[];
  clinicalNotes: string | null;
  antidote: string | null;
  metabolism: string | null;
  elimination: string | null;
}

/**
 * GET /api/drills/pharm?count={count}&category={category}
 * Generates pharmacology drill questions from the Drug database
 *
 * Query params:
 * - count: Number of questions to generate (default: 10, max: 50)
 * - category: Question type filter (optional)
 */
export const onRequestGet = authenticatedEndpoint(
  pharmDrillQuerySchema,
  async (context: AuthenticatedContext & ValidatedContext<PharmDrillQuery>) => {
    const { count, category } = context.validated;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Fetch all drugs to build a good question pool
      const allDrugs: Drug[] = await prisma.drug.findMany({
        select: {
          id: true,
          genericName: true,
          brandName: true,
          drugClass: true,
          mechanismOfAction: true,
          indications: true,
          contraindications: true,
          sideEffects: true,
          interactions: true,
          dosing: true,
          tags: true,
          clinicalNotes: true,
          antidote: true,
          metabolism: true,
          elimination: true,
        },
      });

      if (allDrugs.length < 4) {
        return {
          status: 400,
          data: {
            error: 'Insufficient data',
            message: 'Not enough drugs in database to generate questions',
          },
        };
      }

      // Generate questions
      const questions: PharmQuestion[] = [];
      const usedDrugIds = new Set<string>();

      for (let i = 0; i < count; i++) {
        // Pick a random drug that hasn't been used yet
        const availableDrugs = allDrugs.filter((d) => !usedDrugIds.has(d.id));
        if (availableDrugs.length === 0) {
          usedDrugIds.clear(); // Reset if we run out
        }

        const drugPool = availableDrugs.length > 0 ? availableDrugs : allDrugs;
        const drug = drugPool[Math.floor(Math.random() * drugPool.length)];
        if (!drug) continue; // Safety check for empty pool
        usedDrugIds.add(drug.id);

        const questionType: PharmQuestionType = category ?? randomQuestionType();
        const question = generateQuestion(drug, allDrugs, questionType);

        if (question) {
          questions.push(question);
        }
      }

      return { data: questions };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * Select a random question type
 */
function randomQuestionType(): PharmQuestionType {
  const types: PharmQuestionType[] = [
    'mechanism',
    'side_effect',
    'contraindication',
    'drug_class',
    'clinical_use',
  ];
  const index = Math.floor(Math.random() * types.length);
  return types[index] ?? 'mechanism';
}

/**
 * Generate a question based on the drug and question type
 */
function generateQuestion(
  drug: Drug,
  allDrugs: Drug[],
  type: PharmQuestionType
): PharmQuestion | null {
  switch (type) {
    case 'mechanism':
      return generateMechanismQuestion(drug, allDrugs);
    case 'side_effect':
      return generateSideEffectQuestion(drug, allDrugs);
    case 'contraindication':
      return generateContraindicationQuestion(drug, allDrugs);
    case 'drug_class':
      return generateDrugClassQuestion(drug, allDrugs);
    case 'antidote':
      return generateAntidoteQuestion(drug, allDrugs);
    case 'clinical_use':
      return generateClinicalUseQuestion(drug, allDrugs);
    default:
      return generateMechanismQuestion(drug, allDrugs);
  }
}

/**
 * Get random drugs from the same class as distractors
 */
function getSimilarDrugs(drug: Drug, count: number, allDrugs: Drug[]): Drug[] {
  const sameClass = allDrugs.filter(
    (d) => d.id !== drug.id && d.drugClass.some((c) => drug.drugClass.includes(c))
  );

  if (sameClass.length >= count) {
    return sameClass.sort(() => Math.random() - 0.5).slice(0, count);
  }

  // Add random drugs if not enough similar ones
  const remaining = getRandomDrugs(
    count - sameClass.length,
    [drug.id, ...sameClass.map((d) => d.id)],
    allDrugs
  );
  return [...sameClass, ...remaining].slice(0, count);
}

/**
 * Get random drugs excluding specific ones
 */
function getRandomDrugs(count: number, excludeIds: string[], allDrugs: Drug[]): Drug[] {
  const pool = allDrugs.filter((d) => !excludeIds.includes(d.id));
  return pool.sort(() => Math.random() - 0.5).slice(0, count);
}

/**
 * Generate a mechanism of action question
 */
function generateMechanismQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  const distractors = getSimilarDrugs(drug, 3, allDrugs);
  const moa = drug.mechanismOfAction || 'Mechanism of action not specified';

  const options: string[] = [
    (moa.split('.')[0] ?? '') + '.',
    ...distractors.map(
      (d: Drug) => ((d.mechanismOfAction || 'Unknown mechanism').split('.')[0] ?? '') + '.'
    ),
  ];

  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf((moa.split('.')[0] ?? '') + '.');

  return {
    id: `pharm-moa-${drug.id}-${Date.now()}`,
    type: 'mechanism',
    question: `What is the primary mechanism of action of ${drug.genericName}${drug.brandName ? ` (${drug.brandName})` : ''}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} works by: ${moa}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'medium',
  };
}

/**
 * Generate a side effect question
 */
function generateSideEffectQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.sideEffects || drug.sideEffects.length === 0) {
    return generateMechanismQuestion(drug, allDrugs);
  }

  const correctADE =
    drug.sideEffects[Math.floor(Math.random() * drug.sideEffects.length)] ??
    'Unknown adverse effect';
  const distractors = getSimilarDrugs(drug, 3, allDrugs);

  const options: string[] = [
    correctADE,
    ...distractors.flatMap((d: Drug) => d.sideEffects || []).slice(0, 3),
  ].slice(0, 4);

  // Pad with generic options if needed
  while (options.length < 4) {
    options.push('No significant adverse effects');
  }

  const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = shuffledOptions.indexOf(correctADE);

  return {
    id: `pharm-ade-${drug.id}-${Date.now()}`,
    type: 'side_effect',
    question: `Which of the following is a known adverse effect of ${drug.genericName}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} can cause: ${drug.sideEffects.join(', ')}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'easy',
  };
}

/**
 * Generate a contraindication question
 */
function generateContraindicationQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.contraindications || drug.contraindications.length === 0) {
    return generateSideEffectQuestion(drug, allDrugs);
  }

  const correctContra =
    drug.contraindications[Math.floor(Math.random() * drug.contraindications.length)] ??
    'Unknown contraindication';
  const distractors = getRandomDrugs(3, [drug.id], allDrugs);

  const options: string[] = [
    correctContra,
    ...distractors.flatMap((d: Drug) => d.contraindications || []).slice(0, 3),
  ].slice(0, 4);

  while (options.length < 4) {
    options.push('No absolute contraindications');
  }

  const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = shuffledOptions.indexOf(correctContra);

  return {
    id: `pharm-contra-${drug.id}-${Date.now()}`,
    type: 'contraindication',
    question: `Which condition is a contraindication for ${drug.genericName}?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} is contraindicated in: ${drug.contraindications.join(', ')}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'medium',
  };
}

/**
 * Generate a drug class identification question
 */
function generateDrugClassQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.drugClass || drug.drugClass.length === 0) {
    return generateMechanismQuestion(drug, allDrugs);
  }

  const correctClass = drug.drugClass[0] ?? 'Unknown class'; // Use primary class
  const distractors = getRandomDrugs(3, [drug.id], allDrugs);

  const options: string[] = [
    correctClass,
    ...distractors.flatMap((d: Drug) => d.drugClass || []).slice(0, 3),
  ].slice(0, 4);

  const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = shuffledOptions.indexOf(correctClass);

  return {
    id: `pharm-class-${drug.id}-${Date.now()}`,
    type: 'drug_class',
    question: `${drug.genericName} belongs to which drug class?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} is classified as: ${drug.drugClass.join(', ')}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'easy',
  };
}

/**
 * Generate an antidote question
 */
function generateAntidoteQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.antidote) {
    return generateClinicalUseQuestion(drug, allDrugs);
  }

  const distractors = allDrugs
    .filter((d: Drug) => d.antidote && d.id !== drug.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const options: string[] = [
    drug.antidote,
    ...distractors.map((d: Drug) => d.antidote || 'Supportive care only'),
  ].slice(0, 4);

  while (options.length < 4) {
    options.push('No specific antidote');
  }

  const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = shuffledOptions.indexOf(drug.antidote);

  return {
    id: `pharm-antidote-${drug.id}-${Date.now()}`,
    type: 'antidote',
    question: `What is the antidote for ${drug.genericName} toxicity?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `The antidote for ${drug.genericName} is: ${drug.antidote}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'hard',
  };
}

/**
 * Generate a clinical use question
 */
function generateClinicalUseQuestion(drug: Drug, allDrugs: Drug[]): PharmQuestion {
  if (!drug.indications || drug.indications.length === 0) {
    return generateMechanismQuestion(drug, allDrugs);
  }

  const correctIndication =
    drug.indications[Math.floor(Math.random() * drug.indications.length)] ?? 'Unknown indication';
  const distractors = getRandomDrugs(3, [drug.id], allDrugs);

  const options: string[] = [
    correctIndication,
    ...distractors.flatMap((d: Drug) => d.indications || []).slice(0, 3),
  ].slice(0, 4);

  const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5).slice(0, 4);
  const correctIndex = shuffledOptions.indexOf(correctIndication);

  return {
    id: `pharm-indication-${drug.id}-${Date.now()}`,
    type: 'clinical_use',
    question: `${drug.genericName} is primarily indicated for which condition?`,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `${drug.genericName} is indicated for: ${drug.indications.join(', ')}`,
    drugName: drug.genericName,
    drugClass: drug.drugClass,
    difficulty: 'medium',
  };
}
