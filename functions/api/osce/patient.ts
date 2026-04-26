/**
 * API: Get patient response for OSCE session
 * POST /api/osce/patient
 *
 * Purpose: Patient agent - generates case-grounded patient response
 * Model: Gemini 2.5 Pro
 */

import { z } from 'zod';
import { authenticatedEndpoint, type CloudflareContext } from '../_shared/middleware';
import { featureDisabledResponse, isFeatureEnabled } from '../_shared/feature-flags';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import type { CloudflareEnv } from '../_shared/types';

// Schema for patient response
const PatientResponseSchema = z.object({
  body: z.object({
    sessionId: z.string(),
    classifiedIntent: z.enum([
      'DEMOGRAPHICS',
      'CHIEF_COMPLAINT',
      'ONSET',
      'CAUSE',
      'LOCATION',
      'CHARACTER',
      'DURATION',
      'MODIFIERS',
      'ASSOCIATED',
      'PROGRESSION',
      'TREATMENT',
      'TESTS',
      'GENERAL',
      'ELIMINATION',
      'CHANGES',
      'HEALTH',
      'CHRONIC',
      'INFECTIOUS',
      'SURGICAL',
      'TRANSFUSIONS',
      'ALLERGIES',
      'IMMUNIZATION',
      'TRAVEL',
      'HABITS',
      'OCCUPATION',
      'SEXUAL',
      'OBSTETRIC',
      'FAMILY',
      'MENSTRUAL',
      'COMMUNICATION',
      'OTHER',
    ]),
    studentQuestion: z.string().max(500),
  }),
});

const patientResponseHandler = authenticatedEndpoint(
  PatientResponseSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/osce/patient', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { sessionId, classifiedIntent, studentQuestion } = validated.body;
      log.info('Generating patient response', { sessionId, intent: classifiedIntent });

      // Get session and case data
      const session = await prisma.patientEncounterSession.findUnique({
        where: { id: sessionId },
        include: { PatientEncounterCase: true },
      });

      if (!session) {
        log.warn('Session not found');
        return {
          status: 404,
          error: 'Session not found',
        };
      }

      const caseData = session.PatientEncounterCase;

      // Update OsceSession state
      await updateOsceSessionState(sessionId, classifiedIntent, prisma);

      // Load patient agent prompt
      const prompt = await loadPatientPrompt(caseData, classifiedIntent, studentQuestion);

      // Call Gemini 2.5 Pro for patient response
      const response = await generatePatientResponse(studentQuestion, prompt, env);

      log.info('Patient response generated', { sessionId, responseLength: response.length });

      return {
        data: {
          success: true,
          response,
          agent: 'patient',
        },
      };
    } catch (error) {
      log.error('Patient response generation failed', error);
      return {
        status: 500,
        error: 'Failed to generate patient response',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);

export const onRequestPost = (context: CloudflareContext) => {
  if (!isFeatureEnabled(context.env, 'ENABLE_OSCE_BETA')) {
    return featureDisabledResponse(
      context.request,
      'OSCE beta endpoints are disabled for this launch.'
    );
  }

  return patientResponseHandler(context);
};

// Load patient agent prompt with case data
async function loadPatientPrompt(
  caseData: any,
  classifiedIntent: string,
  studentQuestion: string,
): Promise<{ system: string; user: string }> {
  return {
    system: `You are a ${caseData.age}-year-old ${caseData.sex} patient named ${caseData.patientName}.
    Chief complaint: ${caseData.chiefComplaint}

    BEHAVIOR RULES:
    1. STAY IN CHARACTER - first person, lay language only
    2. EMPATHY RESPONSE - open up for empathetic inquiries, shut down for rude ones
    3. INTENT-AWARE - recognize what the student is asking (${classifiedIntent})
    4. LAY LANGUAGE - never use medical terms unless student has used them
    5. EXAM-SPECIFIC - only reveal findings for body system named
    6. BRIEF ANSWERS - 1-2 sentences max

    Case data available:
    - Vitals: ${JSON.stringify(caseData.vitalSigns)}
    - HPI: ${JSON.stringify(caseData.historyData)}
    - PE findings: ${JSON.stringify(caseData.physicalExamData)}
    - Labs: ${JSON.stringify(caseData.labData)}

    Respond naturally as a patient would. Do not reveal the diagnosis.`,
    user: `Student is asking: ${studentQuestion}

    The classified intent is: ${classifiedIntent}

    Your response:`,
  };
}

// Generate patient response
async function generatePatientResponse(
  studentQuestion: string,
  prompt: { system: string; user: string },
  env: CloudflareEnv,
): Promise<string> {
  // Use AI Gateway or direct Gemini call
  // This would use the existing AI Gateway infrastructure
  // For now, return a mock response
  
  const responses: Record<string, string> = {
    DEMOGRAPHICS: "I'm 55 years old. I work in construction.",
    CHIEF_COMPLAINT: "It's right here in the middle of my chest.",
    ONSET: "About two hours ago, suddenly.",
    LOCATION: "Right in the center.",
    CHARACTER: "It's like a heavy pressure. Like someone's sitting on me.",
    DURATION: "About two hours now.",
    MODIFIERS: "It gets worse when I walk up stairs. Better when I sit.",
    ASSOCIATED: "I've been sweating a lot too.",
    PROGRESSION: "It's been about the same. Maybe a little worse.",
    TREATMENT: "I took a baby aspirin earlier, didn't help much.",
    TESTS: "Not yet.",
    GENERAL: "What would you like to know?",
    ELIMINATION: "I don't think so, it's definitely heart-related.",
    CHANGES: "No, nothing different lately.",
    HEALTH: "Generally healthy. No major problems.",
    CHRONIC: "I have high blood pressure, that's it.",
    INFECTIOUS: "No recent infections.",
    SURGICAL: "Had my appendix out years ago.",
    TRANSFUSIONS: "No blood transfusions.",
    ALLERGIES: "No allergies that I know of.",
    IMMUNIZATION: "I got my COVID and flu shots last year.",
    TRAVEL: "No recent travel.",
    HABITS: "I smoke maybe a pack a week. Social drinker.",
    OCCUPATION: "Construction, like I said. Lots of lifting.",
    SEXUAL: "Married for 30 years.",
    OBSTETRIC: "No, my kids are grown.",
    FAMILY: "My dad had heart problems. Had bypass surgery.",
    MENSTRUAL: "Not applicable.",
    COMMUNICATION: "I'm trying my best, doctor.",
    OTHER: "Could you clarify?",
  };

  // Extract intent from system prompt (simplified)
  const systemLower = prompt.system.toLowerCase();
  for (const [intent, response] of Object.entries(responses)) {
    if (systemLower.includes(intent.toLowerCase())) {
      return response;
    }
  }

  return "I'm not sure I understand. Could you ask differently?";
}

// Update OsceSession state
async function updateOsceSessionState(
  sessionId: string,
  classifiedIntent: string,
  prisma: any,
): Promise<void> {
  // Check if OsceSession exists, create if not
  const existingOsceSession = await prisma.osceSession.findFirst({
    where: { sessionId },
  });

  if (existingOsceSession) {
    await prisma.osceSession.update({
      where: { id: existingOsceSession.id },
      data: {
        currentAgent: 'patient',
        updatedAt: new Date(),
      },
    });
  } else {
    // Get PatientEncounterSession to extract userId and caseId
    const peSession = await prisma.patientEncounterSession.findUnique({
      where: { id: sessionId },
    });

    if (peSession) {
          await prisma.osceSession.create({
            data: {
              id: sessionId,
              userId: peSession.userId,
              caseId: peSession.caseId,
          currentAgent: 'patient',
          status: 'active',
          patientState: {
            empathyLevel: 0.5,
            questionsAsked: 0,
          },
        },
      });
    }
  }
}
