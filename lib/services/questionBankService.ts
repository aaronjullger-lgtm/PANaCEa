/**
 * Question Bank Service
 * 
 * Manages pre-generated questions stored in the database.
 * Implements hybrid approach: query DB first, fallback to AI generation.
 * 
 * This reduces API costs and ensures consistent quality through the
 * staging/adequacy check pipeline.
 */

import type { Question, SessionSettings, SystemCode } from '../../src/types';

export interface QuestionBankQuery {
  system?: SystemCode;
  conditionId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  excludeUsed?: boolean; // Exclude questions user has already seen
  userId?: string; // For tracking used questions
}

export interface StoredQuestion {
  id: string;
  questionType: string;
  system: string | null;
  conditionId: string | null;
  difficulty: string;
  questionData: any; // JSON containing the full question
  generatedAt: Date;
  usedAt: Date | null;
  usedBy: string | null;
  quality: number | null;
}

/**
 * Query questions from the database
 * 
 * @param query - Query parameters
 * @returns Array of questions from the database
 */
export async function queryQuestions(query: QuestionBankQuery): Promise<Question[]> {
  try {
    const params = new URLSearchParams();
    
    if (query.system) params.append('system', query.system);
    if (query.conditionId) params.append('conditionId', query.conditionId);
    if (query.difficulty) params.append('difficulty', query.difficulty);
    if (query.excludeUsed) params.append('excludeUsed', 'true');
    if (query.userId) params.append('userId', query.userId);
    
    const response = await fetch(`/api/questions/query?${params.toString()}`);
    
    if (!response.ok) {
      console.error('[QuestionBank] Failed to query questions:', response.statusText);
      return [];
    }
    
    const data = await response.json();
    return data.questions || [];
  } catch (error) {
    console.error('[QuestionBank] Error querying questions:', error);
    return [];
  }
}

/**
 * Mark a question as used by a specific user
 * 
 * @param questionId - ID of the question
 * @param userId - ID of the user
 */
export async function markQuestionAsUsed(questionId: string, userId: string): Promise<void> {
  try {
    await fetch('/api/questions/mark-used', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, userId }),
    });
  } catch (error) {
    console.error('[QuestionBank] Error marking question as used:', error);
  }
}

/**
 * Save a newly generated question to the staging area
 * 
 * @param question - The question to save
 * @returns The saved question ID
 */
export async function saveToStaging(question: Question): Promise<string | null> {
  try {
    const response = await fetch('/api/questions/staging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(question),
    });
    
    if (!response.ok) {
      console.error('[QuestionBank] Failed to save to staging:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('[QuestionBank] Error saving to staging:', error);
    return null;
  }
}

/**
 * Get question statistics
 * 
 * @param system - Optional system to filter by
 * @returns Statistics about available questions
 */
export async function getQuestionStats(system?: SystemCode): Promise<{
  total: number;
  byDifficulty: Record<string, number>;
  bySystem: Record<string, number>;
}> {
  try {
    const params = system ? `?system=${system}` : '';
    const response = await fetch(`/api/questions/stats${params}`);
    
    if (!response.ok) {
      console.error('[QuestionBank] Failed to get stats:', response.statusText);
      return { total: 0, byDifficulty: {}, bySystem: {} };
    }
    
    return await response.json();
  } catch (error) {
    console.error('[QuestionBank] Error getting stats:', error);
    return { total: 0, byDifficulty: {}, bySystem: {} };
  }
}

/**
 * Hybrid question fetcher: tries DB first, falls back to AI generation
 * 
 * @param settings - Session settings
 * @param userId - User ID for tracking
 * @param aiGenerateFallback - Function to generate question via AI
 * @returns Question (from DB or AI-generated)
 */
export async function fetchQuestionHybrid(
  settings: SessionSettings,
  userId: string | null,
  aiGenerateFallback: () => Promise<Question>
): Promise<Question> {
  // Build query based on settings
  const query: QuestionBankQuery = {
    excludeUsed: true,
    userId: userId || undefined,
  };
  
  if (settings.focus === 'topic' && settings.topic) {
    query.system = settings.topic as SystemCode;
  }
  
  if (settings.subcategoryName) {
    // Note: We'd need to map subcategory to conditionId in a real implementation
    // For now, just use system filtering
  }
  
  // Map difficulty setting to database difficulty
  if (settings.difficulty === 'easier') {
    query.difficulty = 'easy';
  } else if (settings.difficulty === 'harder') {
    query.difficulty = 'hard';
  } else {
    query.difficulty = 'medium';
  }
  
  // Try to get from database
  const dbQuestions = await queryQuestions(query);
  
  if (dbQuestions.length > 0) {
    // Pick a random question from the results
    const question = dbQuestions[Math.floor(Math.random() * dbQuestions.length)];
    
    console.log('[QuestionBank] ✓ Using question from database');
    
    // Mark as used (fire and forget)
    // Note: conditionId is used as the unique question identifier in the Question interface
    if (userId && question.conditionId) {
      markQuestionAsUsed(question.conditionId, userId);
    }
    
    return question;
  }
  
  // Fall back to AI generation
  console.log('[QuestionBank] ⚠ No DB questions found, using AI generation');
  const aiQuestion = await aiGenerateFallback();
  
  // Save to staging for future use (fire and forget)
  saveToStaging(aiQuestion);
  
  return aiQuestion;
}

/**
 * Check if sufficient questions exist in the database for a given query
 * 
 * @param query - Query parameters
 * @param minCount - Minimum number of questions required
 * @returns Whether sufficient questions exist
 */
export async function hasSufficientQuestions(
  query: QuestionBankQuery,
  minCount: number = 10
): Promise<boolean> {
  const questions = await queryQuestions(query);
  return questions.length >= minCount;
}
