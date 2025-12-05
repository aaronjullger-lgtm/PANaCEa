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
      
      // Generate new question (placeholder - integrate with actual question generation)
      // TODO: In production, integrate with actual AI question generation service
      // For now, return an indication that generation would happen here
      const newQuestion = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: questionType,
        system: system || null,
        difficulty: difficulty || 'medium',
        text: `This is a placeholder. In production, this would be an AI-generated ${questionType} question about: ${queryText}`,
        options: questionType === 'mcq' ? ['Option A', 'Option B', 'Option C', 'Option D'] : undefined,
        correctAnswer: questionType === 'mcq' ? 'Option A' : undefined,
        explanation: 'Placeholder explanation. In production, this would contain detailed medical explanation.',
        generatedAt: new Date().toISOString(),
        metadata: {
          originalQuery: queryText,
          cached: false,
        }
      };
      
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
