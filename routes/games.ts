/**
 * Games Routes
 * 
 * Handles all game-related API endpoints (wordle, grand rounds).
 * Extracted from server.ts for modularity.
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';
import { validateRequired } from '../lib/middleware/validation';
import { getDailyWordForUser, submitWordleGuess, WordleServiceError } from '../services/wordleService';
import crypto from 'crypto';

const router = Router();

// ============================================================================
// Medical Wordle
// ============================================================================

router.get('/wordle/daily', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const payload = await getDailyWordForUser(req.auth.userId);
        res.json(payload);
    } catch (error) {
        if (error instanceof WordleServiceError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error fetching Wordle daily word:', error);
        res.status(500).json({ error: 'Failed to load Wordle challenge' });
    }
});

router.post(
    '/wordle/guess',
    requireAuth,
    validateRequired(['guess']),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { guess } = req.body;
            const payload = await submitWordleGuess(req.auth.userId, guess);
            res.json(payload);
        } catch (error) {
            if (error instanceof WordleServiceError) {
                return res.status(400).json({ error: error.message });
            }
            console.error('Error submitting Wordle guess:', error);
            res.status(500).json({ error: 'Failed to submit Wordle guess' });
        }
    }
);

// ============================================================================
// Grand Rounds Daily Challenge
// ============================================================================

router.get('/grand-rounds/today', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!process.env.DATABASE_URL) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        const userId = req.auth.userId;

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { getOrCreateDailyChallenge, getUserAttemptForChallenge } = await import('../lib/services/grandRoundsService');

        const challenge = await getOrCreateDailyChallenge();
        const existingAttempt = await getUserAttemptForChallenge(user.id, challenge.id);

        if (existingAttempt) {
            const { calculatePercentile, getRankingForChallenge } = await import('../lib/services/grandRoundsService');

            const percentile = await calculatePercentile(challenge.id, existingAttempt.score);
            const ranking = await getRankingForChallenge(challenge.id, existingAttempt.score, existingAttempt.timeSpentMs);
            const totalQuestions = challenge.questionIds.length;
            const correctCount = Math.floor(existingAttempt.score / 20);

            return res.json({
                status: 'completed',
                stats: {
                    score: existingAttempt.score,
                    correctCount,
                    totalQuestions,
                    timeSpentMs: existingAttempt.timeSpentMs,
                    percentile,
                    ranking,
                },
            });
        }

        const questions = await prisma.question.findMany({
            where: {
                id: { in: challenge.questionIds },
            },
            select: {
                id: true,
                vignette: true,
                question: true,
                options: true,
                system: true,
                difficulty: true,
            },
        });

        return res.json({
            status: 'active',
            challengeId: challenge.id,
            questions,
        });
    } catch (error) {
        console.error('Error fetching Grand Rounds challenge:', error);
        res.status(500).json({ error: 'Failed to fetch challenge' });
    }
});

router.post(
    '/grand-rounds/submit',
    requireAuth,
    validateRequired(['challengeId', 'answers', 'timeSpentMs']),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!process.env.DATABASE_URL) {
                return res.status(503).json({ error: 'Database not configured' });
            }

            const userId = req.auth.userId;
            const { challengeId, answers, timeSpentMs } = req.body;

            if (typeof answers !== 'object' || Array.isArray(answers)) {
                return res.status(400).json({ error: 'Invalid answers format' });
            }

            const user = await prisma.user.findUnique({ where: { clerkId: userId } });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const { getUserAttemptForChallenge, calculatePercentile, getRankingForChallenge } = await import('../lib/services/grandRoundsService');

            const existingAttempt = await getUserAttemptForChallenge(user.id, challengeId);
            if (existingAttempt) {
                return res.status(400).json({ error: 'Challenge already completed' });
            }

            const challenge = await prisma.grandRoundsChallenge.findUnique({
                where: { id: challengeId },
            });

            if (!challenge) {
                return res.status(404).json({ error: 'Challenge not found' });
            }

            const questions = await prisma.question.findMany({
                where: {
                    id: { in: challenge.questionIds },
                },
                select: {
                    id: true,
                    correctAnswer: true,
                },
            });

            let correctCount = 0;
            const POINTS_PER_CORRECT = 20;

            for (const question of questions) {
                const userAnswer = answers[question.id];
                if (userAnswer === question.correctAnswer) {
                    correctCount++;
                }
            }

            const rawScore = correctCount * POINTS_PER_CORRECT;
            const timeInMinutes = timeSpentMs / 60000;
            const speedBonus = correctCount > 0 ? Math.max(0, Math.min(20, 20 - timeInMinutes)) : 0;
            const finalScore = Math.round(rawScore + speedBonus);

            await prisma.grandRoundsAttempt.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: user.id,
                    challengeId,
                    score: finalScore,
                    correctCount,
                    timeSpentMs,
                },
            });

            const percentile = await calculatePercentile(challengeId, finalScore);
            const ranking = await getRankingForChallenge(challengeId, finalScore, timeSpentMs);

            return res.json({
                success: true,
                score: finalScore,
                correctCount,
                totalQuestions: questions.length,
                speedBonus: Math.round(speedBonus),
                percentile,
                ranking,
            });
        } catch (error) {
            console.error('Error submitting Grand Rounds:', error);
            res.status(500).json({ error: 'Failed to submit challenge' });
        }
    }
);

export default router;
