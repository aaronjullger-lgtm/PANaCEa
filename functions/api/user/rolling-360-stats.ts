/**
 * GET /api/user/rolling-360-stats
 * 
 * Returns the user's Rolling 360 statistics for dashboard display.
 * Safety: Returns structured empty state for new users instead of 404.
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { authenticateRequest } from '../_shared/auth';
import { Rolling360Service } from '../../../lib/services/rolling360Service';

// Empty state response for new users
const EMPTY_STATE_RESPONSE = {
  scoreConfidence: 'collecting' as const,
  totalInWindow: 0,
  correctInWindow: 0,
  accuracyPercent: null,
  systemStats: {},
  predictedScore: null,
  passLikelihood: null,
  blueprintAdherence: null,
  isValidExamDistribution: false,
  weakestSystems: [],
  strongestSystems: [],
  windowStartTime: null,
  windowEndTime: null,
  message: 'Answer Main Session questions to build your Rolling 360 score.',
  questionsNeeded: 50, // Questions needed for "provisional" confidence
};

export async function onRequestGet(context: any): Promise<Response> {
  const { request, env } = context;
  
  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  
  try {
    const rolling360Service = new Rolling360Service(prisma);
    const stats = await rolling360Service.getRolling360Stats(auth.userId);
    
    // Safety: Return structured empty state if no data exists
    if (!stats) {
      return new Response(JSON.stringify(EMPTY_STATE_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Calculate questions needed for next confidence level
    let questionsNeeded = 0;
    if (stats.scoreConfidence === 'collecting') {
      questionsNeeded = 50 - stats.totalInWindow;
    } else if (stats.scoreConfidence === 'provisional') {
      questionsNeeded = 180 - stats.totalInWindow;
    }
    
    return new Response(JSON.stringify({
      ...stats,
      questionsNeeded: Math.max(0, questionsNeeded),
      message: getConfidenceMessage(stats.scoreConfidence, stats.totalInWindow),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error fetching Rolling 360 stats:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch statistics',
      ...EMPTY_STATE_RESPONSE,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
}

function getConfidenceMessage(
  confidence: 'collecting' | 'provisional' | 'confident',
  total: number
): string {
  switch (confidence) {
    case 'collecting':
      return `Building your profile... Answer ${50 - total} more Main Session questions for provisional score.`;
    case 'provisional':
      return `Score is provisional (${total}/360). Answer ${180 - total} more questions for confident prediction.`;
    case 'confident':
      return `Your score is based on ${total} questions matching PANCE distribution.`;
    default:
      return 'Keep studying to build your profile.';
  }
}
