/**
 * ============================================================================
 * ⚠️  LEGACY ROUTES - LOCAL DEVELOPMENT ONLY ⚠️
 * ============================================================================
 *
 * These Express routes are for LOCAL DEVELOPMENT and TESTING only.
 *
 * PRODUCTION uses Cloudflare Pages Functions in /functions/api/
 *
 * These routes may have auth drift or missing features compared to
 * the Cloudflare Functions equivalents. Always prefer implementing
 * new features in /functions/api/ directly.
 *
 * See: CLOUDFLARE_FUNCTIONS_GUIDE.md for production deployment info.
 * ============================================================================
 */

import { Express } from 'express';

// Import all route modules
import conditionsRouter from './conditions';
import contentRouter from './content';
import referenceRouter from './reference';
import labsRouter from './labs';
import drugsRouter from './drugs';
import buzzwordsRouter from './buzzwords';
import gamesRouter from './games';
import analyticsRouter from './analytics';
import syncRouter from './sync';
import questionsRouter from './questions';
import pearlsRouter from './pearls';
import osceRouter from './osce';
import aiRouter from './ai';
import usersRouter from './users';
import recommendationsRouter from './recommendations';

import adaptiveRouter from './adaptive';
import drillsRouter from './drills';

/**
 * Register all API routes with the Express application.
 * Routes are mounted under their respective base paths.
 *
 * NOTE: Routes marked DORMANT are not actively used by the frontend.
 */
export function registerRoutes(app: Express): void {
  // Core data routes
  app.use('/api/conditions', conditionsRouter);
  app.use('/api/content', contentRouter);
  app.use('/api/reference', referenceRouter);

  // Lab and study material routes
  app.use('/api/labs', labsRouter);
  app.use('/api/drills', drillsRouter);
  app.use('/api/drugs', drugsRouter);
  app.use('/api/buzzwords', buzzwordsRouter);

  // [DORMANT] Game routes - MedicalWordle not used in App.tsx
  app.use('/api/games', gamesRouter);

  // New modules
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/questions', questionsRouter); // Includes /generate, /flag, etc.

  // [DORMANT] Clinical pearls - not called by frontend
  app.use('/api/pearls', pearlsRouter);
  app.use('/api/osce', osceRouter);
  app.use('', aiRouter);

  app.use('/api', usersRouter); // Handles /achievements, /performance

  // [DORMANT] Adaptive learning - not called by frontend
  app.use('/api/adaptive', adaptiveRouter);
  app.use('/api/recommendations', recommendationsRouter);

  console.log('✓ Route modules registered:');
  console.log('  - /api/conditions, /api/content, /api/reference');
  console.log('  - /api/labs, /api/drills, /api/drugs, /api/buzzwords');
  console.log('  - /api/analytics, /api/sync');
  console.log('  - /api/questions, /api/osce');
  console.log('  - /api/performance, /api/achievements');
  console.log('  [DORMANT]: /api/games, /api/pearls, /api/adaptive, /api/recommendations');
}
