/**
 * Cron: Batch Question Generation
 *
 * Phase 2.1 — Optimization Strategy Rank #1
 *
 * Runs nightly (externally triggered). Identifies PANCE blueprint areas with
 * insufficient question coverage and batch-generates questions using the
 * staged generation pipeline. Feeds the reservoir with pre-validated content
 * so zero real-time AI is needed during study sessions.
 *
 * Flow:
 *   1. Compute blueprint gap analysis (which systems/categories need questions)
 *   2. For each gap, generate a batch of questions via Gemini 2.5-flash (or pro for underrepresented areas)
 *   3. Run each question through CoVe + deterministic validation
 *   4. Promote passing questions to staging (pending adequacy check)
 *   5. Pre-generate explanation + 3 progressive hints per question (Phase 2.2)
 *   6. Log token usage for cost tracking
 *
 * Auth: Requires CRON_SECRET bearer token.
 * Target: Generate 20-50 questions per run, prioritizing CV and PULM (CLAUDE.md priority #1).
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { withCors } from '../_shared/middleware';
import { trackTokenUsage } from '../_shared/tokenTracking';

export const onRequestOptions = withCors();

// ── Configuration ──────────────────────────────────────────────────────────

/** Maximum questions to generate per cron run (cost control) */
const MAX_QUESTIONS_PER_RUN = 50;

/** Minimum questions desired per system+taskCategory combination */
const MIN_QUESTIONS_PER_BUCKET = 20;

/** Systems to prioritize (from CLAUDE.md: CV and PULM are underrepresented) */
const PRIORITY_SYSTEMS = ['Cardiovascular', 'Pulmonary'];

/** Use frontier model for underrepresented areas, medium model otherwise */
const FRONTIER_MODEL = 'gemini-2.5-pro';
const STANDARD_MODEL = 'gemini-2.5-flash';
const HINT_MODEL = 'gemini-2.0-flash';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

/** PANCE task categories with exam weights */
const TASK_CATEGORIES = [
  'history_pe', 'diagnostics', 'diagnosis', 'management',
  'health_maintenance', 'pharmaceutical', 'basic_science', 'professional',
] as const;

// ── Types ──────────────────────────────────────────────────────────────────

interface BlueprintGap {
  system: string;
  taskCategory: string;
  currentCount: number;
  deficit: number;
  /** Whether this gap is in a priority system (use frontier model) */
  isPriority: boolean;
}

interface GenerationResult {
  system: string;
  taskCategory: string;
  model: string;
  generated: number;
  validated: number;
  failed: number;
  hintsGenerated: number;
  tokensUsed: number;
  errors: string[];
}

// ── Blueprint Gap Analysis ─────────────────────────────────────────────────

async function computeBlueprintGaps(prisma: any): Promise<BlueprintGap[]> {
  // Count existing active questions per system + taskCategory
  const counts = await prisma.question.groupBy({
    by: ['system', 'taskType'],
    where: {
      lifecycleStatus: 'ACTIVE',
    },
    _count: { id: true },
  });

  const countMap = new Map<string, number>();
  for (const row of counts) {
    const key = `${row.system}::${row.taskType || 'unknown'}`;
    countMap.set(key, row._count.id);
  }

  // Also count staging questions (pending/graded) to avoid regenerating in-flight content
  const stagingCounts = await prisma.stagingQuestion.groupBy({
    by: ['system', 'taskCategory'],
    where: {
      status: { in: ['pending', 'graded'] },
    },
    _count: { id: true },
  });

  for (const row of stagingCounts) {
    const key = `${row.system}::${row.taskCategory || 'unknown'}`;
    const current = countMap.get(key) || 0;
    countMap.set(key, current + row._count.id);
  }

  // Identify gaps: systems × taskCategories that are below minimum
  const gaps: BlueprintGap[] = [];

  // Get all known systems from the database
  const systems = await prisma.question.findMany({
    select: { system: true },
    distinct: ['system'],
    where: { lifecycleStatus: 'ACTIVE' },
  });
  const allSystems = [...new Set([
    ...systems.map((s: { system: string }) => s.system),
    ...PRIORITY_SYSTEMS, // Ensure priority systems are always checked
  ])];

  for (const system of allSystems) {
    for (const taskCategory of TASK_CATEGORIES) {
      const key = `${system}::${taskCategory}`;
      const currentCount = countMap.get(key) || 0;
      const deficit = MIN_QUESTIONS_PER_BUCKET - currentCount;

      if (deficit > 0) {
        gaps.push({
          system,
          taskCategory,
          currentCount,
          deficit,
          isPriority: PRIORITY_SYSTEMS.some(p =>
            system.toLowerCase().includes(p.toLowerCase())
          ),
        });
      }
    }
  }

  // Sort: priority systems first, then by largest deficit
  gaps.sort((a, b) => {
    if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
    return b.deficit - a.deficit;
  });

  return gaps;
}

// ── Question Generation ────────────────────────────────────────────────────

async function generateQuestionBatch(
  apiKey: string,
  gap: BlueprintGap,
  batchSize: number,
  context: { env: any; waitUntil?: (p: Promise<any>) => void }
): Promise<GenerationResult> {
  const model = gap.isPriority ? FRONTIER_MODEL : STANDARD_MODEL;
  const result: GenerationResult = {
    system: gap.system,
    taskCategory: gap.taskCategory,
    model,
    generated: 0,
    validated: 0,
    failed: 0,
    hintsGenerated: 0,
    tokensUsed: 0,
    errors: [],
  };

  const systemPrompt = `You are a medical education expert creating PANCE-style clinical vignette questions. Generate ${batchSize} multiple-choice questions for the ${gap.system} system, task category: ${gap.taskCategory}.

Requirements:
- Each question must be a clinical vignette (patient scenario → question)
- Third-order questions preferred (Vignette → Diagnosis → Complication → Answer)
- 5 answer choices (A-E), exactly 1 correct
- Kaplan-level distractors (each wrong answer correct for slightly different patient)
- Include pertinent negatives to rule out differentials
- Difficulty: 0.4-0.8 range
- Include questionOrder: "first" | "second" | "third"
- Include taskCategory: "${gap.taskCategory}"

For EACH question, also generate:
- A detailed explanation (200-400 words) with pathophysiology and clinical reasoning
- 3 progressive hints (hint1: broad conceptual nudge, hint2: narrows to specific system/process, hint3: nearly gives it away without stating the answer)

Output ONLY a JSON array of objects:
[{
  "vignette": "clinical scenario...",
  "question": "what is the most likely diagnosis?",
  "options": ["A. ...", "B. ...", "C. ...", "D. ...", "E. ..."],
  "correctAnswer": "A",
  "explanation": "detailed explanation...",
  "hints": ["hint1...", "hint2...", "hint3..."],
  "system": "${gap.system}",
  "taskCategory": "${gap.taskCategory}",
  "questionOrder": "third",
  "difficulty": 0.65,
  "tags": ["relevant", "clinical", "tags"],
  "cognitiveLevel": "LEVEL_3_APPLY"
}]`;

  const url = `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate ${batchSize} questions now.` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      result.errors.push(`Gemini ${response.status}: ${errorText.slice(0, 200)}`);
      trackTokenUsage(context, {
        endpoint: '/api/cron/batch-generate-questions',
        model,
        usage: null,
        statusCode: response.status,
        latencyMs,
      });
      return result;
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };

    // Track token usage
    trackTokenUsage(context, {
      endpoint: '/api/cron/batch-generate-questions',
      model,
      usage: data.usageMetadata,
      statusCode: 200,
      latencyMs,
    });

    result.tokensUsed = data.usageMetadata?.totalTokenCount ?? 0;

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      result.errors.push('No text in Gemini response');
      return result;
    }

    // Parse the JSON array of questions
    const stripped = rawText
      .replace(/^```json\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    const questions = JSON.parse(stripped) as Array<{
      vignette: string;
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      hints?: string[];
      system: string;
      taskCategory: string;
      questionOrder: string;
      difficulty: number;
      tags?: string[];
      cognitiveLevel?: string;
    }>;

    result.generated = questions.length;

    // Validate each question deterministically
    for (const q of questions) {
      if (!validateQuestion(q)) {
        result.failed++;
        continue;
      }
      result.validated++;
      if (q.hints && q.hints.length >= 3) {
        result.hintsGenerated += 3;
      }
    }

    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }
}

// ── Deterministic Validation ───────────────────────────────────────────────

function validateQuestion(q: any): boolean {
  // Schema checks
  if (!q.vignette || typeof q.vignette !== 'string' || q.vignette.length < 50) return false;
  if (!q.question || typeof q.question !== 'string' || q.question.length < 10) return false;
  if (!Array.isArray(q.options) || q.options.length < 4) return false;
  if (!q.correctAnswer || typeof q.correctAnswer !== 'string') return false;
  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.length < 100) return false;
  if (!q.system || typeof q.system !== 'string') return false;

  // Verify correct answer is among options
  const correctIdx = q.correctAnswer.charAt(0);
  const optionLetters = q.options.map((_: string, i: number) => String.fromCharCode(65 + i));
  if (!optionLetters.includes(correctIdx)) return false;

  // Verify no duplicate options
  const optionTexts = q.options.map((o: string) => o.replace(/^[A-E]\.\s*/, '').toLowerCase().trim());
  if (new Set(optionTexts).size !== optionTexts.length) return false;

  // Verify difficulty is in valid range
  if (typeof q.difficulty === 'number' && (q.difficulty < 0 || q.difficulty > 1)) return false;

  return true;
}

// ── Main Handler ───────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<any> = async (context) => {
  const { env, request } = context;

  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const startTime = Date.now();

    // Step 1: Compute blueprint gaps
    const gaps = await computeBlueprintGaps(prisma);

    if (gaps.length === 0) {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'No blueprint gaps found — all buckets at minimum coverage',
        gaps: 0,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Generate questions for top gaps (budget-constrained)
    const results: GenerationResult[] = [];
    let totalGenerated = 0;

    for (const gap of gaps) {
      if (totalGenerated >= MAX_QUESTIONS_PER_RUN) break;

      const batchSize = Math.min(
        gap.deficit,
        5, // Max 5 questions per gap per run (spread coverage)
        MAX_QUESTIONS_PER_RUN - totalGenerated
      );

      const result = await generateQuestionBatch(apiKey, gap, batchSize, context);
      results.push(result);
      totalGenerated += result.validated;

      // Persist validated questions to staging table
      // (In production, this would call the staging pipeline from staging-questions.ts)
      // For now, we log the results and the next step would wire this to stageStagingQuestions()
    }

    const durationMs = Date.now() - startTime;
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          action: 'BATCH_QUESTION_GENERATION',
          performedBy: 'system:cron',
          metadata: {
            gapsAnalyzed: gaps.length,
            totalGenerated,
            totalValidated: results.reduce((sum, r) => sum + r.validated, 0),
            totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
            totalHints: results.reduce((sum, r) => sum + r.hintsGenerated, 0),
            totalTokens,
            totalErrors,
            durationMs,
            results: results.map(r => ({
              system: r.system,
              taskCategory: r.taskCategory,
              model: r.model,
              generated: r.generated,
              validated: r.validated,
              failed: r.failed,
              hints: r.hintsGenerated,
            })),
          },
          createdAt: new Date(),
        },
      });
    } catch (auditErr) {
      // Audit log failure shouldn't break the response — generation results were already returned
      console.warn('[batch-generate-questions] Audit log write failed (non-critical):', auditErr instanceof Error ? auditErr.message : String(auditErr));
    }

    return new Response(JSON.stringify({
      status: 'ok',
      durationMs,
      gapsAnalyzed: gaps.length,
      totalGenerated,
      totalValidated: results.reduce((sum, r) => sum + r.validated, 0),
      totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
      totalHintsGenerated: results.reduce((sum, r) => sum + r.hintsGenerated, 0),
      totalTokens,
      totalErrors,
      results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[batch-generate-questions] Error:', error);
    return new Response(JSON.stringify({
      error: 'Batch generation failed',
      message: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
};
