/**
 * Question Service
 * 
 * Handles fetching questions from the pool/database first,
 * falling back to Gemini API generation only when necessary.
 * Triggers background generation when pool runs low.
 */

import type { Question, SessionSettings } from '../types';

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
function convertPoolQuestion(poolQ: PoolQuestion): Question {
  // Convert correctAnswer letter (A, B, C, D) to index
  const letterToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  let correctIndex = letterToIndex[poolQ.correctAnswer.charAt(0).toUpperCase()] ?? 0;
  
  // If correctAnswer is not a letter, try to find it in options
  if (correctIndex === undefined) {
    correctIndex = poolQ.options.findIndex(opt => 
      opt === poolQ.correctAnswer || opt.includes(poolQ.correctAnswer)
    );
    if (correctIndex === -1) correctIndex = 0;
  }

  // Derive condition name from tags or system
  const condition = poolQ.tags?.[0] || poolQ.system;
  // Use conditionId if available, otherwise generate from condition name
  const conditionId = poolQ.conditionId || condition.toLowerCase().replace(/\s+/g, '-');

  return {
    id: poolQ.id,
    question: poolQ.vignette 
      ? `${poolQ.vignette}\n\n${poolQ.question}` 
      : poolQ.question,
    options: poolQ.options.map(opt => 
      // Remove letter prefix if present (e.g., "A. Option" -> "Option")
      opt.replace(/^[A-D]\.\s*/, '')
    ),
    correctAnswerIndex: correctIndex,
    rationale: poolQ.explanation,
    topic: poolQ.system,
    conditionId,
    condition,
    pearls: [],
    source: poolQ.source === 'pool' ? 'database-pool' : 'database-main',
  } as Question;
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
  const params = new URLSearchParams();
  params.set('count', count.toString());
  if (system) params.set('system', system);
  if (category) params.set('category', category);
  if (difficulty) params.set('difficulty', difficulty);

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/questions/pool?${params}`, { headers });
  
  if (!response.ok) {
    throw new Error(`Pool API error: ${response.status}`);
  }

  const data = await response.json() as {
    questions: PoolQuestion[];
    poolStatus: PoolStatus;
  };

  return {
    questions: data.questions.map(convertPoolQuestion),
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
  count = 20
): Promise<void> {
  try {
    await fetch('/api/questions/generate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  difficulty?: string
): Promise<void> {
  const now = Date.now();
  
  // Don't check too frequently
  if (now - lastPoolCheck < POOL_CHECK_INTERVAL && cachedPoolStatus) {
    if (cachedPoolStatus.needsGeneration) {
      // Still needs generation, trigger it
      triggerBackgroundGeneration(system, category, difficulty);
    }
    return;
  }

  lastPoolCheck = now;

  try {
    const response = await fetch('/api/questions/pool-status');
    if (response.ok) {
      const data = await response.json() as { health: { needsGeneration: boolean; threshold: number }; pool: { available: number } };
      cachedPoolStatus = {
        available: data.pool.available,
        needsGeneration: data.health.needsGeneration,
        threshold: data.health.threshold,
      };

      if (cachedPoolStatus.needsGeneration) {
        triggerBackgroundGeneration(system, category, difficulty);
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
    'cardiology': 'CV',
    'pulmonology': 'PULM',
    'gastroenterology': 'GI',
    'neurology': 'NEURO',
    'musculoskeletal': 'MSK',
    'dermatology': 'DERM',
    'hematology': 'HEME',
    'endocrinology': 'ENDO',
    'heent': 'HEENT',
    'renal': 'RENAL',
    'reproductive': 'REPRO',
    'psychiatry': 'PSYCH',
    'infectious': 'ID',
  };

  const system = focus !== 'all' ? systemMap[focus.toLowerCase()] : undefined;
  // Fixed at PANCE-level (medium) difficulty for standardized practice
  const poolDifficulty = 'medium';

  try {
    // Get auth token if available
    const token = getToken ? await getToken() : null;
    
    // Try to get from pool first
    const { questions, poolStatus } = await fetchFromPool(
      1,
      system,
      undefined, // category
      poolDifficulty,
      token
    );

    // Update cached status and trigger generation if needed
    cachedPoolStatus = poolStatus;
    if (poolStatus.needsGeneration) {
      triggerBackgroundGeneration(system, undefined, poolDifficulty);
    }

    if (questions.length > 0) {
      console.log('[QuestionService] Served question from pool');
      return questions[0];
    }
  } catch (error) {
    console.warn('[QuestionService] Pool fetch failed, falling back to generation:', error);
  }

  // Fall back to Gemini generation
  console.log('[QuestionService] Pool empty or failed, using Gemini generation');
  const { fetchNewQuestion } = await import('./geminiService');
  const question = await fetchNewQuestion(settings, growthAreas);

  // Seed the generated question into the pool for future use
  seedGeneratedQuestion(question, system, poolDifficulty);

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
    'cardiology': 'CV',
    'pulmonology': 'PULM',
    'gastroenterology': 'GI',
    'neurology': 'NEURO',
    'musculoskeletal': 'MSK',
    'dermatology': 'DERM',
    'hematology': 'HEME',
    'endocrinology': 'ENDO',
    'heent': 'HEENT',
    'renal': 'RENAL',
    'reproductive': 'REPRO',
    'psychiatry': 'PSYCH',
    'infectious': 'ID',
  };

  const system = focus !== 'all' ? systemMap[focus.toLowerCase()] : undefined;
  // Fixed at PANCE-level (medium) difficulty for standardized practice
  const poolDifficulty = 'medium';

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
      triggerBackgroundGeneration(system, undefined, poolDifficulty);
    }

    // If we got all requested questions from pool, return them
    if (questions.length >= count) {
      console.log(`[QuestionService] Served ${questions.length} questions from pool`);
      return questions;
    }

    // If we got some but not all, supplement with generated ones
    const needed = count - questions.length;
    console.log(`[QuestionService] Pool had ${questions.length}, generating ${needed} more`);
    
    const { fetchNewQuestion } = await import('./geminiService');
    const generatedQuestions: Question[] = [];
    
    for (let i = 0; i < needed; i++) {
      try {
        const q = await fetchNewQuestion(settings, growthAreas);
        generatedQuestions.push(q);
        seedGeneratedQuestion(q, system, poolDifficulty);
      } catch (error) {
        console.error('[QuestionService] Failed to generate question:', error);
        break;
      }
    }

    return [...questions, ...generatedQuestions];
  } catch (error) {
    console.warn('[QuestionService] Pool fetch failed, falling back to Gemini generation:', error);
    
    // Pool failed (possibly 401) - fall back to generating questions via Gemini
    try {
      const { fetchNewQuestion } = await import('./geminiService');
      const generatedQuestions: Question[] = [];
      
      for (let i = 0; i < count; i++) {
        try {
          const q = await fetchNewQuestion(settings, growthAreas);
          generatedQuestions.push(q);
        } catch (genError) {
          console.error('[QuestionService] Failed to generate question:', genError);
          break;
        }
      }
      
      if (generatedQuestions.length > 0) {
        console.log(`[QuestionService] Generated ${generatedQuestions.length} questions via Gemini fallback`);
        return generatedQuestions;
      }
    } catch (geminiError) {
      console.error('[QuestionService] Gemini fallback also failed:', geminiError);
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
  system?: string,
  difficulty?: string
): Promise<void> {
  // Don't block on this - fire and forget
  try {
    // We could call an API to seed this back, but for now we'll skip
    // since the question was already generated via Gemini
    console.log('[QuestionService] Would seed question back to pool (skipped for now)');
  } catch (error) {
    console.error('[QuestionService] Failed to seed question:', error);
  }
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
    const { generateEnhancedQuestion } = await import('./enhancedQuestionService');
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
export async function refreshPoolStatus(): Promise<PoolStatus | null> {
  lastPoolCheck = 0;
  await checkAndReplenishPool();
  return cachedPoolStatus;
}

export default {
  getQuestion,
  getQuestionBatch,
  getEnhancedQuestion,
  getPoolStatus,
  refreshPoolStatus,
};
