
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
            // Trigger Queue Service
            const queueService = new VariantQueueService();
            // We can't use the service class directly with Edge Prisma Client easily if it imports standard Prisma Client.
            // The service uses `import { PrismaClient } from '@prisma/client'`. This might break in Edge.
            // To be safe, I should implement the logic inline here or extract a pure logic helper.

            // INLINE LOGIC FOR EDGE COMPATIBILITY:

            // 1. Check existing
            const existingVariants = await prisma.questionVariant.findMany({
                where: {
                    baseQuestionId: questionId, // or conditionId linked? Use questionId for direct variants
                    taskType: taskType,
                    NOT: {
                        usedByUsers: {
                            has: dbUserId
                        }
                    }
                }
            });

            if (existingVariants.length > 0) {
                queuedVariantId = existingVariants[0].id;
            } else {
                // GENERATION IS SLOW. 
                // We should probably trigger this asynchronously or return "generating" status.
                // Cloudflare Pages Functions execution time limit?

                // For MVP, attempting generation here.
                // But `questionVariantGenerator` uses GoogleGenerativeAI which checks headers/fetch. Should work in workers.

                // Need original question content
                const originalQ = await prisma.question.findUnique({ where: { id: questionId } });
                if (originalQ) {
                    const { generateVariant } = await import('../../../lib/questionVariantGenerator'); // Dynamic import?

                    let options: string[] = [];
                    if (typeof originalQ.options === 'string') {
                        options = JSON.parse(originalQ.options);
                    } else if (Array.isArray(originalQ.options)) {
                        options = originalQ.options as string[];
                    }

                    let targetType: any = 'remediation';

                    // Phase 3: Decomposition Logic
                    // If it's a complex task (Treatment/Management) and user failed, try to decompose.
                    if (taskType === 'treatment' || taskType === 'management' || taskType === 'workup') {
                        // We could refine this with a probability or streak check, but for now, prioritize decomposition for these types on failure
                        // 50/50 chance between targeted remediation (why X is wrong) vs decomposition (checking diagnosis)
                        if (Math.random() > 0.5) {
                            targetType = 'decomposition';
                        }
                    }

                    const newVariantData = await generateVariant({
                        originalQuestion: originalQ.question,
                        originalOptions: options,
                        originalAnswer: originalQ.correctAnswer,
                        originalExplanation: originalQ.explanation,
                        targetType: targetType,
                        userIncorrectAnswer: userAnswer
                    });

                    if (newVariantData) {
                        const saved = await prisma.questionVariant.create({
                            data: {
                                baseQuestionId: questionId,
                                variantType: newVariantData.variantType,
                                question: newVariantData.question,
                                options: newVariantData.options,
                                correctAnswer: newVariantData.correctAnswer,
                                explanation: newVariantData.explanation,
                                taskType: taskType,
                                difficulty: originalQ.difficulty,
                                // Note: usedByUsers is empty initially
                            }
                        });
                        queuedVariantId = saved.id;
                    }
                }
            }
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
