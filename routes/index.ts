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
import auditRouter from './audit';

/**
 * Register all API routes with the Express application.
 * Routes are mounted under their respective base paths.
 *
 * NOTE: Routes marked DORMANT are not actively used by the frontend.
 */
export function registerRoutes(app: Express): void {
  // ─── Core data routes ─────────────────────────────────────────────────
  // [PORTED] → functions/api/conditions/index.ts
  app.use('/api/conditions', conditionsRouter);
  // [NOT PORTED] — 4 endpoints need Edge migration (P0)
  app.use('/api/content', contentRouter);
  // [PARTIAL] — anatomy, differentials, labs, guidelines ported; others missing
  app.use('/api/reference', referenceRouter);

  // ─── Lab and study material routes ────────────────────────────────────
  // [NOT PORTED] — 3 endpoints need Edge migration (P1)
  app.use('/api/labs', labsRouter);
  // [NOT PORTED] — lab-cases endpoints missing (P1)
  app.use('/api/drills', drillsRouter);
  // [PORTED] → functions/api/drugs/index.ts
  app.use('/api/drugs', drugsRouter);
  // [PORTED] → functions/api/buzzwords/index.ts
  app.use('/api/buzzwords', buzzwordsRouter);

  // [DORMANT] Game routes - MedicalWordle not used in App.tsx
  app.use('/api/games', gamesRouter);

  // ─── New modules ──────────────────────────────────────────────────────
  // [NOT PORTED] — 5 analytics endpoints need Edge migration (P0)
  app.use('/api/analytics', analyticsRouter);
  // [PARTIAL] — POST /api/sync ported; GET missing
  app.use('/api/sync', syncRouter);
  // [PARTIAL] — flag + seeds ported; 8 other endpoints missing (P0)
  app.use('/api/questions', questionsRouter);

  // [DORMANT] Clinical pearls - not called by frontend
  app.use('/api/pearls', pearlsRouter);
  // [NOT PORTED] — 5 OSCE endpoints need Edge migration (P0)
  app.use('/api/osce', osceRouter);
  // [PARTIAL] — Gemini proxy only
  app.use('', aiRouter);

  // [NOT PORTED] — achievements, performance endpoints missing (P1)
  app.use('/api', usersRouter);

  // [DORMANT] Adaptive learning - not called by frontend
  app.use('/api/adaptive', adaptiveRouter);
  // [PORTED] → functions/api/recommendations/index.ts
  app.use('/api/recommendations', recommendationsRouter);

  // [DORMANT] Admin audit routes
  app.use('/api/audit', auditRouter);

  console.log('✓ Route modules registered:');
  console.log('  - /api/conditions, /api/content, /api/reference');
  console.log('  - /api/labs, /api/drills, /api/drugs, /api/buzzwords');
  console.log('  - /api/analytics, /api/sync');
  console.log('  - /api/questions, /api/osce');
  console.log('  - /api/performance, /api/achievements');
  console.log('  - /api/audit (admin)');
  console.log('  [DORMANT]: /api/games, /api/pearls, /api/adaptive, /api/recommendations');
}
