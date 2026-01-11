import { createEdgePrismaClient } from '../../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../../_shared/auth';
import { validateRequired } from '../../../_shared/validation';
import { sendFlagResolvedNotification } from '../../../_shared/notifications';
import { CloudflareContext } from '../../../_shared/types';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context: CloudflareContext) => {

  const { request, env, params } = context;
  const { flagId } = params;
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    // Verify auth
    const clerkId = await verifyAuthToken(request, env);
    if (!clerkId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ 
        error: 'Database not configured' 
      }), {
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Admin check: Verify user has admin role
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, role: true },
    });

    if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const body = await request.json();
    
    const requiredFields = ['reviewedBy', 'resolutionNote'];
    const missing = validateRequired(body, requiredFields);
    if (missing.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Validation failed', 
        missing 
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const { reviewedBy, resolutionNote } = body;

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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Failed to resolve flag:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to resolve flag' 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
};
