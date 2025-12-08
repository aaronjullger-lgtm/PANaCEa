/**
 * API Endpoint: Record Question Seen
 * POST /api/questions/record
 * 
 * Records that a user has seen a question (for no-repeat tracking)
 */

import type { Request, Response } from 'express';
import { recordQuestionSeen } from '../../../services/noRepeatService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, questionId, questionType, system, conditionId, wasCorrect } = req.body;

    // Validate required fields
    if (!userId || !questionId || !questionType) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, questionId, and questionType are required' 
      });
    }

    // Record the question as seen
    await recordQuestionSeen(userId, questionId, {
      questionType,
      system,
      conditionId,
      wasCorrect,
    });

    return res.status(200).json({
      success: true,
      message: 'Question recorded successfully',
    });
  } catch (error) {
    console.error('Error recording question:', error);
    return res.status(500).json({ 
      error: 'Failed to record question',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
