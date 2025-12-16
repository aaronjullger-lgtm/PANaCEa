import { createEdgePrismaClient } from '../../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../../_shared/auth';
import { validateRequired } from '../../../_shared/validation';
import { sendFlagResolvedNotification } from '../../../_shared/notifications';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env, params } = context;
  const { flagId } = params;

  try {
    // Verify auth
    const authResult = await verifyAuthToken(request, env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // TODO: Add admin check here if needed (RBAC)

    const body = await request.json();
    
    const requiredFields = ['reviewedBy', 'resolutionNote'];
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

    const { reviewedBy, resolutionNote } = body;

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

    // Update flag status
    const flag = await prisma.questionFlag.update({
      where: { id: flagId as string },
      data: {
        status: 'fixed',
        reviewedBy,
        reviewedAt: new Date(),
        resolutionNote,
      },
    });

    // Send notification to user
    if (flag.userEmail) {
      const notificationSent = await sendFlagResolvedNotification({
        userEmail: flag.userEmail,
        userFirstName: flag.userFirstName || undefined,
        questionId: flag.questionId,
        questionText: flag.questionText,
        flagType: flag.flagType,
        resolutionNote,
      });
      
      if (notificationSent) {
        await prisma.questionFlag.update({
          where: { id: flagId as string },
          data: {
            notificationSent: true,
            notifiedAt: new Date(),
          },
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Flag resolved and user notified' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to resolve flag:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to resolve flag' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
