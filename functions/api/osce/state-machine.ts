/**
 * API: Generate State Machine for Case
 * POST /api/osce/state-machine
 *
 * Generates a PatientAVStateMachine using Gemini for a given case.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

const StateMachineBodySchema = z.object({
  body: z.object({
    chiefComplaint: z.string(),
    diagnosis: z.string(),
    patientAge: z.number().optional(),
    patientSex: z.enum(['M', 'F']).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  StateMachineBodySchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/osce/state-machine', auth.userId);

    const { chiefComplaint, diagnosis, patientAge = 60, patientSex = 'M' } = validated.body;

    log.info('Generating state machine', { chiefComplaint, diagnosis });

    const prompt = `You are a clinical simulation expert. Generate a JSON state machine for a patient encounter simulation.

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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (!response.ok) {
        log.error('Gemini API error', { status: response.status });
        return { status: 500, error: 'Failed to generate state machine' };
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/```json|```/gi, '').trim();
      const stateMachine = JSON.parse(cleaned);

      log.info('State machine generated successfully');
      return { data: { success: true, stateMachine } };
    } catch (error: any) {
      log.error('Error generating state machine', error);
      return { status: 500, error: 'Internal server error' };
    }
  }
);
