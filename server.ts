/**
 * ============================================================================
 * ⚠️  LEGACY SERVER - LOCAL DEVELOPMENT ONLY ⚠️
 * ============================================================================
 *
 * This Express server is for LOCAL DEVELOPMENT and TESTING only.
 *
 * PRODUCTION uses Cloudflare Pages Functions in /functions/api/
 *
 * When to use this server:
 * - `npm run dev:all` - Runs Vite + this server for local proxy testing
 * - Testing Express-specific middleware or routes before migrating to CF
 *
 * DO NOT deploy this server to production. All production API traffic
 * should go through Cloudflare Pages Functions.
 *
 * See: CLOUDFLARE_FUNCTIONS_GUIDE.md for production deployment info.
 * ============================================================================
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// ⚠️ CRITICAL: Load environment variables FIRST before any imports that use process.env
// This must happen before importing prisma, routes, or any other modules that read env vars
config();

import { sanitizeBody } from './lib/middleware/validation';
import { prisma } from './lib/prisma';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createRequestLogger } from './lib/logging/structuredLogger';
import { validateEnvironment } from './lib/config/environment';
import { performHealthCheck, getHealthStatusCode } from './lib/services/healthCheck';

// Import modular route system
import { registerRoutes } from './routes';

// Validate environment configuration before proceeding
validateEnvironment();

// ============================================================================
// CRITICAL SECURITY STARTUP CHECKS
// ============================================================================
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS;
const SUPERADMIN_USER_IDS = process.env.SUPERADMIN_USER_IDS;

if (!CLERK_SECRET_KEY) {
  console.error('\n🚨 CRITICAL SECURITY WARNING 🚨');
  console.error('CLERK_SECRET_KEY is not set. Admin authentication will fail.');
  console.error('Set this environment variable before deploying to production.\n');

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to start in production without CLERK_SECRET_KEY.');
    process.exit(1);
  }
}

if (!ADMIN_USER_IDS && !SUPERADMIN_USER_IDS) {
  console.warn('\n⚠️  SECURITY WARNING: No ADMIN_USER_IDS or SUPERADMIN_USER_IDS configured.');
  console.warn('Admin fallback authentication will rely solely on database roles.\n');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Security Middleware with CSP Configuration
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for React and Vite dev mode
          'https://*.clerk.accounts.dev',
          'https://clerk.com',
          'https://*.clerk.com',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for Tailwind and inline styles
        ],
        workerSrc: [
          "'self'",
          'blob:', // Required for Service Workers
        ],
        connectSrc: [
          "'self'",
          'https://*.clerk.accounts.dev',
          'https://clerk.com',
          'https://*.clerk.com',
          'https://api.clerk.com',
          process.env.FRONTEND_URL || 'http://localhost:3000',
        ],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.clerk.accounts.dev', 'https://*.clerk.com'],
        fontSrc: ["'self'", 'data:'],
        frameSrc: ['https://*.clerk.accounts.dev', 'https://*.clerk.com'],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for some third-party integrations
  })
);

console.log('✓ Security headers configured (CSP allows Clerk, Service Workers, API calls)');

// Enhanced Rate Limiting Configuration
const API_LIMITER = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too many requests, please try again later.' },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use ipKeyGenerator for proper IP handling
    return req.user?.id || ipKeyGenerator(req);
  },
  skip: (req) => {
    // Skip rate limiting for health checks and options
    return req.path === '/health' || req.method === 'OPTIONS';
  },
});

// Strict limiter for auth endpoints
const AUTH_LIMITER = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // More restrictive for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

// Apply rate limiting to all requests
app.use(API_LIMITER);

// Apply stricter rate limiting to auth routes
app.use('/api/auth/*', AUTH_LIMITER);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(sanitizeBody); // Sanitize all request bodies

// Request logging middleware
app.use(createRequestLogger());

// Register modular route modules
// This handles /api/*, /widgets/*, and /geminiProxy
registerRoutes(app);

// Health check endpoint - verifies database connectivity
app.get('/health', async (req: Request, res: Response) => {
  const health = await performHealthCheck();
  res.status(getHealthStatusCode(health.status)).json(health);
});

// Start Server
app.listen(PORT, async () => {
  // Check DB connection for startup log
  let dbStatus = '❌ Disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = '✓ Connected';
  } catch (e) {
    dbStatus = '❌ Failed to Connect';
  }

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   PANaCEa API Server                           ║
║                                                                ║
║ Status:   Online                                               ║
║ Port:     ${PORT}                                                 ║
║ Mode:     ${process.env.NODE_ENV || 'development'}                                      ║
║                                                                ║
║ Security:                                                      ║
║   - CSP: ✓ Configured (Clerk, Workers, API allowed)           ║
║   - CORS: ✓ Enabled for ${(process.env.FRONTEND_URL || 'http://localhost:3000').padEnd(25)}      ║
║   - Rate Limiting: ✓ Active (100 req/15min)                   ║
║                                                                ║
║ API Endpoints:                                                 ║
║   - Health Check: http://localhost:${PORT}/health                 ║
║   - Content API: http://localhost:${PORT}/api/content/all         ║
║   - Analytics: http://localhost:${PORT}/api/performance           ║
║   - Gemini Proxy: http://localhost:${PORT}/geminiProxy            ║
║                                                                ║
║ Database: ${dbStatus.padEnd(50)}║
║                                                                ║
║ Note: No catch-all handler - Frontend served by Vite (port 3000) ║
╚════════════════════════════════════════════════════════════════╝
  `);
});