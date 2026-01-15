/**
 * POST /api/study/session/generate
 * 
 * Generates a new study session with questions selected using the
 * Priority Waterfall algorithm (Blueprint + FSRS + Interleaving).
 * 
 * Request Body:
 * {
 *   mode: 'mainSession' | 'review' | 'focused',
 *   size: number (default 20),
 *   systemFocus?: string (for focused mode)
 * }
 */

import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { authenticateRequest } from '../../_shared/auth';
import { MainSessionQuestionSelector } from '../../../../lib/services/mainSessionQuestionSelector';

export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context;
  
  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Parse request body
  let body: {
    mode: 'mainSession' | 'review' | 'focused';
    size?: number;
    systemFocus?: string;
  };
  
  try {
    body = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Validate mode
  if (!body.mode || !['mainSession', 'review', 'focused'].includes(body.mode)) {
    return new Response(JSON.stringify({ 
      error: 'Invalid mode. Must be: mainSession, review, or focused' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Validate size (1-50)
  const size = Math.max(1, Math.min(50, body.size || 20));
  
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  
  try {
    // Generate session based on mode
    if (body.mode === 'mainSession') {
      const selector = new MainSessionQuestionSelector(prisma);
      const result = await selector.generateSession(auth.userId, size);
      
      // Create StudySession record
      const session = await prisma.studySession.create({
        data: {
          userId: auth.userId,
          startedAt: new Date(),
          sessionType: 'mixed',
          mode: 'mainSession',
          difficulty: 'adaptive',
          systemsTargeted: Object.keys(
            result.questions.reduce((acc, q) => {
              acc[q.system] = true;
              return acc;
            }, {} as Record<string, boolean>)
          ),
        },
      });
      
      return new Response(JSON.stringify({
        sessionId: session.id,
        mode: 'mainSession',
        questionIds: result.questionIds,
        questions: result.questions,
        priorityBreakdown: result.priorityBreakdown,
        deficitsAddressed: result.deficitsAddressed,
        // v2.0 Interleaved Assembler fields
        interleavingEnforced: result.interleavingEnforced,
        interleavingViolations: result.interleavingViolations,
        systemDistribution: result.systemDistribution,
        size: result.questionIds.length,
        message: generateSessionMessage(result),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // TODO: Implement 'review' and 'focused' modes
    return new Response(JSON.stringify({
      error: `Mode '${body.mode}' not yet implemented. Use 'mainSession'.`,
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error generating session:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate session',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
}

function generateSessionMessage(result: {
  priorityBreakdown: { A: number; B: number; C: number };
  deficitsAddressed: { system: string; deficitPercent: number }[];
}): string {
  const { priorityBreakdown, deficitsAddressed } = result;
  
  if (deficitsAddressed.length > 0) {
    const systems = deficitsAddressed.map(d => d.system).join(', ');
    return `Session includes extra ${systems} questions to balance your PANCE blueprint distribution.`;
  }
  
  if (priorityBreakdown.B > priorityBreakdown.C) {
    return 'Session focuses on cards due for review to strengthen your retention.';
  }
  
  return 'Session includes new content to expand your knowledge base.';
}
