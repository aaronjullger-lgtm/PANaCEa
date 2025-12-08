/**
 * API Endpoint: Fetch Questions
 * POST /api/questions/fetch
 * 
 * Fetches questions for a user with no-repeat logic
 * Uses the smart storage system to minimize API calls
 */

import type { Request, Response } from 'express';
import { 
  getQuestionsWithNoRepeat, 
  recordQuestionSeen,
  getRepositoryStats 
} from '../../../services/noRepeatService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, system, conditionId, difficulty, questionType, limit = 10 } = req.body;

    // Validate userId
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Build filter
    const filter: any = {};
    if (system) filter.system = system;
    if (conditionId) filter.conditionId = conditionId;
    if (difficulty) filter.difficulty = difficulty;
    if (questionType) filter.questionType = questionType;

    // Fetch questions with no-repeat logic
    const result = await getQuestionsWithNoRepeat(userId, filter, limit);

    // Get repository stats for context
    const stats = await getRepositoryStats();

    return res.status(200).json({
      success: true,
      questions: result.questions,
      source: result.source,
      count: result.questions.length,
      needsGeneration: result.needsGeneration || false,
      generationNeeded: result.generationNeeded || 0,
      stats,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch questions',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
