import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';
import { validateRequired, validateEnum } from '../../_shared/validation';
import { sendAdminFlagNotification } from '../../_shared/notifications';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env } = context;

  try {
    // Verify auth
    const authResult = await verifyAuthToken(request, env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    
    // Validation
    const requiredFields = ['userId', 'questionId', 'flagType', 'description'];
    const missing = validateRequired(body, requiredFields);
    if (missing.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Validation failed', 
        missing 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const allowedTypes = ['typo', 'incorrect_answer', 'unclear', 'outdated', 'other'];
    if (!validateEnum(body.flagType, allowedTypes)) {
      return new Response(JSON.stringify({ 
        error: 'Validation failed', 
        message: 'Invalid flagType' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { userId, userEmail, userFirstName, questionId, questionText, correctAnswer, 
            topic, system, flagType, description, priority } = body;

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database not configured' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const prisma = createEdgePrismaClient(env);

    // Create flag in database
    const flag = await prisma.questionFlag.create({
      data: {
        userId,
        userEmail: userEmail || null,
        userFirstName: userFirstName || null,
        questionId,
        questionText: questionText || '',
        correctAnswer: correctAnswer || null,
        topic: topic || null,
        system: system || null,
        flagType,
        description,
        priority: priority || 'medium',
      },
    });

    // Send notification to admin (if configured)
    // Note: env vars in Pages Functions are accessed via env object
    const adminEmail = env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendAdminFlagNotification(adminEmail, {
        id: flag.id,
        questionId,
        questionText: questionText || '',
        flagType,
        description,
        userEmail,
        userFirstName,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      flagId: flag.id,
      message: 'Question flagged successfully. We will review it soon!' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to flag question:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to flag question' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
