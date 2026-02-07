/**
 * Reference Data Routes
 *
 * Handles all reference data API endpoints (anatomy, special tests, physiology, etc).
 * Extracted from server.ts for modularity.
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';

const router = Router();

// Anatomy
router.get('/anatomy', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { referenceService } = await import('../lib/services/referenceService');
    const { system, query } = req.query;
    if (query) {
      const results = await referenceService.searchAnatomy(query as string);
      res.json({ success: true, data: results });
    } else {
      const results = await referenceService.getAnatomyStructures((system as string) ?? '');
      res.json({ success: true, data: results });
    }
  } catch (error) {
    console.error('Error fetching anatomy:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anatomy' });
  }
});

router.get('/anatomy/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { referenceService } = await import('../lib/services/referenceService');
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ success: false, error: 'id is required' });
      return;
    }
    const result = await referenceService.getAnatomyStructure(id);
    if (!result) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching anatomy detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anatomy detail' });
  }
});

// Special Tests
router.get('/special-tests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('../lib/services/referenceService');
    const { system } = req.query;
    const results = await referenceService.getSpecialTests(system as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching special tests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch special tests' });
  }
});

// Physiology
router.get('/physiology', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('../lib/services/referenceService');
    const { category } = req.query;
    const results = await referenceService.getPhysiologyConcepts(category as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching physiology:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch physiology' });
  }
});

// Treatments
router.get('/treatments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('../lib/services/referenceService');
    const { category } = req.query;
    const results = await referenceService.getTreatments(category as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching treatments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch treatments' });
  }
});

// Differentials
router.get('/differentials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('../lib/services/referenceService');
    const { category } = req.query;
    const results = await referenceService.getDifferentials(
      category ? { category: category as string } : undefined
    );
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching differentials:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch differentials' });
  }
});

// Imaging
router.get('/imaging', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('../lib/services/referenceService');
    const { modality } = req.query;
    const results = await referenceService.getImagingStudies(modality as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching imaging:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch imaging' });
  }
});

// Findings
router.get('/findings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('../lib/services/referenceService');
    const { system } = req.query;
    const results = await referenceService.getFindings(system as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching findings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch findings' });
  }
});

// Guidelines
router.get('/guidelines', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referenceService } = await import('../lib/services/referenceService');
    const { category } = req.query;
    const results = await referenceService.getGuidelines(category as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching guidelines:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch guidelines' });
  }
});

export default router;
