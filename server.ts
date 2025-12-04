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
      console.log('Reaction received:', req.body);
      
      // For development: use in-memory storage
      // TODO: Uncomment when database is connected
      // const { prisma } = await import('./lib/prisma');
      // await prisma.explanationReaction.create({
      //   data: {
      //     questionId,
      //     reaction,
      //     userId: userId || null,
      //   },
      // });
      
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
      console.log('Weakness data received:', req.body);
      
      // For development: use in-memory storage
      // TODO: Uncomment when database is connected
      // const { prisma } = await import('./lib/prisma');
      // if (userId) {
      //   await prisma.weaknessPattern.create({
      //     data: {
      //       userId,
      //       conditionId,
      //       wasCorrect,
      //     },
      //   });
      // }
      
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
      console.log('Confusion data received:', req.body);
      
      // For development: use in-memory storage
      // TODO: Uncomment when database is connected
      // const { prisma } = await import('./lib/prisma');
      // // Update or create confusion pair
      // const existingPair = await prisma.confusionPair.findUnique({
      //   where: {
      //     userId_realCondition_mistakenFor: {
      //       userId: userId || null,
      //       realCondition: correctCondition,
      //       mistakenFor: selectedCondition,
      //     },
      //   },
      // });
      // 
      // if (existingPair) {
      //   await prisma.confusionPair.update({
      //     where: { id: existingPair.id },
      //     data: {
      //       count: { increment: 1 },
      //       lastOccurrence: new Date(),
      //     },
      //   });
      // } else {
      //   await prisma.confusionPair.create({
      //     data: {
      //       userId: userId || null,
      //       realCondition: correctCondition,
      //       mistakenFor: selectedCondition,
      //       count: 1,
      //     },
      //   });
      // }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to store confusion pattern:', error);
      res.status(500).json({ success: false, error: 'Failed to store confusion pattern' });
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
  // Disconnect Prisma client
  // TODO: Uncomment when database is connected
  // const { disconnectPrisma } = await import('./lib/prisma');
  // await disconnectPrisma();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  // Disconnect Prisma client
  // TODO: Uncomment when database is connected
  // const { disconnectPrisma } = await import('./lib/prisma');
  // await disconnectPrisma();
  process.exit(0);
});
