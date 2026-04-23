/**
 * API: Generate State Machine for Case
 * POST /api/osce/state-machine
 *
 * Generates a PatientAVStateMachine using Gemini for a given case.
 *
 * Sprint 6 migration notes (AI Gateway):
 *   - Direct fetch to `generativelanguage.googleapis.com/v1beta/models/...:
 *     generateContent` replaced by `gateway.callText()` with task='generation'.
 *   - Gateway handles model tier selection, rate-limit backoff, same-provider
 *     fallback, telemetry, and cost tracking for us — state-machine generation
 *     is a bespoke JSON structure so we still parse the text output manually
 *     rather than using `gateway.generate()` with a Zod schema. The trade-off
 *     is no schema-repair pass; we keep a defensive try/catch on JSON.parse.
 *   - `GatewayError` is mapped to the existing 4xx/5xx wire shapes so the
 *     client UI doesn't need to change.
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';

const StateMachineBodySchema = z.object({
  body: z.object({
    chiefComplaint: z.string(),
    diagnosis: z.string(),
    patientAge: z.number().optional(),
    patientSex: z.enum(['M', 'F']).optional(),
  }),
});

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): OSCE state-machine
// generation builds a multi-node dialogue graph via Gemini. 25 rpm 'ai' bucket.
export const onRequestPost = aiEndpoint(
  StateMachineBodySchema,
  async (context) => {
    const { validated, auth } = context;
    const log = createEndpointLogger('/api/osce/state-machine', auth.userId);

    const { chiefComplaint, diagnosis, patientAge = 60, patientSex = 'M' } = validated.body;

    log.info('Generating state machine', { chiefComplaint, diagnosis });

    const systemPrompt =
      'You are a clinical simulation expert generating PatientAVStateMachine JSON for OSCE ' +
      'simulations. Output MUST be valid JSON with no markdown fences or commentary.';

    const userPrompt = `Generate a JSON state machine for a patient encounter simulation.

**Case Details:**
- Chief Complaint: ${chiefComplaint}
- Diagnosis: ${diagnosis}
- Patient: ${patientAge}yo ${patientSex}

Generate a complete PatientAVStateMachine with 3 clinical states:
1. baseline - Initial stable presentation
2. critical - Severe decompensation
3. stabilized - After intervention

Return ONLY valid JSON (no markdown):
{
  "id": "case-${diagnosis.toLowerCase().replace(/\s+/g, '-')}",
  "version": "1.0.0",
  "initialState": "baseline",
  "metadata": {
    "caseId": "generated",
    "patientName": "Test Patient",
    "chiefComplaint": "${chiefComplaint}",
    "createdAt": "${new Date().toISOString()}",
    "updatedAt": "${new Date().toISOString()}"
  },
  "states": {
    "baseline": {
      "id": "baseline",
      "name": "Baseline State",
      "clinicalContext": "Patient presenting with ${chiefComplaint}",
      "voice": {
        "voiceId": "Kore",
        "rate": 1.0,
        "pitch": 0,
        "volume": 0.9,
        "toneDescriptors": ["concerned", "cooperative"],
        "applyVocalStrain": false
      },
      "video": {
        "videoId": "baseline",
        "prompt": "${patientAge}yo ${patientSex} in ED presenting with ${chiefComplaint}",
        "physicalPresentation": "Initial presentation",
        "environment": "emergency_department",
        "duration": 5,
        "transitionType": "immediate",
        "transitionDuration": 0,
        "status": "pending"
      }
    }
  },
  "globalTransitions": [],
  "stateTransitions": {}
}`;

    try {
      const result = await gateway.callText(toGatewayContext(context), {
        mode: 'text',
        task: 'generation',
        endpoint: '/api/osce/state-machine',
        model: 'gemini-2.0-flash-exp',
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxOutputTokens: 4096,
      });

      if (result.blocked) {
        log.warn('State machine generation blocked by safety filter', {
          blockReason: result.blockReason,
        });
        return { status: 422, error: 'State machine generation was blocked. Please retry.' };
      }

      const text = result.text || '';
      if (!text.trim()) {
        log.error('Gateway returned empty state machine text');
        return { status: 502, error: 'State machine generator returned no content' };
      }

      const cleaned = text.replace(/```json|```/gi, '').trim();
      let stateMachine: unknown;
      try {
        stateMachine = JSON.parse(cleaned);
      } catch (parseError) {
        log.error('Failed to parse state machine JSON', parseError, {
          preview: cleaned.slice(0, 200),
        });
        return { status: 502, error: 'State machine generator returned invalid JSON' };
      }

      log.info('State machine generated successfully', {
        model: result.telemetry.modelUsed,
        latencyMs: result.telemetry.latencyMs,
        fallbackUsed: result.telemetry.fallbackUsed,
      });
      return { data: { success: true, stateMachine } };
    } catch (error) {
      if (error instanceof GatewayError) {
        log.error('State machine gateway failure', error, {
          code: error.code,
          requestId: error.requestId,
          traceId: error.traceId,
        });
        if (error.code === 'RATE_LIMITED') {
          return { status: 429, error: 'Generator is busy — please try again shortly.' };
        }
        if (error.code === 'SAFETY_BLOCKED') {
          return { status: 422, error: 'State machine generation was blocked. Please retry.' };
        }
        return { status: 502, error: `State machine generation failed: ${error.code}` };
      }
      log.error('Error generating state machine', error);
      return { status: 500, error: 'Internal server error' };
    }
  }
);
