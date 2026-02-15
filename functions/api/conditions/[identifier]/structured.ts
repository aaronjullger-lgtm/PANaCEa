/**
 * GET /api/conditions/:identifier/structured
 * Smart Condition Page: Parse condition text into PANCE task-category JSON via Gemini.
 * Returns { clinical_pearls, history_key_features, physical_exam_findings, diagnostic_labs,
 *   gold_standard, treatment_first_line } for card-based UI and hide/reveal.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const PARSE_MODEL = 'gemini-2.0-flash-exp';

const StructuredSchema = z.object({
  params: z.object({
    identifier: z.string().min(1),
  }),
});

function buildRawTextFromContent(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join('\n');
  }
  if (typeof content === 'object') {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(content)) {
      if (val == null) continue;
      if (typeof val === 'string') parts.push(`${key}:\n${val}`);
      else if (Array.isArray(val))
        parts.push(
          `${key}:\n${val.map((v) => (typeof v === 'string' ? v : String(v))).join('\n')}`
        );
      else parts.push(`${key}:\n${JSON.stringify(val)}`);
    }
    return parts.join('\n\n');
  }
  return String(content);
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  StructuredSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/conditions/[identifier]/structured');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const identifier = decodeURIComponent(validated.params.identifier).trim();

      const row = await prisma.medicalContent.findFirst({
        where: {
          OR: [
            { conditionId: { equals: identifier, mode: 'insensitive' } },
            { condition: { equals: identifier, mode: 'insensitive' } },
          ],
          status: 'published',
        },
        select: {
          id: true,
          condition: true,
          content: true,
          overview: true,
          pathophysiology: true,
          symptoms: true,
          physicalExam: true,
          diagnostics: true,
          treatment: true,
          differentialDiagnosis: true,
          gold_standard_dx: true,
          first_line_rx: true,
          clinical_pearls: true,
          best_initial_test: true,
        },
      });

      if (!row) {
        return new Response(JSON.stringify({ error: 'Condition not found', identifier }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let rawText = buildRawTextFromContent(row.content);
      if (!rawText.trim()) {
        const flatParts: string[] = [];
        if (row.overview) flatParts.push(`Overview:\n${row.overview}`);
        if (row.pathophysiology) flatParts.push(`Pathophysiology:\n${row.pathophysiology}`);
        if (row.symptoms) flatParts.push(`Symptoms:\n${row.symptoms}`);
        if (row.physicalExam) flatParts.push(`Physical Exam:\n${row.physicalExam}`);
        if (row.diagnostics) flatParts.push(`Diagnostics:\n${row.diagnostics}`);
        if (row.treatment) flatParts.push(`Treatment:\n${row.treatment}`);
        if (row.differentialDiagnosis)
          flatParts.push(`Differential:\n${row.differentialDiagnosis}`);
        if (row.gold_standard_dx) flatParts.push(`Gold Standard: ${row.gold_standard_dx}`);
        if (row.first_line_rx) flatParts.push(`First-line Rx: ${row.first_line_rx}`);
        if (row.best_initial_test) flatParts.push(`Best Initial Test: ${row.best_initial_test}`);
        rawText = flatParts.join('\n\n');
      }

      if (!rawText.trim()) {
        return new Response(
          JSON.stringify({
            data: {
              clinical_pearls: [],
              history_key_features: [],
              physical_exam_findings: [],
              diagnostic_labs: [],
              gold_standard: row.gold_standard_dx ?? '',
              treatment_first_line: row.first_line_rx ?? '',
            },
            source: 'fallback',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const prompt = `Parse the following medical condition content into a strict JSON schema. Extract only from the text; do not invent.

Condition: ${row.condition}

Raw content:
${rawText.slice(0, 28000)}

Return a JSON object with exactly these keys (arrays of strings unless noted):
- clinical_pearls: string[]
- history_key_features: string[]
- physical_exam_findings: string[]
- diagnostic_labs: string[]
- gold_standard: string (single best diagnostic)
- treatment_first_line: string (single first-line treatment)

Output valid JSON only, no markdown.`;

      const res = await fetch(
        `${GEMINI_BASE}/v1beta/models/${PARSE_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        logger.warn('Gemini structured parse failed', {
          status: res.status,
          text: text.slice(0, 200),
        });
        return new Response(
          JSON.stringify({
            data: {
              clinical_pearls: [],
              history_key_features: [],
              physical_exam_findings: [],
              diagnostic_labs: [],
              gold_standard: row.gold_standard_dx ?? '',
              treatment_first_line: row.first_line_rx ?? '',
            },
            source: 'fallback',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .filter(Boolean)
          .join('')
          ?.trim() ?? '';

      let parsed: {
        clinical_pearls: string[];
        history_key_features: string[];
        physical_exam_findings: string[];
        diagnostic_labs: string[];
        gold_standard: string;
        treatment_first_line: string;
      } = {
        clinical_pearls: [],
        history_key_features: [],
        physical_exam_findings: [],
        diagnostic_labs: [],
        gold_standard: row.gold_standard_dx ?? '',
        treatment_first_line: row.first_line_rx ?? '',
      };

      try {
        const decoded = JSON.parse(text) as typeof parsed;
        parsed = {
          clinical_pearls: Array.isArray(decoded.clinical_pearls) ? decoded.clinical_pearls : [],
          history_key_features: Array.isArray(decoded.history_key_features)
            ? decoded.history_key_features
            : [],
          physical_exam_findings: Array.isArray(decoded.physical_exam_findings)
            ? decoded.physical_exam_findings
            : [],
          diagnostic_labs: Array.isArray(decoded.diagnostic_labs) ? decoded.diagnostic_labs : [],
          gold_standard:
            typeof decoded.gold_standard === 'string'
              ? decoded.gold_standard
              : parsed.gold_standard,
          treatment_first_line:
            typeof decoded.treatment_first_line === 'string'
              ? decoded.treatment_first_line
              : parsed.treatment_first_line,
        };
      } catch {
        logger.warn('Structured JSON parse failed', { text: text.slice(0, 150) });
      }

      logger.info('Structured condition returned', {
        identifier,
        userId: auth.userId?.substring(0, 10),
      });

      return new Response(JSON.stringify({ data: parsed, source: 'gemini' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Structured condition error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to get structured condition');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
