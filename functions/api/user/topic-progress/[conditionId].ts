
import { authenticateRequest, createErrorResponse, type Env } from '../../_shared/auth';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { TASK_TYPES } from '../../../../lib/taskTypes';

export async function onRequestGet(context: { request: Request; env: Env; params: { conditionId: string } }) {
    const { request, env, params } = context;
    const { conditionId } = params;

    if (!conditionId) {
        return createErrorResponse('Condition ID required', 400);
    }

    const authContext = await authenticateRequest(request, env);
    if (!authContext) {
        return createErrorResponse('Unauthorized', 401);
    }

    if (!env.DATABASE_URL) {
        return createErrorResponse('Database not configured', 500);
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
        const user = await prisma.user.findUnique({
            where: { clerkId: authContext.userId },
            select: { id: true }
        });

        if (!user) return createErrorResponse("User not found", 404);
        const userId = user.id;

        // Fetch progress for this condition across all task types
        const progressRecords = await prisma.userTopicProgress.findMany({
            where: {
                userId,
                conditionId
            }
        });

        // Normalize data for frontend
        // Expected format: { 'diagnosis': 0.8, 'treatment': 0.5, ... } 
        // We can use 'stability' as a proxy for mastery? Or create a composite score.
        // Stability > 20 is "mastered" roughly. Max stability is 365.
        // Let's normalize stability to a 0-100% score for display.
        // Logarithmic scale might be better?
        // For now: map stability / 30, capped at 1.0

        const defaultTypes = Object.values(TASK_TYPES);
        const result: Record<string, any> = {};

        // Initialize defaults
        defaultTypes.forEach(type => {
            result[type] = {
                stability: 0,
                mastery: 0,
                state: 0, // New
                nextReview: null
            };
        });

        progressRecords.forEach(record => {
            const mastery = Math.min(record.stability / 21, 1); // 21 days stability = 100% mastery approximation
            result[record.taskType] = {
                stability: record.stability,
                mastery: parseFloat(mastery.toFixed(2)),
                state: record.state,
                nextReview: record.nextReviewDate
            };
        });

        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Topic Progress Error:', error);
        return createErrorResponse('Internal Server Error', 500);
    } finally {
        await prisma.$disconnect();
    }
}
