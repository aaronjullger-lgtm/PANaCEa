/**
 * POST /api/scribe/soap/extract
 *
 * Server-side SOAP note extraction for the Smart Scribe real-time dictation
 * engine. Replaces the browser-side call that used to ship VITE_GEMINI_API_KEY
 * to the client and fetch generativelanguage.googleapis.com directly.
 *
 * Migration notes (Sprint 4 — AI Gateway):
 *   - All model access flows through `gateway.extract()`. No browser-side key
 *     material, no raw fetch, no ad-hoc JSON.parse on model output.
 *   - Structured output validated against SoapScribeExtractionSchema (a
 *     permissive top-level shape — see the schema file for why). A single
 *     schema-repair pass is allowed; failures surface as 422.
 *   - The response shape is `{ data: SoapScribeExtraction }`. The client
 *     `mergeNotes()` routine still does the deep merge against the current
 *     note — the endpoint is intentionally merge-agnostic.
 *   - Rate-limited via the shared KV middleware; auth via Clerk.
 *
 * Request body:
 *   {
 *     "context": string,      // transcript + vitals + physical findings block
 *     "currentNote": object,  // caller-side SOAPNote for model context
 *   }
 *
 * Response:
 *   200 { data: SoapScribeExtraction }
 *   422 { error: 'The scribe returned a malformed response. Please try again.' }
 *   429 { error: 'Scribe is rate-limited right now — please try again shortly.' }
 *   502 { error: `Extraction failed: <code>` }
 *   500 { error: 'Unexpected extraction failure' }
 */

import { z } from 'zod';
import { aiEndpoint } from '../../_shared/middleware';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';
import {
  SoapScribeExtractionSchema,
  SOAP_SCRIBE_EXTRACTION_DESCRIPTION,
} from '@/lib/ai/schemas/extraction';

const bodySchema = z.object({
  context: z.string().min(1, 'Context is required').max(20_000, 'Context too large'),
  // The current SOAPNote is used only as context for the extraction model;
  // we don't try to validate its shape here (see extraction schema for why).
  currentNote: z.unknown(),
});

const SYSTEM_PROMPT = `You are a medical scribe working alongside a Physician Assistant student during a patient encounter.

Your job is to extract SOAP note elements from the live clinical transcript, vitals, and physical exam findings.

Rules:
- Only include information that was explicitly stated or can be confidently inferred from the provided context.
- Never invent findings, diagnoses, labs, or vital values.
- Return a JSON object with any SOAP section keys that changed. Omit a section entirely if no new information was heard for it.
- Inner shapes for each section should follow the SOAPNote contract inferred from the "Current SOAP note" that is provided in the prompt.
- Return ONLY the JSON object — no prose, no markdown, no code fence.`;

function buildUserPrompt(args: { context: string; currentNote: unknown }): string {
  const currentNoteStr = JSON.stringify(args.currentNote, null, 2);
  return `Clinical context:
"""
${args.context.trim()}
"""

Current SOAP note (update only what the context tells you to change):
"""
${currentNoteStr}
"""

Return ONLY a JSON object conforming to this schema:
${SOAP_SCRIBE_EXTRACTION_DESCRIPTION}`;
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): Smart Scribe SOAP
// extraction goes through gateway.extract() → Gemini. 25 rpm 'ai' bucket.
export const onRequestPost = aiEndpoint(
  bodySchema,
  async (context) => {
    const { context: clinicalContext, currentNote } = context.validated;

    try {
      const { data } = await gateway.extract(toGatewayContext(context), {
        endpoint: '/api/scribe/soap/extract',
        schema: SoapScribeExtractionSchema,
        schemaDescription: SOAP_SCRIBE_EXTRACTION_DESCRIPTION,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt({ context: clinicalContext, currentNote }),
        temperature: 0.2,
        maxOutputTokens: 3072,
      });

      return {
        status: 200,
        data,
      };
    } catch (error) {
      if (error instanceof GatewayError) {
        console.error('[scribe/soap/extract] gateway failure', {
          code: error.code,
          requestId: error.requestId,
          traceId: error.traceId,
          message: error.message,
        });
        if (error.code === 'RATE_LIMITED') {
          return {
            status: 429,
            error: 'Scribe is rate-limited right now — please try again shortly.',
          };
        }
        if (error.code === 'SCHEMA_INVALID_AFTER_REPAIR') {
          return {
            status: 422,
            error: 'The scribe returned a malformed response. Please try again.',
          };
        }
        return { status: 502, error: `Extraction failed: ${error.code}` };
      }
      console.error('[scribe/soap/extract] unexpected failure:', error);
      return { status: 500, error: 'Unexpected extraction failure' };
    }
  },
  // Scribe polls every ~5s per session; give it a generous per-minute budget.
  { requestsPerMinute: 60 },
);
