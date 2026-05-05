/**
 * POST /api/questions/generate-enhanced
 * Generate high-quality PANCE questions using rich database context.
 * Uses Gemini API with condition data, linked entities, and PANCE task focus.
 *
 * PHASE 4: NEURO-SYMBOLIC INTEGRITY - Milestone 1
 * Now includes Chain of Verification (CoVe) to prevent AI hallucinations.
 *
 * Sprint 7 (AI Gateway migration): Replaced direct `@google/generative-ai`
 * SDK usage with `gateway.callText()`:
 *   - Main generation: task='generation', tier='powerful' (gemini-2.5-pro,
 *     same as before). Temperature = task default (0.75).
 *   - CoVe verification wrapper (`geminiApiCall`): task='grading', tier='balanced'.
 *     Verification is essentially a grading/fact-check task and benefits from
 *     the lower default temperature (0.2) for deterministic answers.
 * Gateway's same_provider fallback replaces the prior silent SDK failure mode.
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import type { Question, SystemCode } from '../../../types';
import {
  quickVerify,
  runCoVePipeline,
  type VerificationContext,
  type CoVeResult,
} from '../../../lib/cove-verification';
import {
  gateway,
  GatewayError,
  toGatewayContext,
  type GatewayContext,
} from '../../../lib/ai/aiGateway';

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

  const arrayFields = new Set([
    'symptoms',
    'signs',
    'diagnostics',
    'treatment',
    'differentialDiagnosis',
    'complications',
    'riskFactors',
    'buzzwords',
    'clinicalPearls',
  ]);

  // Extract each section
  for (const [key, pattern] of Object.entries(sectionPatterns)) {
    const match = contextString.match(pattern);
    if (match?.[1]) {
      const content = match[1].trim();
      // For array fields, split by common delimiters
      if (arrayFields.has(key)) {
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
- Realistic clinical vignette with relevant details; include PERTINENT NEGATIVES that rule out look-alikes (e.g. no tenderness → rules out costochondritis).
- Vitals as CLUES, not filler; use relative baselines when relevant (e.g. normal BP in a hypertensive patient = relative hypotension).
- May include subtle findings or red herrings; plausible distractors that test understanding.
- Second-order thinking required (diagnosis → management); mix of common and moderately uncommon presentations.`,

  harder: `Generate a HARDER question above typical PANCE difficulty (VIGNETTE EVOLUTION - "Messier" vignette, not just zebra trivia):
- Prefer a "messier" vignette: more data, pertinent negatives, vitals as clues—not just a rarer diagnosis.
- PERTINENT NEGATIVES: Explicitly rule out look-alikes in the vignette. Example: "No tenderness to palpation (rules out costochondritis). No pain with breathing (rules out pleuritis)."
- VITALS AS CLUES: Vitals must be clinically meaningful. Use relative baselines when appropriate: e.g. "BP 110/70" in a patient who is "normally hypertensive (160/90)" = relative hypotension—the student must interpret this.
- Complex patient with comorbidities, multi-step reasoning, mechanism or pathophysiology; integration of multiple concepts.`,
};

// Maximum retry attempts for CoVe verification failures
const MAX_COVE_RETRIES = 3;

// Whether to use full CoVe pipeline or quick verify (configurable via env)
const USE_FULL_COVE = true;

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): enhanced generation
// with CoVe verification makes 2-3 Gemini calls (gemini-2.5-pro for draft,
// gemini-2.5-flash for verify). 25 rpm 'ai' bucket matches the cost profile.
export const onRequestPost = aiEndpoint(GenerationRequestSchema, async (context) => {
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

    // AI Gateway: build GatewayContext once, reuse for all calls in this request.
    const gwCtx: GatewayContext = toGatewayContext(context);

    // Gemini API wrapper for CoVe verification calls — routes through gateway
    // with task='grading' (lower default temperature, appropriate for
    // deterministic fact-checking of the generated question).
    const geminiApiCall = async (prompt: string): Promise<string> => {
      try {
        const result = await gateway.callText(gwCtx, {
          mode: 'text',
          task: 'grading',
          tier: 'balanced',
          endpoint: '/api/questions/generate-enhanced#cove-verify',
          userPrompt: prompt,
        });
        if (result.blocked) {
          logger.warn('[CoVe] Verification call blocked by safety filter', {
            reason: result.blockReason ?? 'unknown',
          });
          return '';
        }
        return result.text ?? '';
      } catch (err) {
        // CoVe wraps this in its own try/catch — surface the error cleanly.
        if (err instanceof GatewayError) {
          logger.warn('[CoVe] Gateway error during verification', {
            code: err.code,
            requestId: err.requestId,
            traceId: err.traceId,
          });
        }
        throw err;
      }
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

    // Build base generation prompt with Kaplan-style guidelines
    const buildGenerationPrompt = (previousIssues?: string[]) => {
      let issueWarning = '';
      if (previousIssues && previousIssues.length > 0) {
        issueWarning = `\n## IMPORTANT: Previous Generation Issues (MUST FIX)
The previous attempt had these verification failures:
${previousIssues.map((issue) => `- ${issue}`).join('\n')}

Please regenerate with extra attention to medical accuracy.\n`;
      }

      return `You are a board-certified physician and PANCE exam question writer creating questions modeled after Kaplan Medical's gold-standard question bank.

## Condition Information
${conditionContext}
${issueWarning}
## Question Requirements
${taskInstruction}

${difficultyInstruction}

## KAPLAN-STYLE FORMATTING RULES

### VIGNETTE (3-5 sentences) – Vignette Evolution (Adaptive Complexity):
- Start: "A [age]-year-old [sex] with [relevant PMH] presents to [setting] with [chief complaint] for [duration]..."
- Include PERTINENT POSITIVES: findings that point toward the diagnosis.
- Include PERTINENT NEGATIVES: explicitly rule out look-alikes. Example: "No tenderness to palpation (rules out costochondritis). No pain with breathing (rules out pleuritis)." Do not list only positives.
- VITALS AS CLUES: Vitals must not be filler. Use relative baselines when relevant: e.g. "BP 110/70" in a patient "normally hypertensive (160/90)" = relative hypotension—the student must interpret. Ensure vitals support or contradict a diagnosis or add meaningful context.
- DESCRIBE symptoms clinically - don't state the diagnosis in the vignette

### UNCALCULATED LABS (Active Interpretation):
- When including labs, provide RAW BMP (Na, Cl, HCO3, etc.) in a table only. Do NOT state "anion gap 20" or other derived values—the student must calculate.

### HIDDEN IMAGE (when an image/radiograph is referenced or shown):
- Do NOT state the finding or diagnosis in the vignette text. Use only clinical scenario + "Radiograph is shown" (e.g. "Patient fell on outstretched hand. Radiograph is shown."). The student must read the image to answer.

### QUESTION STEM (Third-Order / "Double Jump" Rule):
- AVOID first-order recall: "What is the diagnosis?" (e.g. "Circular rash → Lyme")
- AVOID second-order only: "What is the first-line treatment?" (e.g. "Lyme → Doxycycline")
- PREFER third-order: Require a chain: Vignette → Diagnosis → Complication/next step → Answer.
  - Example (good): "A patient has a circular rash. What is the mechanism of action of the first-line treatment for the likely complication if left untreated?" → Answer: "Inhibits 30S ribosomal subunit" (Lyme → Doxy → mechanism).
- PREFER: "What is the mechanism of action of the most appropriate next step in management?"
- PREFER: "Which finding would most likely be seen on [test] if [complication] develops?"
- PREFER: "What is the most appropriate next step in management?" (when vignette already implies diagnosis)

### ANSWER OPTIONS (Kaplan-Level Distractors):
- DO NOT prefix with "A.", "B.", etc. - just write the option text directly
- Every wrong answer must be "the right answer to a different question" - correct for a slightly different patient.
  - Example (otitis): A = correct for viral/watchful waiting, B = bacterial (answer), C = correct for recurrent/effusion, D = correct for penicillin-allergic.
- BAD: Obviously wrong options (e.g. chemotherapy for simple ear infection).
- GOOD: Each distractor is first-line or appropriate for a different scenario (different diagnosis, allergy, recurrence, severity).
- Correct answer should not be obviously longer/more detailed

## STANDARDIZED RATIONALE (5-Section Template)
The "rationale" object MUST follow this structure for fast review:
1. bottomLine: One sentence. "The diagnosis is X, and the treatment is Y." (for the student in a rush)
2. whyCorrect: Walk through the vignette steps. "The patient's [findings] suggest [diagnosis]. [Key clue] confirms it. Therefore, the next step is..."
3. whyIncorrectA/B/C/D: For each wrong option, explain why a student might have chosen it, then why it is wrong for this patient. Format: "Option A (Amoxicillin): Incorrect because this patient has a Penicillin allergy."
4. clinicalPearl: A memorable hook. "Remember: Pain out of proportion to exam = Mesenteric Ischemia until proven otherwise."
5. highYieldImageOrTable: Optional. "N/A" or a short description of a diagram/flow-chart that would help (e.g. "DDx algorithm for acute chest pain").

## Output Format
Generate a JSON object with this exact structure (no markdown, no backticks):
{
  "vignette": "A 45-year-old man with hypertension and type 2 diabetes presents to the emergency department with acute onset of crushing substernal chest pain radiating to his left arm for the past 30 minutes. He is diaphoretic and appears anxious. Vital signs show BP 160/100 mmHg, HR 110 bpm. ECG reveals ST-segment elevation in leads V2-V4.",
  "question": "What is the most appropriate initial intervention for this patient?",
  "options": ["Emergent cardiac catheterization", "Sublingual nitroglycerin", "IV thrombolytic therapy", "Serial troponins every 6 hours"],
  "correctAnswerIndex": 0,
  "rationale": {
    "bottomLine": "The diagnosis is acute STEMI, and the treatment is emergent PCI (or thrombolytics if PCI unavailable).",
    "whyCorrect": "This patient has an acute **STEMI** with classic presentation (chest pain, diaphoresis, ST-elevation in V2-V4). Primary **PCI** within 90 minutes is the gold standard for revascularization.",
    "whyIncorrectB": "Nitroglycerin provides symptomatic relief but does not address the coronary occlusion.",
    "whyIncorrectC": "Thrombolytics are second-line when PCI is unavailable within 120 minutes.",
    "whyIncorrectD": "Serial troponins are appropriate for NSTEMI workup, not acute STEMI requiring immediate intervention.",
    "clinicalPearl": "Door-to-balloon time goal is <90 minutes for STEMI. Every 30-minute delay increases mortality by 7.5%.",
    "highYieldImageOrTable": "N/A"
  },
  "pearls": ["STEMI requires emergent reperfusion - PCI preferred over thrombolytics", "Classic STEMI triad: chest pain, diaphoresis, ST-elevation", "ECG changes in V1-V4 indicate anterior/LAD territory"]
}

CRITICAL RULES:
1. The vignette MUST describe clinical findings without stating the diagnosis
2. All 4 options must be plausible; each wrong answer should be correct for a different patient/scenario (Kaplan-level distractors)
3. Options should NOT have letter prefixes (A., B., etc.)
4. The rationale MUST explain why each wrong answer is incorrect for THIS patient (and can note when it would be correct for another scenario)
5. Include 2-3 high-yield clinical pearls
6. Return ONLY the JSON object - no markdown formatting`;
    };

    // ========================================================================
    // GENERATION + VERIFICATION LOOP (CoVe Pipeline)
    // ========================================================================
    let questionData: {
      vignette: string;
      question: string;
      options: string[];
      correctAnswerIndex: number;
      rationale: unknown;
      pearls?: unknown[];
    } | undefined;
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
      let responseText: string;
      try {
        const genResult = await gateway.callText(gwCtx, {
          mode: 'text',
          task: 'generation',
          tier: 'powerful', // gemini-2.5-pro, matches prior endpoint model
          endpoint: '/api/questions/generate-enhanced',
          userPrompt: prompt,
        });
        if (genResult.blocked) {
          logger.warn(`[CoVe] Attempt ${attempt}: Gemini blocked generation`, {
            reason: genResult.blockReason ?? 'unknown',
            userId: auth.userId,
          });
          previousIssues = [
            `Generation was blocked by safety filter: ${genResult.blockReason ?? 'unknown'}. Rewrite to avoid any sensitive content while preserving clinical accuracy.`,
          ];
          continue;
        }
        responseText = genResult.text ?? '';
      } catch (err) {
        if (err instanceof GatewayError) {
          logger.warn(`[CoVe] Attempt ${attempt}: Gateway error`, {
            code: err.code,
            retryable: err.retryable,
            requestId: err.requestId,
            traceId: err.traceId,
            userId: auth.userId,
          });
          // Non-retryable gateway errors abort the loop; retryable ones
          // already exhausted the gateway's internal retry budget.
          throw err;
        }
        throw err;
      }

      // Parse JSON response
      try {
        const cleanedResponse = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        questionData = JSON.parse(cleanedResponse) as typeof questionData;
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
        !questionData?.vignette ||
        !questionData?.question ||
        !questionData?.options ||
        questionData?.correctAnswerIndex === undefined ||
        !questionData?.rationale
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

      type QuestionForVerification = Question & {
        correctAnswerIndex?: number;
        rationale?: string;
        pearls?: unknown;
        conditionName?: string;
      };
      const questionForVerification: QuestionForVerification = {
        id: `temp-${Date.now()}`,
        question: `${questionData.vignette}\n\n${questionData.question}`,
        options: questionData.options.map((opt: string) => opt.replace(/^[A-D]\.\s*/, '')),
        correctAnswerIndex: questionData.correctAnswerIndex,
        rationale: questionData.rationale,
        pearls: questionData.pearls || [],
        system: system as SystemCode,
        conditionId,
        conditionName,
      } as QuestionForVerification;

      // Run CoVe verification
      try {
        if (USE_FULL_COVE) {
          // Full 4-step verification pipeline
          logger.info(`[CoVe] Running full verification pipeline`, { userId: auth.userId });
          verificationResult = await runCoVePipeline(
            questionForVerification as Question,
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
            questionForVerification as Question,
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

    // Ensure questionData exists before proceeding
    if (!questionData) {
      throw new Error('Failed to generate valid question after maximum retries');
    }

    // Final check - if we exhausted retries without passing
    const verificationPassed = verificationResult?.passed ?? quickVerifyResult?.passed ?? false;
    const verificationConfidence =
      verificationResult?.overallConfidence ?? quickVerifyResult?.confidence ?? 0;

    // Minimum confidence required to write the staging record for admin review.
    // Below this threshold the question failed every attempt and is not salvageable
    // without a full re-generation — return 422 rather than polluting the pipeline.
    const MIN_CONFIDENCE_FOR_STAGING = 0.35;

    if (!verificationPassed && attempt >= MAX_COVE_RETRIES) {
      if (verificationConfidence < MIN_CONFIDENCE_FOR_STAGING) {
        logger.error(`[CoVe] All retries failed and confidence too low — aborting write`, {
          userId: auth.userId,
          conditionId,
          finalConfidence: verificationConfidence,
          attempts: attempt,
        });
        throw new Error(
          `Question generation failed verification after ${attempt} attempts (confidence: ${verificationConfidence.toFixed(2)}). Please retry.`
        );
      }
      logger.warn(`[CoVe] Max retries exhausted, saving to staging for review`, {
        userId: auth.userId,
        conditionId,
        finalConfidence: verificationConfidence,
      });
    }

    // Generate unique IDs
    const questionId = `enh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const stagingId = `stg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date();

    // 1. Save to StagingQuestion (Staging Lake)
    try {
      await prisma.stagingQuestion.create({
        data: {
          id: stagingId,
          vignette: questionData.vignette,
          question: questionData.question,
          options: questionData.options as object,
          correctAnswer: ['A', 'B', 'C', 'D', 'E'][questionData.correctAnswerIndex] ?? 'A',
          explanation: typeof questionData.rationale === 'string'
            ? questionData.rationale
            : JSON.stringify(questionData.rationale),
          system,
          difficulty,
          status: 'pending',
          aiGrade: {
            verificationPassed,
            verificationConfidence,
            coveAttempts: attempt,
            flags: (verificationResult?.flags ?? quickVerifyResult?.criticalIssues ?? []).map((f) =>
              typeof f === 'string' ? f : JSON.stringify(f)
            ),
            recommendation:
            verificationResult?.recommendation ??
            (quickVerifyResult?.passed ? 'accept' : 'review'),
          },
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
    } catch (stagingError) {
      logger.error('Generated question could not be staged for review', {
        error: stagingError instanceof Error ? stagingError.message : String(stagingError),
        userId: auth.userId,
      });
      throw new Error('Generated question could not be staged for review');
    }

    // 2. Promote to Question table (live) — ONLY if CoVe verification passed.
    // Unverified questions remain in staging (status: 'pending') for admin review
    // and will not be served to students until promoted manually or re-verified.
    if (!verificationPassed) {
      logger.info('[CoVe] Skipping live promotion — question did not pass verification', {
        userId: auth.userId,
        stagingId,
        verificationConfidence,
        coveAttempts: attempt,
      });
      return {
        status: 202,
        data: {
          success: false,
          submissionReady: false,
          requiresApproval: true,
          stagingQuestionId: stagingId,
          message: 'Question generated but held for review because verification did not pass.',
          verification: {
            verified: false,
            confidence: verificationConfidence,
            attempts: attempt,
            verificationId: verificationResult?.verificationId ?? null,
            recommendation:
              verificationResult?.recommendation ??
              (quickVerifyResult?.passed ? 'accept' : 'review'),
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
    }

    try {
      await prisma.question.create({
        data: {
          id: questionId,
          vignette: questionData.vignette,
          question: `${questionData.vignette}\n\n${questionData.question}`,
          options: questionData.options as object,
          correctAnswer: ['A', 'B', 'C', 'D', 'E'][questionData.correctAnswerIndex] ?? 'A',
          explanation: typeof questionData.rationale === 'string'
            ? questionData.rationale
            : JSON.stringify(questionData.rationale),
          system,
          difficulty,
          source: 'enhanced-generation',
          updatedAt: now,
          generatedAt: now,
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
          humanReviewed: false,
          verificationScore: verificationConfidence,
          tags: {
            conditionId,
            conditionName,
            task,
            coveVerified: verificationPassed,
            coveConfidence: verificationConfidence,
            coveAttempts: attempt,
          } as object,
        },
      });

      // 3. Update staging record status to 'approved'
      try {
        await prisma.stagingQuestion.update({
          where: { id: stagingId },
          data: { status: 'approved' },
        });
      } catch (updateError) {
        logger.warn('Failed to update staging question status', {
          error: updateError instanceof Error ? updateError.message : String(updateError),
          userId: auth.userId,
        });
      }
    } catch (dbError) {
      logger.error('Verified question could not be persisted', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        userId: auth.userId,
      });
      throw new Error('Verified question could not be persisted');
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
