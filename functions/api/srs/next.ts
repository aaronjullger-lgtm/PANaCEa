import { authenticateRequest, createErrorResponse, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { getTaskTypeFromContent } from '../../../lib/taskTypes';

export async function onRequestGet(context: { request: Request; env: Env }) {
    const { request, env } = context;

    // 1. Authentication
    const authContext = await authenticateRequest(request, env);
    if (!authContext) {
        return createErrorResponse('Unauthorized', 401);
    }

    if (!env.DATABASE_URL) {
        return createErrorResponse('Database not configured', 500);
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
        // Look up user by clerkId
        const user = await prisma.user.findUnique({
            where: { clerkId: authContext.userId },
            select: { id: true },
        });

        if (!user) {
            return createErrorResponse('User not found', 404);
        }

        const userId = user.id;
        const now = new Date();

        // 2. Priority 1: Check for "Second Chance" variants that are due
        // We look for UserTopicProgress records where nextReviewDate <= now
        const dueTopics = await prisma.userTopicProgress.findMany({
            where: {
                userId,
                nextReviewDate: {
                    lte: now
                },
                state: {
                    in: [1, 3] // Learning or Relearning states get priority
                }
            },
            orderBy: {
                nextReviewDate: 'asc'
            },
            take: 5
        });

        if (dueTopics.length > 0) {
            const topic = dueTopics[0];

            // Find a variant for this topic (condition + taskType)
            const availableVariants = await prisma.questionVariant.findMany({
                where: {
                    baseQuestionId: topic.conditionId, // Simplified assumption: baseQuestionId links to condition/question
                    taskType: topic.taskType,
                    NOT: {
                        usedByUsers: { has: userId }
                    }
                },
                take: 1
            });

            if (availableVariants.length > 0) {
                const variant = availableVariants[0];
                return new Response(JSON.stringify({
                    srsItemId: null, // No SRS item ID for these pure topic-based variants yet? Or we synthesize one?
                    // The frontend might need an ID to submit back.
                    // We can pass `topicProgressId` instead?
                    topicProgressId: topic.id,

                    question: variant,
                    isVariant: true,
                    taskType: topic.taskType
                }), { headers: { 'Content-Type': 'application/json' } });
            }
        }

        // 3. Fallback to standard SRSItem query
        const items = await prisma.sRSItem.findMany({
            where: {
                userId,
                dueDate: {
                    lte: now,
                },
            },
            orderBy: {
                dueDate: 'asc', // Overdue first
            },
            take: 1,
        });

        if (items.length === 0) {
            return new Response(JSON.stringify({ message: "No items due" }), { status: 200 });
        }

        const item = items[0];
        let questionContent: any = null;
        let isVariant = false;

        // Check for variants if in relearning/learning
        if (item.fsrsState === 3 || item.fsrsState === 1) {
            const variants = await prisma.questionVariant.findMany({
                where: {
                    baseQuestionId: item.questionId,
                    NOT: {
                        usedByUsers: { has: userId }
                    }
                },
                take: 1
            });

            if (variants.length > 0) {
                questionContent = variants[0];
                isVariant = true;
            }
        }

        if (!questionContent) {
            questionContent = await prisma.question.findUnique({
                where: { id: item.questionId }
            });
        }

        if (!questionContent) {
            return createErrorResponse("Question not found", 404);
        }

        return new Response(JSON.stringify({
            srsItemId: item.id,
            question: questionContent,
            isVariant,
            taskType: questionContent.taskType || getTaskTypeFromContent(questionContent.question)
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('SRS Next Error:', error);
        return createErrorResponse('Internal Server Error', 500);
    } finally {
        await prisma.$disconnect();
    }
};
