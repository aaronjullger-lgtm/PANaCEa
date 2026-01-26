/**
 * POST /api/questions/generate-enhanced
 * Generate high-quality PANCE questions using rich database context.
 * Uses Gemini API with condition data, linked entities, and PANCE task focus.
 *
 * PHASE 4: NEURO-SYMBOLIC INTEGRITY - Milestone 1
 * Now includes Chain of Verification (CoVe) to prevent AI hallucinations.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Question, SystemCode } from '../../../types';
import {
  quickVerify,
  runCoVePipeline,
  type VerificationContext,
  type CoVeResult,
} from '../../../lib/cove-verification';

// ============================================================================
// HELPER: Parse condition context string into structured verification data
// ============================================================================

interface ParsedConditionContent {
  overview?: string;
  pathophysiology?: string;
  symptoms?: string[];
  signs?: string[];
  diagnostics?: string[];
  treatment?: string[];
  differentialDiagnosis?: string[];
  complications?: string[];
  riskFactors?: string[];
  buzzwords?: string[];
  clinicalPearls?: string[];
}

/**
 * Parse the condition context string (from database) into structured data
 * for CoVe verification. Handles various formats from MedicalContent.content JSONB.
 */
function parseConditionContext(contextString: string): ParsedConditionContent {
  const result: ParsedConditionContent = {};

  // Try to extract sections using common headers
  const sectionPatterns: Record<keyof ParsedConditionContent, RegExp> = {
    overview: /(?:overview|definition|description):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    pathophysiology: /(?:pathophysiology|mechanism|etiology):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    symptoms: /(?:symptoms|presentation|clinical features):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    signs: /(?:signs|physical exam|examination):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    diagnostics: /(?:diagnostics?|diagnosis|workup|labs?|imaging):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    treatment: /(?:treatment|management|therapy):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    differentialDiagnosis:
      /(?:differential|ddx|differential diagnosis):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    complications: /(?:complications?|sequelae):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    riskFactors: /(?:risk factors?|predisposing|causes):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    buzzwords: /(?:buzzwords?|key terms?|high[- ]yield):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
    clinicalPearls: /(?:pearls?|tips?|remember):\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,
  };

  // Extract each section
  for (const [key, pattern] of Object.entries(sectionPatterns)) {
    const match = contextString.match(pattern);
    if (match && match[1]) {
      const content = match[1].trim();
      // For array fields, split by common delimiters
      if (
        [
          'symptoms',
          'signs',
          'diagnostics',
          'treatment',
          'differentialDiagnosis',
          'complications',
          'riskFactors',
          'buzzwords',
          'clinicalPearls',
        ].includes(key)
      ) {
        // Split by newlines, bullets, semicolons, or numbered lists
        const items = content
          .split(/\n|[•-]\s*|;\s*|\d+\.\s*/)
          .map((s) => s.trim())
          .filter((s) => s.length > 2);
        if (items.length > 0) {
          (result as Record<string, string[]>)[key] = items;
        }
      } else {
        (result as Record<string, string>)[key] = content;
      }
    }
  }

  // If no structured content found, use the whole string as overview
  if (Object.keys(result).length === 0 && contextString.trim()) {
    result.overview = contextString.trim().slice(0, 2000); // Limit size
  }

  return result;
}

// ============================================================================
// SCHEMA & CONSTANTS
// ============================================================================

const GenerationRequestSchema = z.object({
  body: z.object({
    context: z.string().min(1),
    conditionId: z.string().min(1),
    conditionName: z.string().min(1),
    system: z.string().min(1),
    task: z.string().min(1),
    difficulty: z.enum(['easier', 'same', 'harder']),
  }),
});

const TASK_INSTRUCTIONS: Record<string, string> = {
  'Formulating Diagnosis': `Create a question that tests the ability to formulate a diagnosis. The question should present a clinical vignette and ask "What is the most likely diagnosis?" or similar. Focus on pattern recognition from history, physical exam, and key findings.`,

  'History Taking/PE': `Create a question that tests knowledge of history taking or physical examination. Ask about expected findings on physical exam, or which history questions would be most helpful. Examples: "Which physical exam finding would you expect?" or "Which history finding is most consistent with this diagnosis?"`,

  'Using Diagnostic Studies': `Create a question that tests the appropriate use of diagnostic studies. Ask about the best initial test, most appropriate diagnostic study, or interpretation of lab/imaging results. Focus on test selection and result interpretation.`,

  'Clinical Intervention': `Create a question that tests clinical intervention skills. Ask about immediate management, procedural interventions, or clinical decision-making. Examples: "What is the most appropriate next step in management?" or "Which intervention should be performed first?"`,

  'Pharmaceutical Therapeutics': `Create a question that tests pharmaceutical knowledge. Ask about first-line medications, drug mechanisms, contraindications, or adverse effects. Focus on treatment selection and medication management.`,

  'Health Maintenance': `Create a question about preventive medicine, screening recommendations, or health maintenance. Ask about appropriate screening intervals, vaccination schedules, or lifestyle modifications for prevention.`,

  'Applying Science Concepts': `Create a question that tests understanding of underlying pathophysiology, anatomy, or basic science. Ask about the mechanism of disease, anatomical considerations, or scientific basis for clinical findings.`,
};

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  easier: `Generate an EASIER question suitable for building foundational knowledge:
- Use classic textbook presentation
- Clear, unambiguous clinical findings
- Straightforward question stem
- One obviously correct answer
- Common conditions only`,

  same: `Generate a PANCE-LEVEL question matching real exam difficulty:
- Realistic clinical vignette with relevant details
- May include subtle findings or red herrings
- Plausible distractors that test understanding
- Second-order thinking required (diagnosis → management)
- Mix of common and moderately uncommon presentations`,

  harder: `Generate a HARDER question above typical PANCE difficulty:
- Complex patient with comorbidities
- Atypical presentations or "zebra" conditions
- Multi-step reasoning required
- May test mechanism of action or pathophysiology
- Requires integration of multiple concepts`,
};

// Maximum retry attempts for CoVe verification failures
const MAX_COVE_RETRIES = 3;

// Whether to use full CoVe pipeline or quick verify (configurable via env)
const USE_FULL_COVE = true;

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GenerationRequestSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/generate-enhanced');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const {
      context: conditionContext,
      conditionId,
      conditionName,
      system,
      task,
      difficulty,
    } = validated.body;

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    // Create Gemini API wrapper for CoVe verification calls
    const geminiApiCall = async (prompt: string): Promise<string> => {
      const result = await model.generateContent(prompt);
      return result.response.text();
    };

    // Parse condition context for verification
    const verificationContext: VerificationContext = {
      conditionName,
      system: system as SystemCode,
      databaseContent: parseConditionContext(conditionContext),
    };

    // Build the generation prompt
    const taskInstruction = TASK_INSTRUCTIONS[task] || TASK_INSTRUCTIONS['Formulating Diagnosis'];
    const difficultyInstruction =
      DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS['same'];

    // Build base generation prompt
    const buildGenerationPrompt = (previousIssues?: string[]) => {
      let issueWarning = '';
      if (previousIssues && previousIssues.length > 0) {
        issueWarning = `\n## IMPORTANT: Previous Generation Issues (MUST FIX)
The previous attempt had these verification failures:
${previousIssues.map((issue) => `- ${issue}`).join('\n')}

Please regenerate with extra attention to medical accuracy.\n`;
      }

      return `You are a PANCE exam question writer creating a high-quality multiple-choice question.

## Condition Information
${conditionContext}
${issueWarning}
## Question Requirements
${taskInstruction}

${difficultyInstruction}

## Output Format
Generate a JSON object with this exact structure (no markdown, no backticks):
{
  "vignette": "A clinical scenario with patient demographics, chief complaint, relevant history, and findings. 2-4 sentences.",
  "question": "A single clear question stem asking what was specified in the task focus.",
  "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"],
  "correctAnswerIndex": 0,
  "rationale": {
    "whyCorrect": "1-2 sentences explaining why the correct answer is definitively correct. Bold **key terms**.",
    "whyIncorrectA": "If A is wrong: 1 sentence why this is incorrect for this case.",
    "whyIncorrectB": "If B is wrong: 1 sentence why this is incorrect for this case.",
    "whyIncorrectC": "If C is wrong: 1 sentence why this is incorrect for this case.",
    "whyIncorrectD": "If D is wrong: 1 sentence why this is incorrect for this case.",
    "clinicalPearl": "One high-yield clinical pearl or key takeaway for this topic."
  },
  "pearls": ["Pearl 1 about this condition", "Pearl 2 - high-yield fact", "Pearl 3 - clinical tip"]
}

CRITICAL RULES:
1. The vignette MUST be a realistic clinical scenario with age, gender, and relevant details
2. All 4 options must be plausible for this clinical picture
3. The correct answer must be definitively correct based on the provided context
4. Distractors should represent common misconceptions or related conditions
5. The rationale MUST be a structured object with separate whyCorrect, whyIncorrectA/B/C/D fields (skip the one that is correct), and clinicalPearl
6. Include 2-3 high-yield clinical pearls in the pearls array
7. Do NOT include any markdown formatting or code blocks
8. Return ONLY the JSON object`;
    };

    // ========================================================================
    // GENERATION + VERIFICATION LOOP (CoVe Pipeline)
    // ========================================================================
    let questionData;
    let verificationResult: CoVeResult | null = null;
    let quickVerifyResult: {
      passed: boolean;
      confidence: number;
      criticalIssues: string[];
    } | null = null;
    let attempt = 0;
    let previousIssues: string[] = [];

    while (attempt < MAX_COVE_RETRIES) {
      attempt++;
      logger.info(`[CoVe] Generation attempt ${attempt}/${MAX_COVE_RETRIES}`, {
        userId: auth.userId,
        conditionId,
        previousIssuesCount: previousIssues.length,
      });

      // Generate question with optional issue warnings
      const prompt = buildGenerationPrompt(previousIssues.length > 0 ? previousIssues : undefined);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse JSON response
      try {
        const cleanedResponse = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        questionData = JSON.parse(cleanedResponse);
      } catch (parseError) {
        logger.warn(`[CoVe] Attempt ${attempt}: Failed to parse JSON`, {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          userId: auth.userId,
        });
        previousIssues = [
          'Generated response was not valid JSON. Please return ONLY a valid JSON object.',
        ];
        continue; // Retry
      }

      // Validate required fields
      if (
        !questionData.vignette ||
        !questionData.question ||
        !questionData.options ||
        questionData.correctAnswerIndex === undefined ||
        !questionData.rationale
      ) {
        logger.warn(`[CoVe] Attempt ${attempt}: Missing required fields`, {
          fields: Object.keys(questionData),
          userId: auth.userId,
        });
        previousIssues = [
          'Generated question was missing required fields. Include all fields: vignette, question, options, correctAnswerIndex, rationale.',
        ];
        continue; // Retry
      }

      // Build Question object for verification
      const questionForVerification: Question = {
        id: `temp-${Date.now()}`,
        question: `${questionData.vignette}\n\n${questionData.question}`,
        options: questionData.options.map((opt: string) => opt.replace(/^[A-D]\.\s*/, '')),
        correctAnswerIndex: questionData.correctAnswerIndex,
        rationale: questionData.rationale,
        pearls: questionData.pearls || [],
        system: system as SystemCode,
        conditionId,
        conditionName,
      };

      // Run CoVe verification
      try {
        if (USE_FULL_COVE) {
          // Full 4-step verification pipeline
          logger.info(`[CoVe] Running full verification pipeline`, { userId: auth.userId });
          verificationResult = await runCoVePipeline(
            questionForVerification,
            verificationContext,
            geminiApiCall
          );

          if (verificationResult.passed) {
            logger.info(`[CoVe] Verification PASSED`, {
              userId: auth.userId,
              verificationId: verificationResult.verificationId,
              confidence: verificationResult.overallConfidence,
              attempt,
            });
            break; // Success - exit loop
          } else {
            // Extract issues for retry prompt
            previousIssues = verificationResult.flags.map(
              (f) => `[${f.severity.toUpperCase()}] ${f.message}`
            );
            if (
              verificationResult.answerVerification &&
              !verificationResult.answerVerification.isCorrect
            ) {
              previousIssues.unshift(
                `The marked correct answer may be wrong: ${verificationResult.answerVerification.reasoning}`
              );
            }
            logger.warn(`[CoVe] Verification FAILED, will retry`, {
              userId: auth.userId,
              attempt,
              recommendation: verificationResult.recommendation,
              flagCount: verificationResult.flags.length,
            });
          }
        } else {
          // Quick verification (lightweight)
          logger.info(`[CoVe] Running quick verification`, { userId: auth.userId });
          quickVerifyResult = await quickVerify(
            questionForVerification,
            verificationContext,
            geminiApiCall
          );

          if (quickVerifyResult.passed) {
            logger.info(`[CoVe] Quick verify PASSED`, {
              userId: auth.userId,
              confidence: quickVerifyResult.confidence,
              attempt,
            });
            break; // Success - exit loop
          } else {
            previousIssues = quickVerifyResult.criticalIssues;
            logger.warn(`[CoVe] Quick verify FAILED, will retry`, {
              userId: auth.userId,
              attempt,
              issueCount: quickVerifyResult.criticalIssues.length,
            });
          }
        }
      } catch (verifyError) {
        // Verification itself failed - log but continue with generated question
        logger.error(`[CoVe] Verification error (non-fatal)`, {
          error: verifyError instanceof Error ? verifyError.message : String(verifyError),
          userId: auth.userId,
          attempt,
        });
        // Accept the question but flag it as unverified
        break;
      }
    }

    // Final check - if we exhausted retries without passing
    const verificationPassed = verificationResult?.passed ?? quickVerifyResult?.passed ?? false;
    const verificationConfidence =
      verificationResult?.overallConfidence ?? quickVerifyResult?.confidence ?? 0;

    if (!verificationPassed && attempt >= MAX_COVE_RETRIES) {
      logger.warn(`[CoVe] Max retries exhausted, accepting with warnings`, {
        userId: auth.userId,
        conditionId,
        finalConfidence: verificationConfidence,
      });
    }

    // Generate unique ID
    const questionId = `enh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Store in database with verification metadata
    try {
      await prisma.question.create({
        data: {
          id: questionId,
          vignette: questionData.vignette,
          question: `${questionData.vignette}\n\n${questionData.question}`,
          options: questionData.options,
          correctAnswer: ['A', 'B', 'C', 'D'][questionData.correctAnswerIndex] || 'A',
          explanation: questionData.rationale,
          system: system,
          difficulty: difficulty,
          source: 'enhanced-generation',
          tags: {
            conditionId,
            conditionName,
            task,
            coveVerified: verificationPassed,
            coveConfidence: verificationConfidence,
            coveAttempts: attempt,
          },
        },
      });
    } catch (dbError) {
      // Non-critical - log but don't fail
      logger.warn('Failed to store question', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        userId: auth.userId,
      });
    }

    logger.info('Enhanced question generated', {
      userId: auth.userId,
      questionId,
      conditionId,
      system,
      task,
      difficulty,
      coveVerified: verificationPassed,
      coveAttempts: attempt,
    });

    // Build response with verification metadata
    return {
      data: {
        success: true,
        question: {
          id: questionId,
          vignette: questionData.vignette,
          question: questionData.question,
          options: questionData.options.map((opt: string) => opt.replace(/^[A-D]\.\s*/, '')),
          correctAnswerIndex: questionData.correctAnswerIndex,
          rationale: questionData.rationale,
          pearls: questionData.pearls || [],
          conditionId,
          conditionName,
          system,
          task,
          difficulty,
        },
        // CoVe verification metadata (Phase 4: Neuro-Symbolic Integrity)
        verification: {
          verified: verificationPassed,
          confidence: verificationConfidence,
          attempts: attempt,
          verificationId: verificationResult?.verificationId ?? null,
          recommendation:
            verificationResult?.recommendation ?? (quickVerifyResult?.passed ? 'accept' : 'review'),
          flags:
            verificationResult?.flags?.map((f) => ({
              severity: f.severity,
              code: f.code,
              message: f.message,
            })) ??
            quickVerifyResult?.criticalIssues?.map((issue) => ({
              severity: 'warning' as const,
              code: 'QUICK_VERIFY_ISSUE',
              message: issue,
            })) ??
            [],
          summary: verificationResult?.summary ?? null,
        },
      },
    };
  } catch (error) {
    logger.error('Error generating enhanced question', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to generate enhanced question');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
