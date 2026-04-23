/**
 * API: Clinical Eye Questions
 * GET /api/clinical-eye/question
 *
 * Fetches interactive imaging questions for point-and-click diagnostics.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// GET: Fetch random clinical eye question
export const onRequestGet = authenticatedEndpoint(z.object({}), async ({ env, auth }) => {
  const log = createEndpointLogger('/api/clinical-eye/question', auth.userId);

  // For now, return mock data
  // In production, fetch from database or generate with spatial-understanding

  const sampleQuestion = {
    id: 'clinical-eye-001',
    image: {
      id: 'xray-pneumothorax-001',
      modality: 'chest_xray' as const,
      imageUrl: '/images/sample-chest-xray.jpg',
      dimensions: { width: 1024, height: 1024 },
      findings: [
        {
          id: 'ptx-line',
          name: 'Pneumothorax Line',
          description: 'Visible pleural line with absent lung markings',
          coordinates: {
            type: 'polygon' as const,
            points: [
              { x: 0.65, y: 0.2 },
              { x: 0.7, y: 0.3 },
              { x: 0.68, y: 0.5 },
              { x: 0.63, y: 0.4 },
            ],
          },
          significance: 'critical' as const,
          isPrimary: true,
        },
      ],
      heatmap: {
        imageUrl: '/images/sample-heatmap.png',
        model: 'gemini-pro-vision',
        threshold: 0.7,
      },
    },
    scoring: {
      maxDistanceForCredit: 0.1,
      pointsPerFinding: 100,
      penaltyPerWrongClick: -10,
    },
    maxAttempts: 3,
  };

  log.info('Returning clinical eye question');
  return { data: { success: true, question: sampleQuestion } };
});
