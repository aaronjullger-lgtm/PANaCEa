/**
 * OSCE Routes
 *
 * Handles all Patient Encounter / OSCE related API endpoints.
 * Extracted from server.ts for modularity.
 * Supports both wrapped body ({ body: { ... } }) and flat body for local dev parity with Cloudflare.
 */

import { v4 as uuidv4 } from 'uuid';
import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';

const router = Router();

function getBody<T>(req: AuthenticatedRequest): T {
  const b = req.body as Record<string, unknown>;
  return (b?.body ?? b) as T;
}

// Get a random patient encounter case
router.get(
  '/cases/random',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.auth?.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ error: 'Database not configured' });
        return;
      }

      const count = await prisma.patientEncounterCase.count();
      if (count === 0) {
        res.status(404).json({ error: 'No cases found' });
        return;
      }

      // Efficient random selection using skip
      const skip = Math.floor(Math.random() * count);
      const randomCase = await prisma.patientEncounterCase.findFirst({
        skip: skip,
      });

      res.json(randomCase);
      return;
    } catch (error) {
      console.error('Error fetching random case:', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  }
);

// Create or get active session
router.post(
  '/session',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const body = getBody<{ caseId: string }>(req);
      const caseId = body?.caseId;

      if (!process.env.DATABASE_URL) {
        res.json({ success: true, sessionId: 'mock-session-id' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { clerkId: userId } });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Check for existing active session for this case
      const existingSession = await prisma.patientEncounterSession.findFirst({
        where: {
          userId: user.id,
          caseId: caseId,
          status: 'active',
        },
      });

      if (existingSession) {
        res.json({ success: true, session: existingSession });
        return;
      }

      const now = new Date();
      // Create new session (updatedAt required by schema)
      const session = await prisma.patientEncounterSession.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          caseId,
          messages: [],
          status: 'active',
          updatedAt: now,
        },
      });

      res.json({ success: true, session });
      return;
    } catch (error) {
      console.error('Error creating OSCE session:', error);
      res.status(500).json({ error: 'Failed to create session' });
      return;
    }
  }
);

// Get active session details (ownership enforced)
router.get(
  '/session/:sessionId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { sessionId } = req.params;

      if (!process.env.DATABASE_URL) {
        res.json({ success: true, session: null });
        return;
      }

      const user = await prisma.user.findUnique({ where: { clerkId: userId } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const session = await prisma.patientEncounterSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== user.id) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({ success: true, session });
      return;
    } catch (error) {
      console.error('Error fetching OSCE session:', error);
      res.status(500).json({ error: 'Failed to fetch session' });
      return;
    }
  }
);

// Append chat message (ownership enforced)
router.post(
  '/chat',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const body = getBody<{ sessionId: string; messages: unknown[] }>(req);
      const { sessionId, messages } = body ?? {};

      if (!process.env.DATABASE_URL) {
        res.json({ success: true });
        return;
      }

      const user = await prisma.user.findUnique({ where: { clerkId: userId } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const updated = await prisma.patientEncounterSession.updateMany({
        where: { id: sessionId, userId: user.id },
        data: {
          messages: messages ?? [],
          updatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({ success: true });
      return;
    } catch (error) {
      console.error('Error saving OSCE chat:', error);
      res.status(500).json({ error: 'Failed to save chat' });
      return;
    }
  }
);

// Complete session (ownership enforced)
router.post(
  '/complete',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const body = getBody<{ sessionId: string; diagnosis?: string; treatmentPlan?: string }>(req);
      const { sessionId, diagnosis, treatmentPlan } = body ?? {};

      if (!process.env.DATABASE_URL) {
        res.json({ success: true });
        return;
      }

      const user = await prisma.user.findUnique({ where: { clerkId: userId } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const updated = await prisma.patientEncounterSession.updateMany({
        where: { id: sessionId, userId: user.id },
        data: {
          status: 'completed',
          diagnosis,
          treatmentPlan,
          updatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({ success: true });
      return;
    } catch (error) {
      console.error('Error completing OSCE session:', error);
      res.status(500).json({ error: 'Failed to complete session' });
      return;
    }
  }
);

export default router;
