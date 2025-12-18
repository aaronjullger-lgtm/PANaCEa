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
import { requireAuth, AuthenticatedRequest } from './lib/middleware/clerkAuth';
import { requireAdmin } from './lib/middleware/adminAuth';
import { prisma } from './lib/prisma';
import Redis from 'ioredis';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createRequestLogger } from './lib/logging/structuredLogger';
import { getDailyWordForUser, submitWordleGuess, WordleServiceError } from './services/wordleService';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security Middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too many requests, please try again later.' }
});

interface GeminiApiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
}

interface ApiError extends Error {
  message: string;
  code?: string;
  status?: number;
}

// Apply rate limiting to all requests
app.use(limiter);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(sanitizeBody); // Sanitize all request bodies

// Request logging middleware
app.use(createRequestLogger());

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

    // Basic prompt validation (Anti-Injection / Safety Filter)
    const forbiddenKeywords = ['ignore all instructions', 'write a poem', 'write a story', 'act as a pirate'];
    if (forbiddenKeywords.some(kw => prompt.toLowerCase().includes(kw))) {
         return res.status(400).json({ error: 'Invalid prompt: Request rejected by safety filter.' });
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
            parts: [{ text: "You are a strict medical education assistant. You must only answer questions related to medicine, clinical practice, anatomy, physiology, or the PANaCEa application. If the user asks about anything else (like creative writing, coding, general knowledge, etc.), you must refuse. Do not generate creative content like poems or stories unless they are specifically medical mnemonics requested by the user." }]
        },
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

    const geminiData: GeminiApiResponse = await geminiResponse.json();
    
    let rawText = '';
    if (geminiData.candidates && geminiData.candidates[0]?.content?.parts?.[0]?.text) {
      rawText = geminiData.candidates[0].content.parts[0].text;
    }

    // Strip code fences if present
    let text = rawText.trim();
    if (text.startsWith('```')) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1) {
        text = text.substring(firstNewline + 1);
        if (text.endsWith('```')) {
          text = text.substring(0, text.length - 3);
        }
      }
    }

    res.json({ text: text.trim() });
  } catch (error) {
    console.error('Gemini Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get extended condition details (Anatomy, Special Tests)
app.get('/api/conditions/:identifier/extended', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { identifier } = req.params;
    
    // 1. Try direct ID match (UUID)
    let condition = await prisma.condition.findUnique({
      where: { id: identifier },
      include: {
        anatomyStructures: true,
        specialTests: true,
        media: true
      }
    });

    // 2. If not found, try name match (exact)
    if (!condition) {
      // Try to convert slug back to name? "atrial-fibrillation" -> "Atrial Fibrillation"
      // Hard to do perfectly.
      // Let's try case-insensitive search on name
      const conditions = await prisma.condition.findMany({
        where: {
          name: {
            equals: identifier.replace(/-/g, ' '), // simple de-slugify attempt
            mode: 'insensitive'
          }
        },
        include: {
          anatomyStructures: true,
          specialTests: true,
          media: true
        }
      });
      
      if (conditions.length > 0) {
        condition = conditions[0];
      }
    }

    // 3. If still not found, try searching with the raw identifier
    if (!condition) {
       const conditions = await prisma.condition.findMany({
        where: {
          name: {
            equals: identifier,
            mode: 'insensitive'
          }
        },
        include: {
          anatomyStructures: true,
          specialTests: true,
          media: true
        }
      });
       if (conditions.length > 0) {
        condition = conditions[0];
      }
    }

    if (!condition) {
      return res.status(404).json({ error: 'Condition not found' });
    }

    res.json(condition);
  } catch (error) {
    console.error('Error fetching extended condition details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all medical content (Replacement for static JSON file)
// Public endpoint to allow loading content before auth (mimics static file behavior)
app.get('/api/content/all', async (req: Request, res: Response) => {
  try {
    // Only query published content for production use
    const allContent = await prisma.medicalContent.findMany({
      where: { status: 'published' }
    });

    // Transform to map format expected by frontend
    const contentMap: Record<string, any> = {};
    allContent.forEach(item => {
      contentMap[item.conditionId] = {
        // Basic info
        conditionId: item.conditionId,
        condition: item.condition,
        system: item.system,
        subcategory: item.subcategory,
        
        // Content sections - properly format for frontend
        overview: item.overview,
        
        // Combine etiology and pathophysiology for backward compatibility
        // Frontend components expect this combined field (see ConditionDetailModal.tsx line 40)
        etiologyPathophysiology: [
          item.etiology ? `**Etiology**\n\n${item.etiology}` : null,
          item.pathophysiology ? `**Pathophysiology**\n\n${item.pathophysiology}` : null
        ].filter(Boolean).join('\n\n') || undefined,
        
        // Also provide separate fields for services that use them
        etiology: item.etiology,
        pathophysiology: item.pathophysiology,
        epidemiology: item.epidemiology,
        
        // Arrays - ensure they're properly formatted
        symptoms: item.symptoms && item.symptoms.length > 0 ? item.symptoms : undefined,
        physicalExam: item.physicalExam && item.physicalExam.length > 0 ? item.physicalExam : undefined,
        
        // Alias for backward compatibility (ConditionDetailModal.tsx line 47)
        examFindings: item.physicalExam && item.physicalExam.length > 0 ? item.physicalExam : undefined,
        
        riskFactors: item.riskFactors && item.riskFactors.length > 0 ? item.riskFactors : undefined,
        complications: item.complications && item.complications.length > 0 ? item.complications : undefined,
        differentialDiagnosis: item.differentialDiagnosis && item.differentialDiagnosis.length > 0 ? item.differentialDiagnosis : undefined,
        
        // JSON fields - pass through as-is
        diagnostics: item.diagnostics,
        treatment: item.treatment,
        
        prognosis: item.prognosis,
        buzzwords: item.buzzwords && item.buzzwords.length > 0 ? item.buzzwords : undefined
      };
    });

    res.json(contentMap);
  } catch (error) {
    console.error('Error fetching all content:', error);
    
    // Provide more helpful error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        error: 'Database unavailable',
        message: 'Unable to connect to database. Please ensure DATABASE_URL is configured and the database is accessible.',
        details: errorMessage
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch medical content from database',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

// Single Condition Content Endpoint
app.get('/api/content/condition/:conditionId', async (req: Request, res: Response) => {
  try {
    const { conditionId } = req.params;
    
    const content = await prisma.medicalContent.findFirst({
      where: { 
        conditionId,
        status: 'published'
      }
    });
    
    if (!content) {
      return res.status(404).json({ 
        error: 'Condition not found',
        conditionId 
      });
    }
    
    res.json({
      conditionId: content.conditionId,
      condition: content.condition,
      system: content.system,
      subcategory: content.subcategory,
      overview: content.overview,
      etiology: content.etiology,
      pathophysiology: content.pathophysiology,
      epidemiology: content.epidemiology,
      symptoms: content.symptoms,
      physicalExam: content.physicalExam,
      diagnostics: content.diagnostics,
      treatment: content.treatment,
      prognosis: content.prognosis,
      differentialDiagnosis: content.differentialDiagnosis,
      riskFactors: content.riskFactors,
      complications: content.complications
    });
  } catch (error) {
    console.error('Error fetching condition:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Content Search Endpoint
app.get('/api/content/search', async (req: Request, res: Response) => {
  try {
    const { q, system, limit = 30 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const query = String(q);
    
    // Build where clause with proper types
    type WhereClause = {
      status: string;
      OR: Array<{
        condition?: { contains: string; mode: 'insensitive' };
        overview?: { contains: string; mode: 'insensitive' };
      }>;
      AND?: Array<{
        OR: Array<{
          system?: string;
          relatedSystems?: { has: string };
        }>;
      }>;
    };
    
    const where: WhereClause = {
      status: 'published',
      OR: [
        { condition: { contains: query, mode: 'insensitive' } },
        { overview: { contains: query, mode: 'insensitive' } }
      ]
    };
    
    if (system) {
      where.AND = [
        {
          OR: [
            { system: String(system) },
            { relatedSystems: { has: String(system) } }
          ]
        }
      ];
    }
    
    const results = await prisma.medicalContent.findMany({
      where,
      take: Number(limit),
      select: {
        conditionId: true,
        condition: true,
        system: true,
        subcategory: true,
        overview: true
      },
      orderBy: { condition: 'asc' }
    });
    
    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Buzzwords Endpoints
app.get('/api/buzzwords', async (req: Request, res: Response) => {
  try {
    const buzzwords = await prisma.buzzword.findMany({
      orderBy: { buzzword: 'asc' }
    });
    res.json(buzzwords);
  } catch (error) {
    console.error('Error fetching buzzwords:', error);
    res.status(500).json({ error: 'Failed to fetch buzzwords' });
  }
});

app.get('/api/buzzwords/random', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 10;
    
    // Use raw SQL for random ordering: ORDER BY RANDOM()
    const buzzwords = await prisma.$queryRaw`
      SELECT * FROM "Buzzword"
      ORDER BY RANDOM()
      LIMIT ${count}
    `;
    
    res.json(buzzwords);
  } catch (error) {
    console.error('Error fetching random buzzwords:', error);
    res.status(500).json({ error: 'Failed to fetch random buzzwords' });
  }
});

// Medical Wordle Endpoints
app.get('/api/games/wordle/daily', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

app.post(
  '/api/games/wordle/guess',
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

// Guidelines Endpoints
app.get('/api/guidelines', async (req: Request, res: Response) => {
  try {
    const guidelines = await prisma.clinicalGuideline.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(guidelines);
  } catch (error) {
    console.error('Error fetching guidelines:', error);
    res.status(500).json({ error: 'Failed to fetch guidelines' });
  }
});

app.get('/api/guidelines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const guideline = await prisma.clinicalGuideline.findUnique({
      where: { id }
    });
    
    if (!guideline) {
      return res.status(404).json({ error: 'Guideline not found' });
    }
    
    res.json(guideline);
  } catch (error) {
    console.error(`Error fetching guideline ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch guideline' });
  }
});

// Lab Tests & Cases Endpoints
app.get('/api/labs/tests', async (req: Request, res: Response) => {
  try {
    const tests = await prisma.labTest.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(tests);
  } catch (error) {
    console.error('Error fetching lab tests:', error);
    res.status(500).json({ error: 'Failed to fetch lab tests' });
  }
});

app.get('/api/labs/cases', async (req: Request, res: Response) => {
  try {
    const cases = await prisma.labCase.findMany();
    res.json(cases);
  } catch (error) {
    console.error('Error fetching lab cases:', error);
    res.status(500).json({ error: 'Failed to fetch lab cases' });
  }
});

app.get('/api/labs/cases/random', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 1;
    
    // Use raw SQL for random ordering
    const cases = await prisma.$queryRaw`
      SELECT * FROM "LabCase"
      ORDER BY RANDOM()
      LIMIT ${count}
    `;
    
    res.json(cases);
  } catch (error) {
    console.error('Error fetching random lab cases:', error);
    res.status(500).json({ error: 'Failed to fetch random lab cases' });
  }
});

// Reference Data Endpoints

// Anatomy
app.get('/api/reference/anatomy', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('./lib/services/referenceService');
    const { system, query } = req.query;
    if (query) {
      const results = await referenceService.searchAnatomy(query as string);
      res.json({ success: true, data: results });
    } else {
      const results = await referenceService.getAnatomyStructures(system as string);
      res.json({ success: true, data: results });
    }
  } catch (error) {
    console.error('Error fetching anatomy:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anatomy' });
  }
});

app.get('/api/reference/anatomy/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('./lib/services/referenceService');
    const result = await referenceService.getAnatomyStructure(req.params.id);
    if (!result) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching anatomy detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anatomy detail' });
  }
});

// Special Tests
app.get('/api/reference/special-tests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('./lib/services/referenceService');
    const { system } = req.query;
    const results = await referenceService.getSpecialTests(system as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching special tests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch special tests' });
  }
});

// Physiology
app.get('/api/reference/physiology', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('./lib/services/referenceService');
    const { category } = req.query;
    const results = await referenceService.getPhysiologyConcepts(category as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching physiology:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch physiology' });
  }
});

// Treatments
app.get('/api/reference/treatments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('./lib/services/referenceService');
    const { category } = req.query;
    const results = await referenceService.getTreatments(category as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching treatments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch treatments' });
  }
});

// Differentials
app.get('/api/reference/differentials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('./lib/services/referenceService');
    const { category } = req.query;
    const results = await referenceService.getDifferentials(category as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching differentials:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch differentials' });
  }
});

// Imaging
app.get('/api/reference/imaging', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('./lib/services/referenceService');
    const { modality } = req.query;
    const results = await referenceService.getImagingStudies(modality as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching imaging:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch imaging' });
  }
});

// Findings
app.get('/api/reference/findings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('./lib/services/referenceService');
    const { system } = req.query;
    const results = await referenceService.getFindings(system as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching findings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch findings' });
  }
});

// Guidelines
app.get('/api/reference/guidelines', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('./lib/services/referenceService');
    const { category } = req.query;
    const results = await referenceService.getGuidelines(category as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching guidelines:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch guidelines' });
  }
});

// Rate limiting setup
let redisClient: Redis | null = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
} else {
  console.warn('REDIS_URL not found, falling back to in-memory rate limiting. This is not recommended for production.');
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
function customRateLimit(maxRequests: number, windowMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || req.socket.remoteAddress || 'unknown';
    
    if (redisClient) {
      const key = `rate_limit:${clientId}`;
      try {
        const requests = await redisClient.incr(key);
        if (requests === 1) {
          await redisClient.expire(key, Math.ceil(windowMs / 1000));
        }
        
        if (requests > maxRequests) {
           const ttl = await redisClient.ttl(key);
           return res.status(429).json({
            error: 'Too many requests',
            retryAfter: ttl
          });
        }
        return next();
      } catch (error) {
        console.error('Redis rate limit error:', error);
        // Fail open if Redis is down
        return next();
      }
    } else {
      // In-memory fallback
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
    }
  };
}

// Apply rate limiting to API endpoints (100 requests per 15 minutes)
app.use('/api', customRateLimit(100, 15 * 60 * 1000));

// Stricter rate limit for sync endpoints (30 requests per 5 minutes)
// This prevents abuse while allowing reasonable sync frequency
const syncRateLimit = customRateLimit(30, 5 * 60 * 1000);

// API sync endpoint with authentication and rate limiting
// Rate limiting: 30 requests per 5 minutes (in addition to global /api rate limit)
// Authentication: Clerk JWT token required via requireAuth middleware
app.get('/api/sync', requireAuth, syncRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;
    
    if (!process.env.DATABASE_URL) {
       return res.json({ 
         success: true, 
         data: { performanceRecords: [], srsItems: [], savedQuestions: [] } 
       });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const [performanceRecords, srsItems, savedQuestions] = await Promise.all([
      prisma.performanceRecord.findMany({ where: { userId: user.id } }),
      prisma.sRSItem.findMany({ where: { userId: user.id } }),
      prisma.savedQuestion.findMany({ where: { userId: user.id } })
    ]);

    // Convert BigInt to Number for JSON serialization
    const serializedPerformance = performanceRecords.map(r => ({
      ...r,
      timestamp: Number(r.timestamp)
    }));

    res.json({
      success: true,
      data: {
        performanceRecords: serializedPerformance,
        srsItems,
        savedQuestions
      }
    });
  } catch (error) {
    console.error('Sync GET error:', error);
    res.status(500).json({ error: 'Internal server error during sync' });
  }
});

// Rate limiting: 30 requests per 5 minutes (in addition to global /api rate limit)
// Authentication: Clerk JWT token required via requireAuth middleware
app.post('/api/sync', requireAuth, syncRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;
    const { performanceRecords, srsItems, savedQuestions } = req.body;

    if (!process.env.DATABASE_URL) {
       return res.json({ success: true, message: 'Sync acknowledged (No DB configured)' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found. Please log in again.' });
    }

    const internalUserId = user.id;

    await prisma.$transaction(async (tx) => {
      // 1. Sync Performance Records
      if (performanceRecords && Array.isArray(performanceRecords)) {
        for (const record of performanceRecords) {
          // Deduplication: Check if record exists by timestamp + conditionId
          // (Since client might not send ID, and we want to avoid duplicates from full-history syncs)
          const existing = await tx.performanceRecord.findFirst({
            where: {
              userId: internalUserId,
              timestamp: record.timestamp,
              conditionName: record.conditionName
            }
          });

          if (!existing) {
            await tx.performanceRecord.create({
              data: {
                userId: internalUserId,
                topic: record.topic,
                system: record.system,
                focus: record.focus,
                difficulty: record.difficulty,
                isCorrect: record.isCorrect,
                timestamp: record.timestamp,
                questionWordCount: record.questionWordCount,
                errorTag: record.errorTag,
                subcategoryName: record.subcategoryName,
                conditionName: record.conditionName,
              }
            });
          }
        }
      }

      // 2. Sync SRS Items
      if (srsItems && Array.isArray(srsItems)) {
        for (const item of srsItems) {
          await tx.sRSItem.upsert({
            where: {
              userId_questionId: {
                userId: internalUserId,
                questionId: item.questionId
              }
            },
            update: {
              interval: item.interval,
              repetition: item.repetition,
              easiness: item.easiness,
              dueDate: new Date(item.dueDate),
              lastReviewed: new Date(item.lastReviewed),
              quality: item.quality,
              difficulty: item.difficulty,
              stabilityScore: item.stabilityScore,
              fsrsStability: item.fsrsStability,
              fsrsDifficulty: item.fsrsDifficulty,
              fsrsState: item.fsrsState,
              fsrsLastReview: item.fsrsLastReview ? new Date(item.fsrsLastReview) : null
            },
            create: {
              userId: internalUserId,
              questionId: item.questionId,
              interval: item.interval,
              repetition: item.repetition,
              easiness: item.easiness,
              dueDate: new Date(item.dueDate),
              lastReviewed: new Date(item.lastReviewed),
              quality: item.quality,
              difficulty: item.difficulty,
              stabilityScore: item.stabilityScore,
              fsrsStability: item.fsrsStability,
              fsrsDifficulty: item.fsrsDifficulty,
              fsrsState: item.fsrsState,
              fsrsLastReview: item.fsrsLastReview ? new Date(item.fsrsLastReview) : null
            }
          });
        }
      }
      
      // 3. Sync Saved Questions
      if (savedQuestions && Array.isArray(savedQuestions)) {
         for (const sq of savedQuestions) {
            await tx.savedQuestion.upsert({
                where: {
                    userId_questionId_type: {
                        userId: internalUserId,
                        questionId: sq.questionId,
                        type: sq.type
                    }
                },
                update: {
                    questionText: sq.questionText,
                    correctAnswer: sq.correctAnswer,
                    explanation: sq.explanation,
                    topic: sq.topic,
                    system: sq.system,
                    userNote: sq.userNote,
                    repetitionLevel: sq.repetitionLevel,
                    nextReviewDate: sq.nextReviewDate
                },
                create: {
                    userId: internalUserId,
                    questionId: sq.questionId,
                    type: sq.type,
                    questionText: sq.questionText,
                    correctAnswer: sq.correctAnswer,
                    explanation: sq.explanation,
                    topic: sq.topic,
                    system: sq.system,
                    userNote: sq.userNote,
                    repetitionLevel: sq.repetitionLevel,
                    nextReviewDate: sq.nextReviewDate
                }
            });
         }
      }
    });

    res.json({
      success: true,
      message: 'Data synced successfully'
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
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
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Failed to create branch:', apiError);
      res.status(500).json({ 
        success: false, 
        error: apiError.message || 'Failed to create branch' 
      });
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
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Failed to merge branch:', apiError);
      res.status(500).json({ 
        success: false, 
        error: apiError.message || 'Failed to merge branch' 
      });
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
    
    // Map Prisma records to the expected PerformanceRecord type
    const mappedRecords = performanceRecords.map(r => ({
      ...r,
      timestamp: Number(r.timestamp),
      system: r.system as any,
      subcategory: r.subcategoryName,
      condition: r.conditionName || 'Unknown',
      conditionId: 'unknown',
      topic: r.topic,
      focus: r.focus as any,
      difficulty: r.difficulty as any,
      errorTag: r.errorTag as any
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
        system: sq.system as any || undefined,
        subcategory: sq.topic,
        correctAnswerIndex: 0,
        rationale: sq.explanation,
        topic: sq.topic,
        conditionId: 'unknown',
        condition: 'Unknown',
        pearls: []
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

// Get pending media (admin-only)
app.get('/api/media/pending', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pendingHandler = await import('./functions/api/media/pending');
    await pendingHandler.default(req, res);
  } catch (error) {
    console.error('Error getting pending media:', error);
    res.status(500).json({ error: 'Failed to get pending media' });
  }
});

// Approve or reject media (admin-only)
app.post('/api/media/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const approveHandler = await import('./functions/api/media/approve');
    await approveHandler.default(req, res);
  } catch (error) {
    console.error('Error approving media:', error);
    res.status(500).json({ error: 'Failed to approve media' });
  }
});

// Get media approval stats (admin-only)
app.get('/api/media/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const statsHandler = await import('./functions/api/media/stats');
    await statsHandler.default(req, res);
  } catch (error) {
    console.error('Error getting media stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Check admin access (for frontend validation)
app.get('/api/admin/check-access', requireAdmin, (req: Request, res: Response) => {
  res.json({ success: true, role: 'admin' });
});

// Admin Stats Endpoint
app.get('/api/admin/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    // In a real implementation, this would query the database
    // For now, we'll return mock data or simple counts if DB is available
    let stats = {
      totalUsers: 150,
      activeUsersToday: 78,
      totalStudySessions: 45230,
      averageAccuracy: 76.5
    };

    if (process.env.DATABASE_URL) {
      const { prisma } = await import('./lib/prisma');
      const userCount = await prisma.user.count();
      const sessionCount = await prisma.performanceRecord.count();
      
      // Let's just count correct vs total
      const correctCount = await prisma.performanceRecord.count({
        where: { isCorrect: true }
      });
      
      stats = {
        totalUsers: userCount,
        activeUsersToday: 0, // Need a session table or lastActive field
        totalStudySessions: sessionCount,
        averageAccuracy: sessionCount > 0 ? (correctCount / sessionCount) * 100 : 0
      };
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
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

// Performance Routes
app.get('/api/performance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;
    if (!process.env.DATABASE_URL) return res.json({ success: true, data: [] });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const records = await prisma.performanceRecord.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 1000
    });
    
    // Convert BigInt to Number for JSON serialization
    const serializedRecords = records.map(r => ({
      ...r,
      timestamp: Number(r.timestamp)
    }));

    res.json({ success: true, data: serializedRecords });
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

app.post('/api/performance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;
    const record = req.body;
    
    if (!process.env.DATABASE_URL) return res.json({ success: true });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.performanceRecord.create({
      data: {
        userId: user.id,
        topic: record.topic,
        system: record.system,
        focus: record.focus,
        difficulty: record.difficulty,
        isCorrect: record.isCorrect,
        timestamp: record.timestamp,
        questionWordCount: record.questionWordCount,
        errorTag: record.errorTag,
        subcategoryName: record.subcategoryName,
        conditionName: record.conditionName,
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving performance:', error);
    res.status(500).json({ error: 'Failed to save performance' });
  }
});

// SRS Routes
app.get('/api/srs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;
    if (!process.env.DATABASE_URL) return res.json({ success: true, data: [] });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const items = await prisma.sRSItem.findMany({
      where: { userId: user.id }
    });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching SRS:', error);
    res.status(500).json({ error: 'Failed to fetch SRS' });
  }
});

// Achievements Routes
app.get('/api/achievements', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;
    if (!process.env.DATABASE_URL) return res.json({ success: true, data: [] });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const achievements = await prisma.userAchievement.findMany({
      where: { userId: user.id }
    });

    res.json({ success: true, data: achievements });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Question Query Route
app.post('/api/questions/query', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { system, difficulty, limit = 10 } = req.body;
    
    if (!process.env.DATABASE_URL) {
       return res.json({ success: true, questions: [] });
    }

    const { getQuestionsWithNoRepeat } = await import('./services/noRepeatService');
    const userId = req.auth.userId;
    
    const result = await getQuestionsWithNoRepeat(userId, { system, difficulty }, limit);
    
    res.json({ success: true, questions: result.questions });
  } catch (error) {
    console.error('Error querying questions:', error);
    res.status(500).json({ error: 'Failed to query questions' });
  }
});

// Batch fetch questions by ID
app.post('/api/questions/batch', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid request: ids array required' });
    }

    if (process.env.DATABASE_URL) {
      const { prisma } = await import('./lib/prisma');
      const questions = await prisma.preGeneratedQuestion.findMany({
        where: {
          id: { in: ids }
        }
      });
      
      // Map to frontend Question format
      const mappedQuestions = questions.map(q => {
        const qData = q.questionData as any;
        return {
          id: q.id,
          question: qData?.question || qData?.text || 'Question text missing',
          options: qData?.options || [],
          correctAnswer: qData?.correctAnswer || '',
          explanation: qData?.explanation || '',
          system: q.system || undefined,
          difficulty: q.difficulty || 'medium',
          type: q.questionType || 'mcq'
        };
      });
      
      return res.json({ success: true, questions: mappedQuestions });
    }

    // Mock response if no DB
    return res.json({ 
      success: true, 
      questions: ids.map(id => ({
        id,
        question: `Mock Question for ID ${id}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        explanation: 'This is a mock explanation because the database is not connected.',
        system: 'General',
        difficulty: 'medium'
      }))
    });
  } catch (error) {
    console.error('Error fetching batch questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// ============================================================================
// OSCE / Patient Encounter Persistence
// ============================================================================

// Get a random patient encounter case
app.get('/api/osce/cases/random', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { prisma } = await import('./lib/prisma');
    
    const count = await prisma.patientEncounterCase.count();
    if (count === 0) {
      return res.status(404).json({ error: 'No cases found' });
    }
    
    const skip = Math.floor(Math.random() * count);
    const randomCase = await prisma.patientEncounterCase.findFirst({
      skip: skip
    });
    
    res.json(randomCase);
  } catch (error) {
    console.error('Error fetching random case:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or get active session
app.post('/api/osce/session', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;
    const { caseId } = req.body;
    
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, sessionId: 'mock-session-id' });
    }

    const { prisma } = await import('./lib/prisma');
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check for existing active session for this case
    const existingSession = await prisma.patientEncounterSession.findFirst({
      where: {
        userId: user.id,
        caseId: caseId,
        status: 'active'
      }
    });

    if (existingSession) {
      return res.json({ success: true, session: existingSession });
    }

    // Create new session
    const session = await prisma.patientEncounterSession.create({
      data: {
        userId: user.id,
        caseId,
        messages: [],
        status: 'active'
      }
    });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error creating OSCE session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get active session details
app.get('/api/osce/session/:sessionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, session: null });
    }

    const { prisma } = await import('./lib/prisma');
    const session = await prisma.patientEncounterSession.findUnique({
      where: { id: sessionId }
    });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error fetching OSCE session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Append chat message
app.post('/api/osce/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, messages } = req.body; // messages is array of new messages or full history
    
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true });
    }

    const { prisma } = await import('./lib/prisma');
    
    // Update session messages
    // We assume 'messages' in body is the FULL updated history or we append?
    // Let's assume it's the full history for simplicity and idempotency
    await prisma.patientEncounterSession.update({
      where: { id: sessionId },
      data: {
        messages: messages,
        updatedAt: new Date()
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving OSCE chat:', error);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

// Complete session
app.post('/api/osce/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, diagnosis, treatmentPlan } = req.body;
    
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true });
    }

    const { prisma } = await import('./lib/prisma');
    
    await prisma.patientEncounterSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        diagnosis,
        treatmentPlan,
        updatedAt: new Date()
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing OSCE session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// First Line Treatment Endpoints
app.get('/api/first-line', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const where = category ? { category: String(category) } : {};
    
    const treatments = await prisma.firstLineTreatment.findMany({
      where,
      orderBy: { condition: 'asc' }
    });
    res.json(treatments);
  } catch (error) {
    console.error('Error fetching first line treatments:', error);
    res.status(500).json({ error: 'Failed to fetch first line treatments' });
  }
});

app.get('/api/first-line/categories', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.firstLineTreatment.groupBy({
      by: ['category'],
      orderBy: { category: 'asc' }
    });
    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error('Error fetching first line categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Drug Endpoints
app.get('/api/drugs', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const take = limit ? Number(limit) : undefined;
    
    const drugs = await prisma.drug.findMany({
      take,
      orderBy: { genericName: 'asc' }
    });
    res.json(drugs);
  } catch (error) {
    console.error('Error fetching drugs:', error);
    res.status(500).json({ error: 'Failed to fetch drugs' });
  }
});

app.get('/api/drugs/random', async (req: Request, res: Response) => {
  try {
    const count = Number(req.query.count) || 10;
    // Use raw SQL for random selection for better performance
    const drugs = await prisma.$queryRaw`SELECT * FROM "Drug" ORDER BY RANDOM() LIMIT ${count}`;
    res.json(drugs);
  } catch (error) {
    console.error('Error fetching random drugs:', error);
    res.status(500).json({ error: 'Failed to fetch random drugs' });
  }
});

app.get('/api/drugs/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    
    const query = String(q);
    const drugs = await prisma.drug.findMany({
      where: {
        OR: [
          { genericName: { contains: query, mode: 'insensitive' } },
          { brandName: { contains: query, mode: 'insensitive' } },
          // Note: array filtering in Prisma is specific, 'has' checks for exact element match
        ]
      },
      take: 20
    });
    res.json(drugs);
  } catch (error) {
    console.error('Error searching drugs:', error);
    res.status(500).json({ error: 'Failed to search drugs' });
  }
});

// Start the server
app.listen(PORT, async () => {
  // Check database connectivity
  let dbStatus = '✗ Not configured';
  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = '✓ Connected';
    } catch (error) {
      dbStatus = '✗ Connection failed';
      console.error('Database connection error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  const envDisplay = (process.env.NODE_ENV || 'development').padEnd(16);
  
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  PANaCEa Backend Server                        ║
╠════════════════════════════════════════════════════════════════╣
║ Status: ✓ Server is running                                   ║
║ Port: ${String(PORT).padEnd(56)}║
║ Environment: ${envDisplay}                              ║
║                                                                ║
║ API Endpoints:                                                 ║
║   - Health Check: http://localhost:${PORT}/health                 ║
║   - Content API: http://localhost:${PORT}/api/content/all         ║
║   - Gemini Proxy: http://localhost:${PORT}/geminiProxy            ║
║                                                                ║
║ Database: ${dbStatus.padEnd(50)}║
╚════════════════════════════════════════════════════════════════╝
  `);
});
