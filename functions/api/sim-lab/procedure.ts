/**
 * API: Sim Lab Procedures
 * GET /api/sim-lab/procedure
 *
 * Fetches procedural workflows for digital simulation.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

export const onRequestOptions = withCors();

// GET: Fetch procedure workflow
export const onRequestGet = authenticatedEndpoint(z.object({}), async ({ env, auth }) => {
  const log = createEndpointLogger('/api/sim-lab/procedure', auth.userId);

  // Sample procedure (in production, fetch from database or generate with bring_any_idea_to_life)
  const sampleProcedure = {
    id: 'central-line-001',
    name: 'Central Line Placement',
    category: 'vascular_access',
    description: 'Ultrasound-guided central venous catheter placement',
    steps: [
      {
        stepNumber: 1,
        name: 'Equipment Setup',
        instructions: 'Select all required equipment',
        criticalActions: ['Central line kit', 'Ultrasound', 'Sterile gown'],
        timeEstimate: 180,
      },
      {
        stepNumber: 2,
        name: 'Patient Positioning',
        instructions: 'Trendelenburg with head turned away',
        criticalActions: ['Position patient', 'Ensure airway'],
        timeEstimate: 60,
      },
      {
        stepNumber: 3,
        name: 'Sterile Technique',
        instructions: 'Maintain sterile field throughout',
        criticalActions: ['Maintain sterility', 'No contamination'],
        timeEstimate: 300,
      },
    ],
    requiredEquipment: [
      { id: 'central-line-kit', name: 'Central Line Kit', isSterile: true },
      { id: 'ultrasound', name: 'Ultrasound Machine', isSterile: false },
      { id: 'sterile-gown', name: 'Sterile Gown', isSterile: true },
      { id: 'sterile-gloves', name: 'Sterile Gloves', isSterile: true },
      { id: 'chlorhexidine', name: 'Chlorhexidine', isSterile: false },
    ],
    difficulty: 'advanced',
  };

  log.info('Returning sim lab procedure');
  return { data: { success: true, procedure: sampleProcedure } };
});
