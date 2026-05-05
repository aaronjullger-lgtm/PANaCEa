/**
 * GET /api/conditions/:identifier/structured
 * Smart Condition Page: Parse condition text into PANCE task-category JSON via Gemini.
 * Returns { clinical_pearls, history_key_features, physical_exam_findings, diagnostic_labs,
 *   gold_standard, treatment_first_line } for card-based UI and hide/reveal.
 */

import { z } from 'zod';
import { aiEndpoint } from '../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { gateway, GatewayError, toGatewayContext } from '../../../../lib/ai/aiGateway';

const StructuredSchema = z.object({
  params: z.object({
    identifier: z.string().min(1),
  }),
});

const StructuredConditionSchema = z.object({
  clinical_pearls: z.array(z.string()).default([]),
  history_key_features: z.array(z.string()).default([]),
  physical_exam_findings: z.array(z.string()).default([]),
  diagnostic_labs: z.array(z.string()).default([]),
  gold_standard: z.string().default(''),
  treatment_first_line: z.string().default(''),
});

type StructuredCondition = z.infer<typeof StructuredConditionSchema>;

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

function fallbackStructuredCondition(row: {
  gold_standard_dx: string | null;
  first_line_rx: string | null;
}): StructuredCondition & { source: 'fallback' } {
  return {
    clinical_pearls: [],
    history_key_features: [],
    physical_exam_findings: [],
    diagnostic_labs: [],
    gold_standard: row.gold_standard_dx ?? '',
    treatment_first_line: row.first_line_rx ?? '',
    source: 'fallback',
  };
}

export const onRequestGet = aiEndpoint(
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
        return fail(ErrorCode.NOT_FOUND, { message: `Condition not found: ${identifier}` });
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
        return ok(fallbackStructuredCondition(row), {
          headers: { 'Cache-Control': 'public, max-age=3600' },
        });
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

      let parsed: StructuredCondition;
      try {
        const result = await gateway.callStructured(toGatewayContext(context), {
          mode: 'structured',
          task: 'extraction',
          tier: 'balanced',
          endpoint: '/api/conditions/[identifier]/structured',
          userPrompt: prompt,
          temperature: 0.2,
          maxOutputTokens: 2048,
          schema: StructuredConditionSchema,
          schemaDescription:
            'Structured PANCE condition card fields: clinical_pearls, history_key_features, physical_exam_findings, diagnostic_labs, gold_standard, treatment_first_line.',
        });
        const decoded = result.data;
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
              : row.first_line_rx ?? '',
        };
      } catch (err) {
        if (err instanceof GatewayError) {
          logger.warn('Gateway structured condition parse failed', {
            code: err.code,
            requestId: err.requestId,
            traceId: err.traceId,
          });
        } else {
          logger.warn('Structured condition parse failed', {
            message: err instanceof Error ? err.message : String(err),
          });
        }
        return ok(fallbackStructuredCondition(row), {
          headers: { 'Cache-Control': 'public, max-age=900' },
        });
      }

      logger.info('Structured condition returned', {
        identifier,
        userId: auth.userId?.substring(0, 10),
      });

      return ok(
        { ...parsed, source: 'gateway' },
        { headers: { 'Cache-Control': 'public, max-age=3600' } }
      );
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
