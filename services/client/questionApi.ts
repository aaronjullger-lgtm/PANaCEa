/**
 * Client-Safe Question API Wrappers
 * 
 * These functions use fetch() to call API endpoints instead of
 * importing server-side services that contain @prisma/client.
 * 
 * This prevents Prisma from being bundled into client-side code.
 */

import type { SessionSettings, Question } from '../../types';

/**
 * Fetch a pre-generated question from the API
 * Replaces the server-side getQuestion from questionService
 */
export async function getQuestionClient(
  sessionSettings: SessionSettings,
  growthAreas: string[],
  getToken: () => Promise<string | null>
): Promise<Question | null> {
  try {
    const token = await getToken();
    if (!token) {
      console.warn('[getQuestionClient] No auth token available');
      return null;
    }

    // Build request body based on session settings
    const body: Record<string, unknown> = {
      userId: 'current', // The API will extract userId from the token
      limit: 1,
    };

    // Add filters based on session focus
    if (sessionSettings.focus === 'topic' && sessionSettings.topic) {
      body.system = sessionSettings.topic;
    } else if (sessionSettings.focus === 'growth' && growthAreas.length > 0) {
      // Pick a random growth area
      body.system = growthAreas[Math.floor(Math.random() * growthAreas.length)];
    }

    if (sessionSettings.difficulty && sessionSettings.difficulty !== 'same') {
      body.difficulty = sessionSettings.difficulty;
    }

    const response = await fetch('/api/questions/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('[getQuestionClient] API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.questions && data.questions.length > 0) {
      const q = data.questions[0];
      
      // Transform PreGeneratedQuestion to Question format
      const question: Question = {
        id: q.id,
        question: q.questionText,
        options: q.answerOptions || [],
        correctAnswerIndex: q.correctAnswerIndex ?? 0,
        rationale: q.explanation || '',
        topic: q.topic || q.system || 'General',
        system: q.system,
        subcategory: q.subcategory,
        condition: q.condition,
        conditionId: q.conditionId,
        difficulty: q.difficulty,
        type: q.questionType || 'multiple-choice',
        pearls: [],
      };
      
      return question;
    }

    // If no questions in database, we could trigger generation here
    // But for now, return null and let the caller handle it
    if (data.needsGeneration) {
      console.warn('[getQuestionClient] Pool is low, needs generation');
    }

    return null;
  } catch (error) {
    console.error('[getQuestionClient] Error:', error);
    return null;
  }
}

/**
 * Fetch clinical pearls for a condition from the API
 * Replaces the server-side fetchPearlsForQuestion from questionService
 */
export async function fetchPearlsClient(
  conditionId: string,
  token: string | null
): Promise<string[]> {
  try {
    if (!token || !conditionId) {
      return [];
    }

    // URL encode the conditionId to handle special characters
    const encodedConditionId = encodeURIComponent(conditionId);
    const response = await fetch(`/api/conditions/${encodedConditionId}/pearls`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[fetchPearlsClient] API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    return data.pearls || [];
  } catch (error) {
    console.error('[fetchPearlsClient] Error:', error);
    return [];
  }
}
