/**
 * AI Gateway — Deterministic JSON parser.
 *
 * Every gateway call that expects structured output goes through
 * parseStructured(). It strips markdown fences, finds the first balanced
 * JSON object or array, parses with a tolerant reviver, validates against
 * the caller's Zod schema, and returns a typed Ok or Err result.
 *
 * No caller should ever call JSON.parse on model output directly.
 */

import type { ZodSchema, ZodError } from 'zod';

export type ParseOk<T> = { ok: true; data: T };
export type ParseErr = {
  ok: false;
  stage: 'no_json_found' | 'syntax_error' | 'schema_error';
  rawText: string;
  extractedJson?: string;
  errorMessage: string;
  zodIssues?: ZodError['issues'];
};
export type ParseResult<T> = ParseOk<T> | ParseErr;

/**
 * Pull a JSON object or array out of a string that may contain surrounding
 * prose, markdown fences, explanation text, or reasoning traces.
 *
 * Strategy: strip ```json ... ``` fences, then walk character-by-character to
 * find the first balanced { ... } or [ ... ]. Respects strings and escapes
 * so braces inside strings don't throw off the counter.
 */
export function extractJson(text: string): string | null {
  if (!text) return null;

  // Strip markdown code fences
  let s = text
    .replace(/```json\s*/gi, '')
    .replace(/```typescript\s*/gi, '')
    .replace(/```ts\s*/gi, '')
    .replace(/```\s*$/g, '')
    .replace(/```/g, '')
    .trim();

  // Find first { or [
  let startIdx = -1;
  let openChar: '{' | '[' | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{' || c === '[') {
      startIdx = i;
      openChar = c;
      break;
    }
  }
  if (startIdx < 0 || !openChar) return null;

  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < s.length; i++) {
    const c = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === '\\') {
      escaped = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) {
        return s.slice(startIdx, i + 1);
      }
    }
  }
  return null;
}

/**
 * Parse raw model output into a typed, schema-validated value.
 *
 * Never throws — callers get a discriminated union so they can decide
 * whether to retry with a repair prompt or return a default response.
 */
export function parseStructured<T>(
  rawText: string,
  schema: ZodSchema<T>,
): ParseResult<T> {
  const extracted = extractJson(rawText);
  if (!extracted) {
    return {
      ok: false,
      stage: 'no_json_found',
      rawText,
      errorMessage: 'No JSON object or array found in model output.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch (e) {
    return {
      ok: false,
      stage: 'syntax_error',
      rawText,
      extractedJson: extracted,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }

  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    return {
      ok: false,
      stage: 'schema_error',
      rawText,
      extractedJson: extracted,
      errorMessage: validation.error.message,
      zodIssues: validation.error.issues,
    };
  }

  return { ok: true, data: validation.data };
}

/**
 * Build a repair prompt that tells the model exactly what was wrong with
 * its last response and asks for a corrected, schema-conforming reply.
 * Used by the gateway's single repair attempt before giving up.
 */
export function buildRepairPrompt(
  originalUserPrompt: string,
  failure: ParseErr,
  schemaDescription: string,
): string {
  const problem =
    failure.stage === 'no_json_found'
      ? 'Your previous response did not contain any JSON. Reply with ONLY valid JSON — no prose, no markdown fences, nothing else.'
      : failure.stage === 'syntax_error'
      ? `Your previous response could not be parsed as JSON. Syntax error: ${failure.errorMessage}.`
      : `Your previous response did not match the required schema. Validation errors: ${failure.errorMessage}.`;

  return `${problem}

REQUIRED SCHEMA:
${schemaDescription}

ORIGINAL REQUEST:
${originalUserPrompt}

Reply with ONLY a single JSON ${
    failure.extractedJson?.trim().startsWith('[') ? 'array' : 'object'
  } conforming to the schema. Do not wrap in markdown fences. Do not add commentary.`;
}
