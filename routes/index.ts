/**
 * Routes Index
 * 
 * Central registration for all API route modules.
 * This file is the ONLY place where routes are mounted to the Express app.
 */

import { Express } from 'express';

// Import all route modules
import conditionsRouter from './conditions';
import contentRouter from './content';
import referenceRouter from './reference';
import labsRouter from './labs';
import buzzwordsRouter from './buzzwords';
import gamesRouter from './games';
import analyticsRouter from './analytics';
import syncRouter from './sync';
import adminRouter from './admin';
import questionsRouter from './questions';
import pearlsRouter from './pearls';
import osceRouter from './osce';
import aiRouter from './ai';
import usersRouter from './users';
import branchesRouter from './branches';
import mediaRouter from './media';
import widgetsRouter from './widgets';
import recommendationsRouter from './recommendations';

import adaptiveRouter from './adaptive';

/**
 * Register all API routes with the Express application.
 * Routes are mounted under their respective base paths.
 */
export function registerRoutes(app: Express): void {
    // Core data routes
    app.use('/api/conditions', conditionsRouter);
    app.use('/api/content', contentRouter);
    app.use('/api/reference', referenceRouter);

    // Lab and study material routes
    app.use('/api/labs', labsRouter);
    app.use('/api/buzzwords', buzzwordsRouter);

    // Game routes
    app.use('/api/games', gamesRouter);

    // New modules
    app.use('/api/analytics', analyticsRouter);
    app.use('/api/sync', syncRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/questions', questionsRouter); // Includes /generate, /flag, etc.
    app.use('/api/pearls', pearlsRouter);
    app.use('/api/osce', osceRouter);
    app.use('', aiRouter); // Mount at root for /geminiProxy compatibility

    app.use('/api', usersRouter); // Handles /achievements, /performance
    app.use('/api/branches', branchesRouter);
    app.use('/api/media', mediaRouter);
    app.use('/api/adaptive', adaptiveRouter); // Intelligent recommendations
    app.use('/api/recommendations', recommendationsRouter);
    app.use('/widgets', widgetsRouter);

    console.log('✓ Route modules registered:');
    console.log('  - /api/conditions, /api/content, /api/reference');
    console.log('  - /api/labs, /api/buzzwords, /api/games');
    console.log('  - /api/analytics, /api/sync, /api/admin');
    console.log('  - /api/questions, /api/pearls, /api/osce');
    console.log('  - /api/media, /api/branches, /api/performance, /api/achievements');
    console.log('  - /api/adaptive (Intelligent Recommendations)');
    console.log('  - /widgets, /geminiProxy (AI)');
}
