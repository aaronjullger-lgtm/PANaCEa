/**
 * SRS Tuner Service - AI-powered FSRS parameter optimization
 * 
 * Uses Gemini to analyze user performance and recommend optimized FSRS weights (w)
 * and target retention based on their review history.
 */

import { defaultParameters } from '../lib/fsrs';

interface TuningResult {
  w: number[];
  requestRetention: number;
  reason: string;
}

interface UserStats {
  totalReviews: number;
  accuracy: number;
  avgTimePerQuestion: number;
  retentionRate: number;
}

/**
 * Calculate performance statistics from user attempts
 */
function calculateUserStats(attempts: Array<{ wasCorrect: boolean; createdAt: Date }>): UserStats {
  const total = attempts.length;
  if (total === 0) {
    return { totalReviews: 0, accuracy: 0, avgTimePerQuestion: 0, retentionRate: 0 };
  }

  const correct = attempts.filter((a) => a.wasCorrect).length;
  const accuracy = (correct / total) * 100;

  // Estimate retention: look at reviews older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const matureAttempts = attempts.filter((a) => a.createdAt < sevenDaysAgo);
  const matureCorrect = matureAttempts.filter((a) => a.wasCorrect).length;
  const retentionRate = matureAttempts.length > 0 ? (matureCorrect / matureAttempts.length) * 100 : 90;

  return {
    totalReviews: total,
    accuracy,
    avgTimePerQuestion: 60, // Placeholder; expand if timeSpent is tracked
    retentionRate,
  };
}

/**
 * Build the Gemini prompt for FSRS tuning
 */
function buildTuningPrompt(stats: UserStats, currentWeights: number[]): string {
  return `You are an expert in Spaced Repetition Algorithms (FSRS v5). Your task is to analyze a user's performance and optimize their FSRS parameters.

**User Performance Summary:**
- Total Reviews: ${stats.totalReviews}
- Overall Accuracy: ${stats.accuracy.toFixed(1)}%
- Retention Rate (7-day mature cards): ${stats.retentionRate.toFixed(1)}%

**Current FSRS Weights (w):**
${JSON.stringify(currentWeights)}

**Analysis Guidelines:**
1. If retention rate is LOW (<85%), increase difficulty weights (w[4], w[5]) and reduce stability growth (w[8], w[9]).
2. If retention rate is HIGH (>95%), the user is over-reviewing. Decrease difficulty weights and increase stability growth.
3. If accuracy is low but retention is high, adjust initial stability weights (w[0]-w[3]) downward to space out reviews.
4. The requestRetention target should be 0.85-0.92 for most users, but can be 0.80 for fast learners or 0.95 for perfectionists.

**Output Format (JSON only):**
{
  "w": [19 numbers],
  "requestRetention": 0.9,
  "reason": "Brief explanation of changes"
}

Analyze and return the optimized parameters.`;
}

/**
 * Tune FSRS algorithm for a specific user using AI analysis
 * 
 * @param userId - User identifier
 * @returns Promise<TuningResult> - Optimized FSRS parameters
 */
export async function tuneUserAlgorithm(userId: string): Promise<TuningResult> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database not configured for SRS tuning');
  }

  const { prisma } = await import('../lib/prisma');

  // 1. Fetch last 100 ranked attempts
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId, isRankedAttempt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { wasCorrect: true, createdAt: true },
  });

  if (attempts.length < 20) {
    console.warn(`[SRS Tuner] Insufficient data for ${userId}: ${attempts.length} attempts`);
    // Return defaults with a note
    return {
      w: defaultParameters.w,
      requestRetention: defaultParameters.request_retention,
      reason: 'Insufficient review history (minimum 20 ranked attempts required)',
    };
  }

  // 2. Calculate stats
  const stats = calculateUserStats(attempts);

  // 3. Load current config or defaults
  let currentWeights = defaultParameters.w;
  const existingConfig = await prisma.userSRSConfig.findUnique({ where: { userId } });
  if (existingConfig && Array.isArray(existingConfig.wWeights)) {
    currentWeights = existingConfig.wWeights as number[];
  }

  // 4. Call Gemini for optimization
  const prompt = buildTuningPrompt(stats, currentWeights);
  const geminiResponse = await callGeminiForTuning(prompt);

  // 5. Parse and validate response
  let tuningResult: TuningResult;
  try {
    const parsed = JSON.parse(geminiResponse);
    if (
      !Array.isArray(parsed.w) ||
      parsed.w.length !== 19 ||
      typeof parsed.requestRetention !== 'number'
    ) {
      throw new Error('Invalid AI response structure');
    }
    tuningResult = parsed;
  } catch (parseError) {
    console.error('[SRS Tuner] Failed to parse AI response:', parseError);
    return {
      w: currentWeights,
      requestRetention: defaultParameters.request_retention,
      reason: 'AI tuning failed; kept current settings',
    };
  }

  // 6. Save to database
  await prisma.userSRSConfig.upsert({
    where: { userId },
    update: {
      wWeights: tuningResult.w,
      requestRetention: tuningResult.requestRetention,
      lastTuned: new Date(),
    },
    create: {
      userId,
      wWeights: tuningResult.w,
      requestRetention: tuningResult.requestRetention,
    },
  });

  return tuningResult;
}

/**
 * Call Gemini API for FSRS tuning
 */
async function callGeminiForTuning(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const modelName = 'gemini-2.0-flash-exp';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.3, // Low temp for deterministic tuning
        response_mime_type: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  
  // Strip code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) cleaned = cleaned.slice(firstNewline + 1);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  }
  
  return cleaned.trim();
}
