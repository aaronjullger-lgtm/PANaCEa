/**
 * OSCE Routes
 *
 * Handles all Patient Encounter / OSCE related API endpoints.
 * Extracted from server.ts for modularity.
 */

import { v4 as uuidv4 } from 'uuid';
import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';

const router = Router();

// Get a random patient encounter case
router.get('/cases/random', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const count = await prisma.patientEncounterCase.count();
    if (count === 0) {
      return res.status(404).json({ error: 'No cases found' });
    }

    // Efficient random selection using skip
    const skip = Math.floor(Math.random() * count);
    const randomCase = await prisma.patientEncounterCase.findFirst({
      skip: skip,
    });

    res.json(randomCase);
  } catch (error) {
    console.error('Error fetching random case:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or get active session
router.post('/session', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;
    const { caseId } = req.body;

    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, sessionId: 'mock-session-id' });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check for existing active session for this case
    const existingSession = await prisma.patientEncounterSession.findFirst({
      where: {
        userId: user.id,
        caseId: caseId,
        status: 'active',
      },
    });

    if (existingSession) {
      return res.json({ success: true, session: existingSession });
    }

    // Create new session
    const session = await prisma.patientEncounterSession.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        caseId,
        messages: [],
        status: 'active',
      },
    });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error creating OSCE session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get active session details
router.get('/session/:sessionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, session: null });
    }

    const session = await prisma.patientEncounterSession.findUnique({
      where: { id: sessionId },
    });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error fetching OSCE session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Append chat message
router.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, messages } = req.body; // messages is array of new messages or full history

    if (!process.env.DATABASE_URL) {
      return res.json({ success: true });
    }

    // Update session messages
    await prisma.patientEncounterSession.update({
      where: { id: sessionId },
      data: {
        messages: messages,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving OSCE chat:', error);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

// Complete session
router.post('/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, diagnosis, treatmentPlan } = req.body;

    if (!process.env.DATABASE_URL) {
      return res.json({ success: true });
    }

    await prisma.patientEncounterSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        diagnosis,
        treatmentPlan,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing OSCE session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

export default router;
