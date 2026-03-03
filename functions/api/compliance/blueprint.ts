/**
 * GET /api/compliance/blueprint
 *
 * Blueprint Compliance Auditor endpoint.
 * Returns NCCPA blueprint compliance analysis for MedicalContent and/or Question pool.
 * Admin-only endpoint.
 */

import { z } from 'zod';
import { adminEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  analyzeMedicalContentCompliance,
  analyzeQuestionPoolCompliance,
  generateCorrectiveActions,
  type ComplianceSummary,
} from '../../../services/domain/blueprintComplianceService';

const BlueprintComplianceSchema = z.object({
  type: z.enum(['medical', 'questions', 'both']).optional().default('medical'),
});

export const onRequestOptions = withCors();

export const onRequestGet = adminEndpoint(BlueprintComplianceSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/compliance/blueprint');
  const { type } = validated?.query ?? { type: 'medical' };

  try {
    let medical: ComplianceSummary | null = null;
    let questions: ComplianceSummary | null = null;

    if (type === 'medical' || type === 'both') {
      logger.info('Analyzing MedicalContent compliance');
      medical = await analyzeMedicalContentCompliance(env.DATABASE_URL);
    }
    if (type === 'questions' || type === 'both') {
      logger.info('Analyzing Question pool compliance');
      questions = await analyzeQuestionPoolCompliance(env.DATABASE_URL);
    }

    // Compute corrective actions for each taxonomy
    const medicalCorrectiveActions = medical ? generateCorrectiveActions(medical, 'medical') : null;
    const questionsCorrectiveActions = questions ? generateCorrectiveActions(questions, 'questions') : null;

    const response = {
      success: true,
      data: {
        medical,
        questions,
        medicalCorrectiveActions,
        questionsCorrectiveActions,
        timestamp: new Date().toISOString(),
      },
    };

    logger.info('Blueprint compliance analysis completed', {
      medicalItems: medical?.totalContentItems ?? 0,
      questionItems: questions?.totalContentItems ?? 0,
    });

    return {
      data: response,
      headers: { 'Cache-Control': 'no-store, must-revalidate' },
    };
  } catch (error) {
    logger.error('Blueprint compliance analysis failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 500,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : undefined,
    };
  }
});