/**
 * Backend server for PANaCEa
 * Runs on port 3001 to serve API endpoints and proxy Gemini requests
 * 
 * PRODUCTION CONSIDERATIONS:
 * - Replace in-memory rate limiting with Redis for distributed deployments
 * - Use a dedicated sanitization library (DOMPurify, validator.js) for production
 * - Enable production logging and monitoring (Winston, Datadog, etc.)
 * - Implement proper database connection pooling
 * - Add request ID tracking for debugging
 * - Consider adding helmet.js for additional security headers
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { sanitizeBody, validateRequired, validateEnum } from './lib/middleware/validation';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(sanitizeBody); // Sanitize all request bodies

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Gemini proxy endpoint
app.post('/geminiProxy', async (req: Request, res: Response) => {
  try {
    // Security: Only use server-side environment variables
    // Never use VITE_ prefixed keys on the server - they're exposed to the client
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Missing API Key configuration on Server' 
      });
    }

    const { modelName = 'gemini-1.5-flash', prompt, temperature = 0.8 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: temperature },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`Gemini API Error (${geminiResponse.status}):`, errorText);
      return res.status(geminiResponse.status).json({ 
        error: 'Gemini Upstream Error', 
        details: errorText 
      });
    }

    const geminiData: any = await geminiResponse.json();
    
    let rawText = '';
    if (geminiData.candidates && geminiData.candidates[0]?.content?.parts?.[0]?.text) {
      rawText = geminiData.candidates[0].content.parts[0].text;
    }

    // Strip code fences if present
    let text = rawText.trim();
    if (text.startsWith('```')) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1) {
        text = text.slice(firstNewline + 1);
      }
      if (text.endsWith('```')) {
        text = text.slice(0, -3);
      }
      text = text.trim();
    }

    res.json({ text });

  } catch (error: any) {
    console.error('Critical Error in geminiProxy:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
});

// Rate limiting data structure
// NOTE: This in-memory implementation is suitable for development and single-instance deployments
// For production with multiple instances or load balancers, use Redis or a distributed solution
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // In production, use a more reliable client identifier
    // Consider using req.headers['x-forwarded-for'] with load balancers
    const clientId = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientData = rateLimitMap.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      rateLimitMap.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
    }
    
    clientData.count++;
    next();
  };
}

// Apply rate limiting to API endpoints (100 requests per 15 minutes)
app.use('/api', rateLimit(100, 15 * 60 * 1000));

// API sync endpoint (placeholder - should integrate with Prisma)
app.get('/api/sync', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      performanceRecords: [],
      srsItems: [],
      savedQuestions: []
    }
  });
});

app.post('/api/sync', (req: Request, res: Response) => {
  // In production, this would sync data to database
  console.log('Sync request received:', {
    performanceRecords: req.body.performanceRecords?.length || 0,
    srsItems: req.body.srsItems?.length || 0,
    savedQuestions: req.body.savedQuestions?.length || 0
  });
  
  res.json({
    success: true,
    message: 'Data synced successfully'
  });
});

// Analytics endpoints with validation and database persistence
app.post('/api/analytics/reactions',
  validateRequired(['questionId', 'reaction']),
  validateEnum('reaction', ['helpful', 'not_helpful']),
  async (req: Request, res: Response) => {
    try {
      const { questionId, reaction, userId } = req.body;
      
      // Store user feedback on explanation helpfulness
      // Note: In production, extract userId from authenticated session
      
      // Store in database if DATABASE_URL is configured
      if (process.env.DATABASE_URL) {
        const { prisma } = await import('./lib/prisma');
        await prisma.explanationReaction.create({
          data: {
            questionId,
            reaction,
            userId: userId || null,
          },
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to store reaction:', error);
      res.status(500).json({ success: false, error: 'Failed to store reaction' });
    }
  }
);

app.post('/api/analytics/weakness',
  validateRequired(['conditionId', 'wasCorrect']),
  async (req: Request, res: Response) => {
    try {
      const { conditionId, wasCorrect, userId } = req.body;
      
      // Track user weakness patterns for adaptive learning
      
      // Store in database if DATABASE_URL is configured
      if (process.env.DATABASE_URL && userId) {
        const { prisma } = await import('./lib/prisma');
        await prisma.weaknessPattern.create({
          data: {
            userId,
            conditionId,
            wasCorrect,
          },
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to store weakness pattern:', error);
      res.status(500).json({ success: false, error: 'Failed to store weakness pattern' });
    }
  }
);

app.post('/api/analytics/confusion',
  validateRequired(['correctCondition', 'selectedCondition']),
  async (req: Request, res: Response) => {
    try {
      const { correctCondition, selectedCondition, userId } = req.body;
      
      // Track diagnostic confusion patterns
      
      // Store in database if DATABASE_URL is configured
      if (process.env.DATABASE_URL) {
        const { prisma } = await import('./lib/prisma');
        // Update or create confusion pair
        const existingPair = await prisma.confusionPair.findUnique({
          where: {
            userId_realCondition_mistakenFor: {
              userId: userId || null,
              realCondition: correctCondition,
              mistakenFor: selectedCondition,
            },
          },
        });
        
        if (existingPair) {
          await prisma.confusionPair.update({
            where: { id: existingPair.id },
            data: {
              count: { increment: 1 },
              lastOccurrence: new Date(),
            },
          });
        } else {
          await prisma.confusionPair.create({
            data: {
              userId: userId || null,
              realCondition: correctCondition,
              mistakenFor: selectedCondition,
              count: 1,
            },
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to store confusion pattern:', error);
      res.status(500).json({ success: false, error: 'Failed to store confusion pattern' });
    }
  }
);

// Question flagging endpoints (Task 42: Feedback Loop Closure)
app.post('/api/questions/flag',
  validateRequired(['userId', 'questionId', 'flagType', 'description']),
  validateEnum('flagType', ['typo', 'incorrect_answer', 'unclear', 'outdated', 'other']),
  async (req: Request, res: Response) => {
    try {
      const { userId, userEmail, userFirstName, questionId, questionText, correctAnswer, 
              topic, system, flagType, description, priority } = req.body;
      
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ 
          success: false, 
          error: 'Database not configured' 
        });
      }
      
      const { prisma } = await import('./lib/prisma');
      const { sendAdminFlagNotification } = await import('./lib/services/notificationService');
      
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
      const adminEmail = process.env.ADMIN_EMAIL;
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
      
      res.json({ 
        success: true, 
        flagId: flag.id,
        message: 'Question flagged successfully. We will review it soon!' 
      });
    } catch (error) {
      console.error('Failed to flag question:', error);
      res.status(500).json({ success: false, error: 'Failed to flag question' });
    }
  }
);

// Mark a flag as resolved and send notification to user
app.post('/api/questions/flag/:flagId/resolve',
  validateRequired(['reviewedBy', 'resolutionNote']),
  async (req: Request, res: Response) => {
    try {
      const { flagId } = req.params;
      const { reviewedBy, resolutionNote } = req.body;
      
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ 
          success: false, 
          error: 'Database not configured' 
        });
      }
      
      const { prisma } = await import('./lib/prisma');
      const { sendFlagResolvedNotification } = await import('./lib/services/notificationService');
      
      // Update flag status
      const flag = await prisma.questionFlag.update({
        where: { id: flagId },
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
            where: { id: flagId },
            data: {
              notificationSent: true,
              notifiedAt: new Date(),
            },
          });
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Flag resolved and user notified' 
      });
    } catch (error) {
      console.error('Failed to resolve flag:', error);
      res.status(500).json({ success: false, error: 'Failed to resolve flag' });
    }
  }
);

// Get all question flags (admin endpoint)
app.get('/api/questions/flags', async (req: Request, res: Response) => {
  try {
    const { status, priority } = req.query;
    
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, flags: [] });
    }
    
    const { prisma } = await import('./lib/prisma');
    
    const flags = await prisma.questionFlag.findMany({
      where: {
        ...(status && { status: status as string }),
        ...(priority && { priority: priority as string }),
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    res.json({ success: true, flags });
  } catch (error) {
    console.error('Failed to get flags:', error);
    res.status(500).json({ success: false, error: 'Failed to get flags' });
  }
});

// Semantic cache endpoint (Task 43)
app.post('/api/questions/generate',
  validateRequired(['queryText', 'questionType']),
  async (req: Request, res: Response) => {
    try {
      const { queryText, questionType, system, difficulty } = req.body;
      
      const { findSimilarCachedQuestion, cacheGeneratedQuestion } = 
        await import('./lib/services/semanticCacheService');
      
      // Check cache first
      const cached = await findSimilarCachedQuestion({
        queryText,
        questionType,
        system,
        difficulty,
      });
      
      if (cached) {
        return res.json({
          success: true,
          question: cached.question,
          cached: true,
          similarity: cached.similarity,
        });
      }
      
      // Generate new question using AI question generation service
      let newQuestion = null;
      
      try {
        // Try to load condition data and generate question
        const { loadConditionData } = await import('./services/conditionDataLoader');
        const { generateSingleQuestion } = await import('./lib/questionGenerator');
        
        // Load condition data based on query text
        const conditionData = await loadConditionData(queryText);
        
        if (conditionData) {
          // Transform loaded data to match ConditionData interface
          const transformedCondition = {
            condition: conditionData.name,
            sections: {
              overview: conditionData.content.overview || '',
              etiology: conditionData.content.etiologyPathophysiology || '',
              clinicalPresentation: conditionData.content.clinicalPresentation || '',
              diagnostics: conditionData.content.diagnostics?.notes || '',
              treatment: (conditionData.content.treatment || conditionData.content.management || []).join('\n'),
            }
          };
          
          // Generate question using AI
          const generatedQ = await generateSingleQuestion(
            transformedCondition,
            questionType as any
          );
          
          if (generatedQ) {
            newQuestion = {
              ...generatedQ,
              system: system || conditionData.system,
              difficulty: difficulty || 'medium',
              generatedAt: new Date().toISOString(),
              metadata: {
                originalQuery: queryText,
                cached: false,
              }
            };
          }
        }
      } catch (generationError) {
        console.error('Failed to generate question with AI:', generationError);
      }
      
      // Fallback to placeholder if generation failed
      if (!newQuestion) {
        newQuestion = {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: questionType,
          system: system || null,
          difficulty: difficulty || 'medium',
          text: `Unable to generate question for: ${queryText}. Please try a different condition or query.`,
          options: questionType === 'mcq' ? ['Option A', 'Option B', 'Option C', 'Option D'] : undefined,
          correctAnswer: questionType === 'mcq' ? 'Option A' : undefined,
          explanation: 'Question generation failed. This is a placeholder response.',
          generatedAt: new Date().toISOString(),
          metadata: {
            originalQuery: queryText,
            cached: false,
            generationFailed: true,
          }
        };
      }
      
      // Cache the generated question
      await cacheGeneratedQuestion({
        queryText,
        questionType,
        system,
        difficulty,
      }, newQuestion);
      
      res.json({
        success: true,
        question: newQuestion,
        cached: false,
      });
    } catch (error) {
      console.error('Failed to generate question:', error);
      res.status(500).json({ success: false, error: 'Failed to generate question' });
    }
  }
);

// Content branching endpoints (Task 46)
app.post('/api/branches',
  validateRequired(['name', 'createdBy']),
  async (req: Request, res: Response) => {
    try {
      const { name, description, baseBranch, createdBy } = req.body;
      
      const { createBranch } = await import('./lib/services/contentBranchingService');
      
      const branchId = await createBranch({
        name,
        description,
        baseBranch,
        createdBy,
      });
      
      res.json({ success: true, branchId });
    } catch (error: any) {
      console.error('Failed to create branch:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

app.get('/api/branches', async (req: Request, res: Response) => {
  try {
    const { includeArchived } = req.query;
    
    const { listBranches } = await import('./lib/services/contentBranchingService');
    
    const branches = await listBranches(includeArchived === 'true');
    
    res.json({ success: true, branches });
  } catch (error) {
    console.error('Failed to list branches:', error);
    res.status(500).json({ success: false, error: 'Failed to list branches' });
  }
});

app.post('/api/branches/:branchName/merge',
  validateRequired(['mergedBy']),
  async (req: Request, res: Response) => {
    try {
      const { branchName } = req.params;
      const { mergedBy, targetBranch } = req.body;
      
      const { mergeBranch } = await import('./lib/services/contentBranchingService');
      
      const result = await mergeBranch(branchName, mergedBy, targetBranch);
      
      res.json({ success: result.success, ...result });
    } catch (error: any) {
      console.error('Failed to merge branch:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Hybrid Content Engine API Endpoints (Tasks 108-112)

// Task 108: Staging Lake Architecture - Save question to staging
app.post('/api/questions/staging',
  validateRequired(['questionData']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { saveToStaging } = await import('./services/stagingQuestionService');
      const question = await saveToStaging(req.body.questionData);

      res.json({ success: true, stagingQuestion: question });
    } catch (error) {
      console.error('Failed to save to staging:', error);
      res.status(500).json({ success: false, error: 'Failed to save to staging' });
    }
  }
);

// Task 108: Run adequacy check on staging question
app.post('/api/questions/staging/:id/check',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { runAdequacyCheck } = await import('./services/stagingQuestionService');
      const result = await runAdequacyCheck(req.params.id);

      res.json({ success: true, adequacyCheck: result });
    } catch (error) {
      console.error('Failed to run adequacy check:', error);
      res.status(500).json({ success: false, error: 'Failed to run adequacy check' });
    }
  }
);

// Task 108: Process staging queue (batch processing)
app.post('/api/questions/staging/process',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { processStagingQueue } = await import('./services/stagingQuestionService');
      const { limit = 10 } = req.body;
      const results = await processStagingQueue(limit);

      res.json({ success: true, results });
    } catch (error) {
      console.error('Failed to process staging queue:', error);
      res.status(500).json({ success: false, error: 'Failed to process staging queue' });
    }
  }
);

// Task 108: Get staging statistics
app.get('/api/questions/staging/stats',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ success: true, stats: {} });
      }

      const { getStagingStats } = await import('./services/stagingQuestionService');
      const stats = await getStagingStats();

      res.json({ success: true, stats });
    } catch (error) {
      console.error('Failed to get staging stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get staging stats' });
    }
  }
);

// Task 109: Get questions with no-repeat logic
app.post('/api/questions/no-repeat',
  validateRequired(['userId', 'filter']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { getQuestionsWithNoRepeat } = await import('./services/noRepeatService');
      const { userId, filter, limit = 10 } = req.body;
      const result = await getQuestionsWithNoRepeat(userId, filter, limit);

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Failed to get questions:', error);
      res.status(500).json({ success: false, error: 'Failed to get questions' });
    }
  }
);

// Task 109: Record question seen
app.post('/api/questions/history',
  validateRequired(['userId', 'questionId', 'metadata']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { recordQuestionSeen } = await import('./services/noRepeatService');
      const { userId, questionId, metadata } = req.body;
      await recordQuestionSeen(userId, questionId, metadata);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to record question history:', error);
      res.status(500).json({ success: false, error: 'Failed to record question history' });
    }
  }
);

// Task 109: Get golden repository statistics
app.get('/api/questions/repository/stats',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ success: true, stats: { totalQuestions: 0 } });
      }

      const { getRepositoryStats } = await import('./services/noRepeatService');
      const stats = await getRepositoryStats();

      res.json({ success: true, stats });
    } catch (error) {
      console.error('Failed to get repository stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get repository stats' });
    }
  }
);

// Task 111: Create question seed
app.post('/api/questions/seeds',
  validateRequired(['seedData']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { createQuestionSeed } = await import('./services/questionSeedService');
      const seed = await createQuestionSeed(req.body.seedData);

      res.json({ success: true, seed });
    } catch (error) {
      console.error('Failed to create question seed:', error);
      res.status(500).json({ success: false, error: 'Failed to create question seed' });
    }
  }
);

// Task 111: Assemble question from seed
app.get('/api/questions/seeds/:id/assemble',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { assembleQuestionFromSeed } = await import('./services/questionSeedService');
      const question = await assembleQuestionFromSeed(req.params.id);

      res.json({ success: true, question });
    } catch (error) {
      console.error('Failed to assemble question:', error);
      res.status(500).json({ success: false, error: 'Failed to assemble question' });
    }
  }
);

// Task 111: Assemble multiple questions from seeds with filter
app.post('/api/questions/seeds/assemble',
  validateRequired(['filter', 'count']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { assembleQuestionsFromSeeds } = await import('./services/questionSeedService');
      const { filter, count } = req.body;
      const questions = await assembleQuestionsFromSeeds(filter, count);

      res.json({ success: true, questions });
    } catch (error) {
      console.error('Failed to assemble questions:', error);
      res.status(500).json({ success: false, error: 'Failed to assemble questions' });
    }
  }
);

// Task 111: Get seed statistics
app.get('/api/questions/seeds/stats',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ success: true, stats: {} });
      }

      const { getSeedStats } = await import('./services/questionSeedService');
      const stats = await getSeedStats();

      res.json({ success: true, stats });
    } catch (error) {
      console.error('Failed to get seed stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get seed stats' });
    }
  }
);

// Task 112: Extract clinical pearl from explanation
app.post('/api/pearls/extract',
  validateRequired(['questionId', 'explanation']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { createClinicalPearl } = await import('./services/clinicalPearlService');
      const { questionId, explanation, metadata } = req.body;
      const pearl = await createClinicalPearl(questionId, explanation, metadata);

      res.json({ success: true, pearl });
    } catch (error) {
      console.error('Failed to extract pearl:', error);
      res.status(500).json({ success: false, error: 'Failed to extract pearl' });
    }
  }
);

// Task 112: Get daily pearl
app.get('/api/pearls/daily',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ success: true, pearl: null });
      }

      const { getDailyPearl } = await import('./services/clinicalPearlService');
      const { userId } = req.query;
      const pearl = await getDailyPearl(userId as string);

      res.json({ success: true, pearl });
    } catch (error) {
      console.error('Failed to get daily pearl:', error);
      res.status(500).json({ success: false, error: 'Failed to get daily pearl' });
    }
  }
);

// Task 112: Get user's pearls (Review My Pearls)
app.get('/api/pearls/user/:userId',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ success: true, pearls: [] });
      }

      const { getUserPearls } = await import('./services/clinicalPearlService');
      const { userId } = req.params;
      const { limit = 20 } = req.query;
      const pearls = await getUserPearls(userId, Number(limit));

      res.json({ success: true, pearls });
    } catch (error) {
      console.error('Failed to get user pearls:', error);
      res.status(500).json({ success: false, error: 'Failed to get user pearls' });
    }
  }
);

// Task 112: Get user's favorite pearls
app.get('/api/pearls/user/:userId/favorites',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ success: true, pearls: [] });
      }

      const { getUserFavoritePearls } = await import('./services/clinicalPearlService');
      const { userId } = req.params;
      const pearls = await getUserFavoritePearls(userId);

      res.json({ success: true, pearls });
    } catch (error) {
      console.error('Failed to get favorite pearls:', error);
      res.status(500).json({ success: false, error: 'Failed to get favorite pearls' });
    }
  }
);

// Task 112: Mark pearl as useful
app.post('/api/pearls/:pearlId/useful',
  validateRequired(['userId']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { markPearlUseful } = await import('./services/clinicalPearlService');
      const { pearlId } = req.params;
      const { userId, notes } = req.body;
      await markPearlUseful(userId, pearlId, notes);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark pearl as useful:', error);
      res.status(500).json({ success: false, error: 'Failed to mark pearl as useful' });
    }
  }
);

// Task 112: Search pearls
app.post('/api/pearls/search',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ success: true, pearls: [] });
      }

      const { searchPearls } = await import('./services/clinicalPearlService');
      const pearls = await searchPearls(req.body);

      res.json({ success: true, pearls });
    } catch (error) {
      console.error('Failed to search pearls:', error);
      res.status(500).json({ success: false, error: 'Failed to search pearls' });
    }
  }
);

// Task 112: Get pearl statistics
app.get('/api/pearls/stats',
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ success: true, stats: {} });
      }

      const { getPearlStats } = await import('./services/clinicalPearlService');
      const stats = await getPearlStats();

      res.json({ success: true, stats });
    } catch (error) {
      console.error('Failed to get pearl stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get pearl stats' });
    }
  }
);

// ============================================================================
// Integration Endpoints - Widget Serving for Notion/Obsidian
// ============================================================================

// Serve streak widget HTML directly (for Notion/Obsidian embedding)
app.get('/widgets/streak/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { theme = 'light' } = req.query;
    
    if (!process.env.DATABASE_URL) {
      return res.status(503).send('<html><body><p>Database not configured</p></body></html>');
    }
    
    const { prisma } = await import('./lib/prisma');
    const { generateStreakWidgetHTML, calculateStreak } = 
      await import('./lib/services/widgetService');
    
    // Get user's performance data
    const performanceRecords = await prisma.performanceRecord.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 1000, // Last 1000 records for streak calculation
    });
    
    const streakData = calculateStreak(performanceRecords);
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
app.get('/widgets/question-of-day/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { theme = 'light' } = req.query;
    
    if (!process.env.DATABASE_URL) {
      return res.status(503).send('<html><body><p>Database not configured</p></body></html>');
    }
    
    const { prisma } = await import('./lib/prisma');
    const { generateQuestionOfDayHTML, getQuestionOfDay } = 
      await import('./lib/services/widgetService');
    
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
    // including actual options in the database or fetch from question repository
    const questions = savedQuestions.map(sq => {
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
        options: [
          `Option ${answerLetter} (Correct)`,
          'Option B',
          'Option C',
          'Option D'
        ], // Simplified - in production, fetch actual options
        correctAnswer: answerLetter,
        explanation: sq.explanation,
        system: sq.system || undefined,
        subcategory: sq.topic,
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
app.get('/widgets/stats/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { theme = 'light' } = req.query;
    
    if (!process.env.DATABASE_URL) {
      return res.status(503).send('<html><body><p>Database not configured</p></body></html>');
    }
    
    const { prisma } = await import('./lib/prisma');
    
    // Get user statistics
    const performanceRecords = await prisma.performanceRecord.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    });
    
    const totalQuestions = performanceRecords.length;
    const correctAnswers = performanceRecords.filter(r => r.isCorrect).length;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions * 100).toFixed(1) : '0.0';
    
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
        <div class="stat-value">${correctAnswers}</div>
        <div class="stat-label">Correct</div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.send(html);
  } catch (error) {
    console.error('Failed to serve stats widget:', error);
    res.status(500).send('<html><body><p>Error loading widget</p></body></html>');
  }
});

// ============================================================================
// Media Management API Endpoints (Supabase Storage)
// ============================================================================

// Upload media to Supabase Storage
app.post('/api/media/upload', async (req: Request, res: Response) => {
  try {
    const uploadHandler = await import('./functions/api/media/upload');
    await uploadHandler.default(req, res);
  } catch (error) {
    console.error('Error in media upload:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// List media assets
app.get('/api/media/list', async (req: Request, res: Response) => {
  try {
    const listHandler = await import('./functions/api/media/list');
    await listHandler.default(req, res);
  } catch (error) {
    console.error('Error listing media:', error);
    res.status(500).json({ error: 'Failed to list media' });
  }
});

// ============================================================================
// Question Management API Endpoints (Smart Storage with No-Repeat)
// ============================================================================

// Fetch questions for a user (with no-repeat logic)
app.post('/api/questions/fetch', async (req: Request, res: Response) => {
  try {
    const fetchHandler = await import('./functions/api/questions/fetch');
    await fetchHandler.default(req, res);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Record that a user has seen a question
app.post('/api/questions/record', async (req: Request, res: Response) => {
  try {
    const recordHandler = await import('./functions/api/questions/record');
    await recordHandler.default(req, res);
  } catch (error) {
    console.error('Error recording question:', error);
    res.status(500).json({ error: 'Failed to record question' });
  }
});

// Get question repository statistics
app.get('/api/questions/stats', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { getRepositoryStats } = await import('./services/noRepeatService');
    const stats = await getRepositoryStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 PANaCEa Backend Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  // Disconnect Prisma client if database is configured
  if (process.env.DATABASE_URL) {
    const { disconnectPrisma } = await import('./lib/prisma');
    await disconnectPrisma();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  // Disconnect Prisma client if database is configured
  if (process.env.DATABASE_URL) {
    const { disconnectPrisma } = await import('./lib/prisma');
    await disconnectPrisma();
  }
  process.exit(0);
});
