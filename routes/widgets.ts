/**
 * Widget Serving Routes
 *
 * Serves HTML widgets for simple embedding (Obsidian, Notion, etc).
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Serve streak widget HTML directly
router.get('/streak/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { theme = 'light' } = req.query;

    if (!process.env.DATABASE_URL) {
      return res.status(503).send('<html><body><p>Database not configured</p></body></html>');
    }

    const { prisma } = await import('../../lib/prisma');
    const { generateStreakWidgetHTML, calculateStreak } =
      await import('../../lib/services/widgetService');

    // Get user's performance data
    const performanceRecords = await prisma.performanceRecord.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 1000, // Last 1000 records for streak calculation
    });

    // Map Prisma records to the expected PerformanceRecord type
    const mappedRecords = performanceRecords.map((r) => ({
      ...r,
      timestamp: Number(r.timestamp),
      system: r.system as any,
      subcategory: r.subcategoryName,
      condition: r.conditionName || 'Unknown',
      conditionId: 'unknown',
      topic: r.topic,
      focus: r.focus as any,
      difficulty: r.difficulty as any,
      errorTag: r.errorTag as any,
    }));

    const streakData = calculateStreak(mappedRecords);
    const html = generateStreakWidgetHTML(streakData, theme as 'light' | 'dark');

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.send(html);
  } catch (error) {
    console.error('Failed to serve streak widget:', error);
    res.status(500).send('<html><body><p>Error loading widget</p></body></html>');
  }
});

// Serve question of the day widget HTML
router.get('/question-of-day/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { theme = 'light' } = req.query;

    if (!process.env.DATABASE_URL) {
      return res.status(503).send('<html><body><p>Database not configured</p></body></html>');
    }

    const { prisma } = await import('../../lib/prisma');
    const { generateQuestionOfDayHTML, getQuestionOfDay } =
      await import('../../lib/services/widgetService');

    // Get user's missed questions
    const savedQuestions = await prisma.savedQuestion.findMany({
      where: {
        userId,
        type: 'missed',
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Pool of recent missed questions
    });

    // Convert to Question format
    // NOTE: This is a simplified version. In production, store full question data
    const questions = savedQuestions.map((sq) => {
      // Parse correctAnswer to handle different formats
      let answerLetter = sq.correctAnswer;
      // If it's a number, convert to letter (0=A, 1=B, etc.)
      if (!isNaN(parseInt(sq.correctAnswer))) {
        const answerIndex = parseInt(sq.correctAnswer);
        answerLetter = String.fromCharCode(65 + answerIndex);
      }

      return {
        id: sq.questionId,
        question: sq.questionText,
        options: [`Option ${answerLetter} (Correct)`, 'Option B', 'Option C', 'Option D'],
        correctAnswer: answerLetter,
        explanation: sq.explanation,
        system: (sq.system as any) || undefined,
        subcategory: sq.topic,
        correctAnswerIndex: 0,
        rationale: sq.explanation,
        topic: sq.topic,
        conditionId: 'unknown',
        condition: 'Unknown',
        pearls: [],
      };
    });

    const questionOfDay = getQuestionOfDay(questions);

    if (!questionOfDay) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>No Questions</title></head>
        <body style="font-family: sans-serif; padding: 20px; text-align: center;">
          <p>Complete some questions to see your Question of the Day!</p>
        </body>
        </html>
      `);
    }

    const html = generateQuestionOfDayHTML(questionOfDay, theme as 'light' | 'dark');

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours (daily question)
    res.send(html);
  } catch (error) {
    console.error('Failed to serve question of day widget:', error);
    res.status(500).send('<html><body><p>Error loading widget</p></body></html>');
  }
});

// Serve stats summary widget HTML
router.get('/stats/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { theme = 'light' } = req.query;

    if (!process.env.DATABASE_URL) {
      return res.status(503).send('<html><body><p>Database not configured</p></body></html>');
    }

    const { prisma } = await import('../../lib/prisma');

    // Get user statistics
    const performanceRecords = await prisma.performanceRecord.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    });

    const totalQuestions = performanceRecords.length;
    const correctAnswers = performanceRecords.filter((r) => r.isCorrect).length;
    const accuracy =
      totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(1) : '0.0';

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#f9fafb' : '#111827';
    const accentColor = isDark ? '#60a5fa' : '#3b82f6';
    const secondaryColor = isDark ? '#9ca3af' : '#6b7280';
    const borderColor = isDark ? '#374151' : '#e5e7eb';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      padding: 16px;
    }
    .widget {
      background: ${bgColor};
      border: 2px solid ${borderColor};
      border-radius: 12px;
      padding: 20px;
      max-width: 400px;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: ${textColor};
      margin-bottom: 16px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: ${accentColor};
    }
    .stat-label {
      font-size: 12px;
      color: ${secondaryColor};
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="widget">
    <div class="title">📊 Study Stats</div>
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-value">${totalQuestions}</div>
        <div class="stat-label">Questions</div>
      </div>
      <div class="stat">
        <div class="stat-value">${accuracy}%</div>
        <div class="stat-label">Accuracy</div>
      </div>
      <div class="stat">
        <div class="stat-value">${performanceRecords.length}</div>
        <div class="stat-label">Session</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(html);
  } catch (error) {
    console.error('Failed to serve stats widget:', error);
    res.status(500).send('<html><body><p>Error loading widget</p></body></html>');
  }
});

export default router;
