/**
 * Question Service
 *
 * Handles fetching questions from the pool/database first,
 * falling back to Gemini API generation only when necessary.
 * Triggers background generation when pool runs low.
 */

import type { Question, SessionSettings } from '../types';
import { parseJsonOrThrow } from '../lib/utils/safeJsonResponse';

// Pool status tracking
let lastPoolCheck = 0;
const POOL_CHECK_INTERVAL = 60000; // Check every minute
let cachedPoolStatus: PoolStatus | null = null;

interface PoolStatus {
  available: number;
  needsGeneration: boolean;
  threshold: number;
}

interface PoolQuestion {
  id: string;
  vignette?: string;
  question: string;
  imageUrl?: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  system: string;
  difficulty: string;
  tags?: string[];
  source: 'pool' | 'main';
  conditionId?: string;
}

/**
 * Convert pool question format to app Question format
 */
function convertPoolQuestion(poolQ: PoolQuestion): Question | null {
  // Validate options exist
  if (!poolQ.options || poolQ.options.length === 0) {
    console.warn('[QuestionService] Skipping question with no options:', poolQ.id);
    return null;
  }

  // Validate question text exists
  if (!poolQ.question) {
    console.warn('[QuestionService] Skipping question with no question text:', poolQ.id);
    return null;
  }

  // Convert correctAnswer letter (A, B, C, D) to index
  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  let correctIndex = letterToIndex[poolQ.correctAnswer?.charAt(0)?.toUpperCase()] ?? 0;

  // If correctAnswer is not a letter, try to find it in options
  if (correctIndex === undefined) {
    correctIndex = poolQ.options.findIndex(
      (opt) => opt === poolQ.correctAnswer || opt.includes(poolQ.correctAnswer)
    );
    if (correctIndex === -1) correctIndex = 0;
  }

  // Derive condition name from tags or system
  const condition = poolQ.tags?.[0] ?? poolQ.system ?? '';
  // Use conditionId if available, otherwise generate from condition name
  const conditionId = poolQ.conditionId || condition.toLowerCase().replace(/\s+/g, '-');

  const questionText = poolQ.vignette ? `${poolQ.vignette}\n\n${poolQ.question}` : poolQ.question;
  return {
    id: poolQ.id,
    vignette: poolQ.vignette || undefined,
    question: questionText,
    imageUrl: poolQ.imageUrl,
    options: poolQ.options.map((opt) =>
      // Remove letter prefix if present (e.g., "A. Option" -> "Option")
      opt.replace(/^[A-D]\.\s*/, '')
    ),
    correctAnswerIndex: correctIndex,
    rationale: poolQ.explanation,
    topic: poolQ.system,
    conditionId,
    condition,
    pearls: [], // Will be loaded on-demand from medicalContent
    source: poolQ.source === 'pool' ? 'database-pool' : 'database-main',
  } as Question;
}

/**
 * Extract clinical pearls from a question's rationale using regex patterns
 * Looks for "Key Takeaway:", "Clinical Pearl:", "Remember:", etc.
 */
function extractPearlsFromRationale(rationale: string): string[] {
  const pearls: string[] = [];

  // Pattern 1: "Key Takeaway:" or "Clinical Pearl:" followed by content
  const keyTakeawayPattern =
    /(?:Key Takeaway|Clinical Pearl|Remember|Important|High-Yield Fact):\s*(.+?)(?:\n\n|$)/gi;
  let match;
  while ((match = keyTakeawayPattern.exec(rationale)) !== null) {
    const pearl = match[1]?.trim();
    if (pearl && pearl.length > 10 && pearl.length < 500) {
      pearls.push(pearl);
    }
  }

  // Pattern 2: Bullet points that look like pearls (start with • or - and are concise)
  const bulletPattern = /^[•-]\s*(.{10,300})$/gm;
  while ((match = bulletPattern.exec(rationale)) !== null) {
    const pearl = match[1]?.trim();
    // Filter for high-quality pearls (avoid generic statements)
    if (pearl && pearl.length > 20 && !pearl.toLowerCase().startsWith('the correct answer')) {
      pearls.push(pearl);
    }
  }

  // Pattern 3: Sentences with clinical keywords that indicate high-yield info
  const clinicalKeywords = [
    'classic presentation',
    'gold standard',
    'first-line',
    'diagnostic criteria',
    'pathognomonic',
  ];
  const sentences = rationale.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase();
    if (clinicalKeywords.some((kw) => normalized.includes(kw))) {
      const pearl = sentence.trim();
      if (pearl.length > 20 && pearl.length < 300) {
        pearls.push(pearl);
      }
    }
  }

  // Deduplicate and limit to top 5 pearls
  return Array.from(new Set(pearls)).slice(0, 5);
}

/**
 * Save extracted pearls to MedicalContent table
 */
async function savePearlsToDatabase(
  conditionId: string,
  pearls: string[],
  token: string | null
): Promise<void> {
  if (!token || pearls.length === 0) return;

  try {
    await fetch('/api/conditions/pearls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ conditionId, pearls }),
    });
    console.log(`[Pearl Harvester] Saved ${pearls.length} pearls for ${conditionId}`);
  } catch (error) {
    console.error('[Pearl Harvester] Failed to save pearls:', error);
  }
}

/**
 * Fetch clinical pearls from medical content by conditionId
 * This is a client-side fetch that can be called when displaying a question
 */
export async function fetchPearlsForQuestion(
  conditionId: string,
  token?: string | null
): Promise<string[]> {
  try {
    if (!token) {
      console.warn('[QuestionService] No auth token for fetching pearls');
      return [];
    }

    const response = await fetch(`/api/conditions/${conditionId}/pearls`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.warn(
        `[QuestionService] Failed to fetch pearls for ${conditionId}: ${response.status}`
      );
      return [];
    }

    const data = (await response.json()) as { pearls: string[] };
    return data.pearls || [];
  } catch (error) {
    console.error('[QuestionService] Error fetching pearls:', error);
    return [];
  }
}

/**
 * Fetch questions from the pool API
 */
async function fetchFromPool(
  count: number,
  system?: string,
  category?: string,
  difficulty?: string,
  token?: string | null
): Promise<{ questions: Question[]; poolStatus: PoolStatus }> {
  // Validate token is available
  if (!token) {
    console.warn('[QuestionService] No auth token provided to fetchFromPool');
    // Return empty result instead of throwing - allows graceful fallback to Gemini
    return {
      questions: [],
      poolStatus: { available: 0, needsGeneration: false, threshold: 50 },
    };
  }

  const params = new URLSearchParams();
  params.set('count', count.toString());
  if (system) params.set('system', system);
  if (category) params.set('category', category);
  if (difficulty) params.set('difficulty', difficulty);

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`/api/questions/pool?${params}`, { headers });

  if (!response.ok) {
    try {
      const errData = await parseJsonOrThrow<{ error?: string }>(response);
      throw new Error(errData?.error || `Pool API error: ${response.status}`);
    } catch (err) {
      if (err instanceof Error && err.name === 'ServerConfigError') throw err;
      throw new Error(`Pool API error: ${response.status}`);
    }
  }

  const data = (await parseJsonOrThrow(response)) as {
    questions: PoolQuestion[];
    poolStatus: PoolStatus;
  };

  // Convert questions and filter out any that failed validation
  const validQuestions = data.questions
    .map(convertPoolQuestion)
    .filter((q): q is Question => q !== null);

  return {
    questions: validQuestions,
    poolStatus: data.poolStatus,
  };
}

/**
 * Trigger background generation of questions
 */
async function triggerBackgroundGeneration(
  system?: string,
  category?: string,
  difficulty?: string,
  count = 20,
  token?: string | null
): Promise<void> {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    await fetch('/api/questions/generate-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ system, category, difficulty, count }),
    });
    console.log('[QuestionService] Background generation triggered');
  } catch (error) {
    console.error('[QuestionService] Failed to trigger background generation:', error);
  }
}

/**
 * Check pool status and trigger generation if needed
 */
async function checkAndReplenishPool(
  system?: string,
  category?: string,
  difficulty?: string,
  token?: string | null
): Promise<void> {
  const now = Date.now();

  // Don't check too frequently
  if (now - lastPoolCheck < POOL_CHECK_INTERVAL && cachedPoolStatus) {
    if (cachedPoolStatus.needsGeneration) {
      // Still needs generation, trigger it
      triggerBackgroundGeneration(system, category, difficulty, 20, token);
    }
    return;
  }

  lastPoolCheck = now;

  // Skip status check if no token available
  if (!token) {
    console.warn('[QuestionService] No auth token for pool status check');
    return;
  }

  try {
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };
    const response = await fetch('/api/questions/pool-status', { headers });
    if (response.ok) {
      const data = (await parseJsonOrThrow(response)) as {
        health: { needsGeneration: boolean; threshold: number };
        pool: { available: number };
      };
      cachedPoolStatus = {
        available: data.pool.available,
        needsGeneration: data.health.needsGeneration,
        threshold: data.health.threshold,
      };

      if (cachedPoolStatus.needsGeneration) {
        triggerBackgroundGeneration(system, category, difficulty, 20, token);
      }
    }
  } catch (error) {
    console.error('[QuestionService] Failed to check pool status:', error);
  }
}

/**
 * Get a question - tries pool first, falls back to Gemini generation
 * This is the main entry point for getting questions
 */
export async function getQuestion(
  settings: SessionSettings,
  growthAreas: string[],
  getToken?: () => Promise<string | null>
): Promise<Question> {
  const { focus, difficulty } = settings;

  // Map focus to system code for pool query
  const systemMap: Record<string, string> = {
    cardiology: 'CV',
    pulmonology: 'PULM',
    gastroenterology: 'GI',
    neurology: 'NEURO',
    musculoskeletal: 'MSK',
    dermatology: 'DERM',
    hematology: 'HEME',
    endocrinology: 'ENDO',
    heent: 'HEENT',
    renal: 'RENAL',
    reproductive: 'REPRO',
    psychiatry: 'PSYCH',
    infectious: 'ID',
  };

  const system = focus !== 'all' ? systemMap[focus.toLowerCase()] : undefined;
  // Fixed at PANCE-level difficulty for standardized practice
  const poolDifficulty = 'PANCE-level';

  let dbQuestion: Question | null = null;

  try {
    // Get auth token if available
    const token = getToken ? await getToken() : null;
    console.time('[QuestionService] DB Fetch');
    // Try to get from pool (DB) first
    const { questions, poolStatus } = await fetchFromPool(
      1,
      system,
      undefined, // category
      poolDifficulty,
      token
    );
    console.timeEnd('[QuestionService] DB Fetch');

    // Update cached status and trigger generation if needed
    cachedPoolStatus = poolStatus;
    if (poolStatus.needsGeneration) {
      triggerBackgroundGeneration(system, undefined, poolDifficulty, 20, token);
    }

    if (questions.length > 0) {
      dbQuestion = questions[0] ?? null;
      console.log('[QuestionService] Served question from DB pool');
    }
  } catch (error) {
    console.timeEnd('[QuestionService] DB Fetch');
    console.warn('[QuestionService] Pool fetch failed, falling back to generation:', error);
  }

  // If DB provided a fresh question, return it; otherwise generate via Gemini
  if (dbQuestion) {
    return dbQuestion;
  }

  // Fall back to Gemini generation with CoVe verification
  console.log('[QuestionService] Pool empty or failed, using Gemini generation with CoVe');
  console.time('[QuestionService] Gemini Gen + CoVe');
  const { fetchVerifiedQuestion } = await import('../lib/verified-question-generator');
  const verifiedResult = await fetchVerifiedQuestion({
    settings,
    growthAreas,
    verificationMode: 'quick', // Use quick mode for performance
  });
  const question = verifiedResult.question;

  // Log verification status
  if (verifiedResult.verified) {
    console.log(
      `[QuestionService] Question verified (${verifiedResult.verificationMode}, confidence: ${verifiedResult.quickVerification?.confidence?.toFixed(2) ?? 'N/A'})`
    );
  } else {
    console.warn(
      `[QuestionService] Question unverified after ${verifiedResult.attempts} attempts - serving best available`
    );
  }
  console.timeEnd('[QuestionService] Gemini Gen + CoVe');

  // Pearl Harvester: Extract and save clinical pearls from the rationale
  if (question.rationale && question.conditionId) {
    const extractedPearls = extractPearlsFromRationale(question.rationale);
    if (extractedPearls.length > 0) {
      const token = getToken ? await getToken() : null;
      savePearlsToDatabase(question.conditionId, extractedPearls, token);
    }
  }

  // Seed the generated question into the pool for future use
  const token = getToken ? await getToken() : null;
  seedGeneratedQuestion(question, token, system, poolDifficulty);

  return question;
}

/**
 * Get multiple questions at once (for batch prefetching)
 */
export async function getQuestionBatch(
  settings: SessionSettings,
  growthAreas: string[],
  count: number,
  getToken?: () => Promise<string | null>
): Promise<Question[]> {
  const { focus, difficulty } = settings;

  const systemMap: Record<string, string> = {
    cardiology: 'CV',
    pulmonology: 'PULM',
    gastroenterology: 'GI',
    neurology: 'NEURO',
    musculoskeletal: 'MSK',
    dermatology: 'DERM',
    hematology: 'HEME',
    endocrinology: 'ENDO',
    heent: 'HEENT',
    renal: 'RENAL',
    reproductive: 'REPRO',
    psychiatry: 'PSYCH',
    infectious: 'ID',
  };

  const system = focus !== 'all' ? systemMap[focus.toLowerCase()] : undefined;
  // Fixed at PANCE-level difficulty for standardized practice
  const poolDifficulty = 'PANCE-level';

  try {
    // Get auth token if available
    const token = getToken ? await getToken() : null;

    const { questions, poolStatus } = await fetchFromPool(
      count,
      system,
      undefined,
      poolDifficulty,
      token
    );

    cachedPoolStatus = poolStatus;
    if (poolStatus.needsGeneration) {
      triggerBackgroundGeneration(system, undefined, poolDifficulty, 20, token);
    }

    // If we got all requested questions from pool, return them
    if (questions.length >= count) {
      console.log(`[QuestionService] Served ${questions.length} questions from pool`);
      return questions;
    }

    // If we got some but not all, supplement with generated ones using CoVe
    const needed = count - questions.length;
    console.log(
      `[QuestionService] Pool had ${questions.length}, generating ${needed} more with CoVe`
    );

    const { fetchVerifiedQuestion } = await import('../lib/verified-question-generator');
    const generatedQuestions: Question[] = [];

    for (let i = 0; i < needed; i++) {
      try {
        const verifiedResult = await fetchVerifiedQuestion({
          settings,
          growthAreas,
          verificationMode: 'quick', // Use quick mode for batch performance
        });
        const q = verifiedResult.question;
        generatedQuestions.push(q);

        // Log verification status
        if (verifiedResult.verified) {
          console.log(
            `[QuestionService] Batch question ${i + 1}/${needed} verified (confidence: ${verifiedResult.quickVerification?.confidence?.toFixed(2) ?? 'N/A'})`
          );
        }

        // Pearl Harvester: Extract and save clinical pearls
        if (q.rationale && q.conditionId) {
          const extractedPearls = extractPearlsFromRationale(q.rationale);
          if (extractedPearls.length > 0) {
            savePearlsToDatabase(q.conditionId, extractedPearls, token);
          }
        }

        seedGeneratedQuestion(q, token, system, poolDifficulty);
      } catch (error) {
        console.error('[QuestionService] Failed to generate verified question:', error);
        break;
      }
    }

    return [...questions, ...generatedQuestions];
  } catch (error) {
    console.warn('[QuestionService] Pool fetch failed, falling back to Gemini generation:', error);

    // Pool failed (possibly 401) - fall back to generating questions via CoVe-verified Gemini
    try {
      const { fetchVerifiedQuestion } = await import('../lib/verified-question-generator');
      const generatedQuestions: Question[] = [];

      console.log(
        `[QuestionService] Fallback: generating ${count} questions with CoVe verification`
      );
      for (let i = 0; i < count; i++) {
        try {
          const verifiedResult = await fetchVerifiedQuestion({
            settings,
            growthAreas,
            verificationMode: 'quick', // Use quick mode for fallback performance
          });
          const q = verifiedResult.question;
          generatedQuestions.push(q);

          // Log verification status
          if (verifiedResult.verified) {
            console.log(
              `[QuestionService] Fallback question ${i + 1}/${count} verified (confidence: ${verifiedResult.quickVerification?.confidence?.toFixed(2) ?? 'N/A'})`
            );
          }
        } catch (genError) {
          console.error('[QuestionService] Failed to generate verified question:', genError);
          break;
        }
      }

      if (generatedQuestions.length > 0) {
        console.log(
          `[QuestionService] Generated ${generatedQuestions.length} CoVe-verified questions via fallback`
        );
        return generatedQuestions;
      }
    } catch (coveError) {
      console.error('[QuestionService] CoVe fallback also failed:', coveError);
    }

    // If everything fails, throw so the UI can show an error
    throw new Error('Unable to load questions. Please check your connection and try again.');
  }
}

/**
 * Seed a Gemini-generated question back into the pool
 */
async function seedGeneratedQuestion(
  question: Question,
  token: string | null,
  system?: string,
  difficulty?: string
): Promise<void> {
  if (!token) {
    console.warn('[QuestionService] No token, skipping background seed.');
    return;
  }
  // Don't block on this - fire and forget
  (async () => {
    try {
      await fetch('/api/questions/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
    } catch (error) {
      console.error('[QuestionService] Failed to seed question:', error);
    }
  })();
}

/**
 * Get an enhanced question using database content context
 * This provides richer, more accurate questions based on our extensive condition data
 */
export async function getEnhancedQuestion(
  settings: SessionSettings,
  growthAreas: string[],
  enabledSystems?: Set<string>
): Promise<Question> {
  try {
    const { generateEnhancedQuestion } = await import('./ai/enhancedQuestionService');
    const question = await generateEnhancedQuestion(settings, growthAreas, enabledSystems);

    if (question) {
      console.log('[QuestionService] Served enhanced question');
      return question;
    }

    // Fall back to regular question if enhanced generation fails
    console.warn('[QuestionService] Enhanced generation failed, falling back to regular');
    return getQuestion(settings, growthAreas);
  } catch (error) {
    console.error('[QuestionService] Enhanced question failed:', error);
    return getQuestion(settings, growthAreas);
  }
}

/**
 * Get current pool status
 */
export function getPoolStatus(): PoolStatus | null {
  return cachedPoolStatus;
}

/**
 * Force refresh pool status
 */
export async function refreshPoolStatus(
  getToken?: () => Promise<string | null>
): Promise<PoolStatus | null> {
  lastPoolCheck = 0;
  const token = getToken ? await getToken() : null;
  await checkAndReplenishPool(undefined, undefined, undefined, token);
  return cachedPoolStatus;
}

export default {
  getQuestion,
  getQuestionBatch,
  getEnhancedQuestion,
  getPoolStatus,
  refreshPoolStatus,
};
