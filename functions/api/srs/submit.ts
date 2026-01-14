
import { authenticateRequest, createErrorResponse, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { FSRS, Rating, createReviewSnapshot, topicProgressToCard, FSRSState, FSRSCard } from '../../../lib/fsrs';
import { VariantQueueService } from '../../../services/variantQueueService';
import { getTaskTypeFromContent } from '../../../lib/taskTypes';

export async function onRequestPost(context: { request: Request; env: Env }) {
    const { request, env } = context;

    const authContext = await authenticateRequest(request, env);
    if (!authContext) {
        return createErrorResponse('Unauthorized', 401);
    }

    if (!env.DATABASE_URL) {
        return createErrorResponse('Database not configured', 500);
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
        const body: any = await request.json();
        const { srsItemId, topicProgressId, questionId, rating, isCorrect, userAnswer, timeSpent } = body;
        // rating: 1=Again, 2=Hard, 3=Good, 4=Easy

        const userId = authContext.userId; // wait, authContext.userId is clerkId. We need DB ID.

        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { id: true }
        });

        if (!user) return createErrorResponse("User not found", 404);
        const dbUserId = user.id;

        let nextReviewDate: Date;
        let reviewState: any; // FSRSCard

        const fsrs = new FSRS();
        const now = new Date();

        // Handle Topic Progress Update
        // We need to know the conditionId and taskType.
        // If srsItemId provided, fetch question to get those.
        // If topicProgressId provided, fetch that directly.

        let conditionId = null;
        let taskType = null;
        let topicProgress = null;

        if (topicProgressId) {
            topicProgress = await prisma.userTopicProgress.findUnique({
                where: { id: topicProgressId }
            });
            if (topicProgress) {
                conditionId = topicProgress.conditionId;
                taskType = topicProgress.taskType;
            }
        } else if (questionId) {
            const question = await prisma.question.findUnique({ where: { id: questionId } });
            if (question) {
                conditionId = question.conditionId; // Assumes deep relation or manual link
                taskType = question.taskType || getTaskTypeFromContent(question.question);
                // Try to find existing topic progress
                if (conditionId && taskType) {
                    topicProgress = await prisma.userTopicProgress.findUnique({
                        where: {
                            userId_conditionId_taskType: {
                                userId: dbUserId,
                                conditionId: conditionId,
                                taskType: taskType
                            }
                        }
                    });
                }
            }
        }

        // Update UserTopicProgress (Primary driver for Variants)
        if (topicProgress) {
            const card = topicProgressToCard(topicProgress);
            const scheduled = fsrs.next(card, now, rating);
            reviewState = scheduled.card;
            nextReviewDate = scheduled.due;

            await prisma.userTopicProgress.update({
                where: { id: topicProgress.id },
                data: {
                    stability: reviewState.stability,
                    difficulty: reviewState.difficulty,
                    state: reviewState.state,
                    reps: reviewState.reps,
                    lapses: reviewState.lapses,
                    lastReviewDate: now,
                    nextReviewDate: nextReviewDate
                }
            });
        } else if (conditionId && taskType) {
            // Create new Topic Progress
            const emptyCard = fsrs.createEmptyCard();
            const scheduled = fsrs.next(emptyCard, now, rating);
            reviewState = scheduled.card;
            nextReviewDate = scheduled.due;

            await prisma.userTopicProgress.create({
                data: {
                    userId: dbUserId,
                    conditionId: conditionId,
                    taskType: taskType,
                    stability: reviewState.stability,
                    difficulty: reviewState.difficulty,
                    state: reviewState.state,
                    reps: reviewState.reps,
                    lapses: reviewState.lapses,
                    lastReviewDate: now,
                    nextReviewDate: nextReviewDate
                }
            });
        }

        // Update SRSItem (Legacy/Specific Question tracking)
        if (srsItemId) {
            const item = await prisma.sRSItem.findUnique({ where: { id: srsItemId } });
            if (item) {
                // We could also apply FSRS here specifically for this card.
                // For now, let's keep it simple and just update basic stats or sync with topic?
                // Let's perform FSRS on the item too, keeping granular and topic separated.
                const card: FSRSCard = {
                    stability: item.fsrsStability || 0,
                    difficulty: item.fsrsDifficulty || 0,
                    state: (item.fsrsState as FSRSState) || FSRSState.New,
                    reps: item.repetition,
                    lapses: 0, // Need to track lapses in SRSItem if we want full fidelity
                    last_review: item.lastReviewed,
                    elapsed_days: (now.getTime() - item.lastReviewed.getTime()) / 86400000,
                    scheduled_days: 0 // calc
                };

                const scheduled = fsrs.next(card, now, rating);
                // Update item
                await prisma.sRSItem.update({
                    where: { id: srsItemId },
                    data: {
                        lastReviewed: now,
                        dueDate: scheduled.due,
                        repetition: scheduled.card.reps,
                        fsrsStability: scheduled.card.stability,
                        fsrsDifficulty: scheduled.card.difficulty,
                        fsrsState: scheduled.card.state
                    }
                });
            }
        }

        // VARIANT LOGIC
        let queuedVariantId = null;
        if (!isCorrect && conditionId && taskType) {
            // Trigger Queue Service with edge-compatible prisma instance
            const queueService = new VariantQueueService(prisma as any);
            queuedVariantId = await queueService.queueVariantForReview(dbUserId, questionId, taskType);
        }

        // If we served a variant, mark it as used
        // Check request body for "isVariant" flag or try to deduce?
        // Better: pass `variantId` in body if it was a variant.
        if (body.variantId && questionId) { // questionId in body IS the variant ID if isVariant=true? 
            // Frontend should clarify. 
            // Let's assume if `variantId` is present, it was a variant.
            await prisma.questionVariant.update({
                where: { id: body.variantId },
                data: {
                    usedByUsers: { push: dbUserId }
                }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            nextReviewDate,
            queuedVariantId
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Submit Error:', error);
        return createErrorResponse('Internal Server Error', 500);
    } finally {
        await prisma.$disconnect();
    }
}
