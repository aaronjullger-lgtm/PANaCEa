/**
 * ============================================================================
 * ⚠️  LEGACY ROUTES - LOCAL DEVELOPMENT ONLY ⚠️ // pragma: allowlist secret
 * ============================================================================
 *
 * These Express routes are for LOCAL DEVELOPMENT and TESTING only. // pragma: allowlist secret
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
  // [PORTED] → functions/api/content/ (all, [conditionId], search, systems, library, curated-passages, textbook-retrieve, context-widgets)
  app.use('/api/content', contentRouter);
  // [PORTED] → functions/api/reference/ (anatomy, differentials, labs, guidelines, findings, imaging, physiology, special-tests, treatments, vitals, procedures, scoring)
  app.use('/api/reference', referenceRouter);

  // ─── Lab and study material routes ────────────────────────────────────
  // [PORTED] → functions/api/labs/ (tests, cases, cases/random)
  app.use('/api/labs', labsRouter);
  // [PORTED] → functions/api/drills/ (lab-cases, contrastive, pharm, smart-review, antibiotics, fluids, code-blue, confusion-queue)
  app.use('/api/drills', drillsRouter);
  // [PORTED] → functions/api/drugs/index.ts
  app.use('/api/drugs', drugsRouter);
  // [PORTED] → functions/api/buzzwords/index.ts
  app.use('/api/buzzwords', buzzwordsRouter);

  // [DORMANT] Game routes - MedicalWordle not used in App.tsx
  app.use('/api/games', gamesRouter);

  // ─── New modules ──────────────────────────────────────────────────────
  // [PORTED] → functions/api/analytics/ (reactions, weakness, confusion-pairs, performance-deltas, soap-note, blueprint-coverage, calibration, error-patterns, learner-profile, knowledge-graph, etc.)
  app.use('/api/analytics', analyticsRouter);
  // [PORTED] → functions/api/sync.ts (GET + POST with 3-way merge)
  app.use('/api/sync', syncRouter);
  // [PORTED] → functions/api/questions/ (32+ handlers: fetch, batch, no-repeat, flag, seeds, generate, pool, attempt, session, custom-session, staging, etc.)
  app.use('/api/questions', questionsRouter);

  // [DORMANT] Clinical pearls - not called by frontend
  app.use('/api/pearls', pearlsRouter);
  // [PORTED] → functions/api/osce/ (cases/random, session, chat, complete, stats, analytics, live-engine, state-machine, analysis)
  app.use('/api/osce', osceRouter);
  // [PORTED] → functions/api/ai/ (chat, learning, mnemonics, models, sessions, tutor, vision)
  app.use('', aiRouter);

  // [PARTIAL] → functions/api/achievements/ (record, unlock, [userId]); functions/api/user/ (session, analytics, daily-performance). Some perf endpoints may still need Edge equivalents.
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
