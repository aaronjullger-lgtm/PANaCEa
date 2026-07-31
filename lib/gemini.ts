/**
 * Gemini / Google AI helpers for embeddings (gemini-embedding-2) and vision (gemini-2.5-flash).
 * Used by RAG chunking, hybrid search, semantic scripts, and image quality assessment.
 *
 * Trace propagation: both helpers accept an optional `traceId` (the same id
 * that threads the upstream edge request). It's included in thrown errors and
 * structured timing logs so a slow / failed Gemini call can be correlated
 * back to the originating request in Workers Logs and Sentry.
 */

const EMBED_MODEL = 'gemini-embedding-2';
const EMBED_DIMS = 768;
const VISION_MODEL = 'gemini-2.5-flash';

/** Shared options accepted by every helper in this module. */
export interface GeminiHelperOptions {
  /** Upstream trace id for log correlation. */
  traceId?: string;
}

/**
 * Structured error raised when a Gemini call fails. Carries the HTTP status,
 * truncated upstream message, and the trace id of the originating request so
 * callers can surface it in user-facing errors and Sentry breadcrumbs.
 */
export class GeminiError extends Error {
  readonly status: number;
  readonly traceId?: string;
  readonly operation: string;

  constructor(init: {
    operation: string;
    status: number;
    message: string;
    traceId?: string;
  }) {
    const prefix = init.traceId ? `[trace ${init.traceId}] ` : '';
    super(`${prefix}Gemini ${init.operation} error ${init.status}: ${init.message}`);
    this.name = 'GeminiError';
    this.status = init.status;
    this.traceId = init.traceId;
    this.operation = init.operation;
  }
}

/** Emit a structured JSON span record — picked up by Cloudflare Workers Logs. */
function logGeminiSpan(entry: {
  operation: string;
  durationMs: number;
  status?: number;
  success: boolean;
  traceId?: string;
  error?: string;
}): void {
  // Structured so Workers Logs can filter by `operation`, `success`, `traceId`.
  try {
    console.log(
      JSON.stringify({ event: 'gemini_span', timestamp: new Date().toISOString(), ...entry })
    );
  } catch {
    // If console.log is unavailable (rare), swallow — logging must never fail the call.
  }
}

/**
 * Generate a 768-d embedding for the given text using Google AI embedContent API.
 * Requires GEMINI_API_KEY (or pass apiKey).
 */
export async function getEmbedding(
  text: string,
  apiKey: string,
  options: GeminiHelperOptions = {}
): Promise<number[]> {
  const { traceId } = options;
  const startMs = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIMS,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      const durationMs = Date.now() - startMs;
      logGeminiSpan({
        operation: 'embed',
        durationMs,
        status: res.status,
        success: false,
        traceId,
        error: err.slice(0, 200),
      });
      throw new GeminiError({
        operation: 'embed',
        status: res.status,
        message: err.slice(0, 200),
        traceId,
      });
    }
    const data: { embedding?: { values?: number[] } } = await res.json();
    const values = data.embedding?.values;
    if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
      const durationMs = Date.now() - startMs;
      logGeminiSpan({
        operation: 'embed',
        durationMs,
        status: res.status,
        success: false,
        traceId,
        error: `Invalid embedding dims: expected ${EMBED_DIMS}, got ${values?.length ?? 0}`,
      });
      throw new GeminiError({
        operation: 'embed',
        status: 502,
        message: `Invalid embedding: expected ${EMBED_DIMS} dims, got ${values?.length ?? 0}`,
        traceId,
      });
    }
    logGeminiSpan({
      operation: 'embed',
      durationMs: Date.now() - startMs,
      status: res.status,
      success: true,
      traceId,
    });
    return values;
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    const durationMs = Date.now() - startMs;
    const message = error instanceof Error ? error.message : String(error);
    logGeminiSpan({
      operation: 'embed',
      durationMs,
      success: false,
      traceId,
      error: message.slice(0, 200),
    });
    throw new GeminiError({ operation: 'embed', status: 502, message, traceId });
  }
}

export interface GradeResult {
  isClassic: boolean;
  educationalScore: number; // 1-10 scale
  modality: string;
  isBlurry: boolean;
  isDiagram: boolean;
  reasoning: string;
}

/**
 * Grade a medical image for educational quality using Gemini Vision.
 *
 * @param imageUrl - Public URL of the image to grade
 * @param conditionName - Medical condition name (e.g., "Pneumonia")
 * @param apiKey - Gemini API key
 * @param options - Optional helper options including traceId for log correlation
 * @returns Grade result with educational score and metadata
 */
export async function gradeMedicalImage(
  imageUrl: string,
  conditionName: string,
  apiKey: string,
  options: GeminiHelperOptions = {}
): Promise<GradeResult> {
  const { traceId } = options;
  const startMs = Date.now();

  // Fetch image as buffer and convert to base64
  let imageRes: Response;
  try {
    imageRes = await fetch(imageUrl);
  } catch (error) {
    const durationMs = Date.now() - startMs;
    const message = error instanceof Error ? error.message : String(error);
    logGeminiSpan({
      operation: 'vision-fetch-image',
      durationMs,
      success: false,
      traceId,
      error: message.slice(0, 200),
    });
    throw new GeminiError({
      operation: 'vision-fetch-image',
      status: 502,
      message: `Failed to fetch image: ${message}`,
      traceId,
    });
  }
  if (!imageRes.ok) {
    const durationMs = Date.now() - startMs;
    logGeminiSpan({
      operation: 'vision-fetch-image',
      durationMs,
      status: imageRes.status,
      success: false,
      traceId,
      error: `HTTP ${imageRes.status}`,
    });
    throw new GeminiError({
      operation: 'vision-fetch-image',
      status: imageRes.status,
      message: `Failed to fetch image: ${imageRes.status}`,
      traceId,
    });
  }

  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString('base64');

  // Infer MIME type from URL or default to JPEG
  const mimeType = inferMimeType(imageUrl) || 'image/jpeg';

  const prompt = `You are a medical education editor evaluating images for a clinical reference library.

Analyze this image in the context of **${conditionName}**.

Criteria:
1. **Classic Portrayal**: Does this image clearly demonstrate the hallmark features of ${conditionName}? Would it be the "textbook example" a student should see?
2. **Educational Score (1-10)**: Rate the image's educational value:
   - 9-10: Excellent clarity, classic presentation, ideal for learning
   - 7-8: Good quality, useful for education
   - 5-6: Acceptable but has limitations (e.g., atypical presentation, mild blur)
   - 3-4: Poor quality or unclear relevance
   - 1-2: Not useful for education
3. **Modality**: What imaging modality is this? (e.g., X-ray, CT, MRI, Clinical Photo, Diagram, Microscopy)
4. **Technical Quality**: Is the image blurry or low resolution? Is it a diagram/illustration vs. actual medical image?

Return your assessment as **valid JSON only** (no markdown, no code fences):

{
  "isClassic": boolean,
  "educationalScore": number,
  "modality": string,
  "isBlurry": boolean,
  "isDiagram": boolean,
  "reasoning": string
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2, // Low temperature for consistent grading
          maxOutputTokens: 500,
        },
      }),
    });
  } catch (error) {
    const durationMs = Date.now() - startMs;
    const message = error instanceof Error ? error.message : String(error);
    logGeminiSpan({
      operation: 'vision-grade',
      durationMs,
      success: false,
      traceId,
      error: message.slice(0, 200),
    });
    throw new GeminiError({
      operation: 'vision-grade',
      status: 502,
      message,
      traceId,
    });
  }

  if (!res.ok) {
    const err = await res.text();
    const durationMs = Date.now() - startMs;
    logGeminiSpan({
      operation: 'vision-grade',
      durationMs,
      status: res.status,
      success: false,
      traceId,
      error: err.slice(0, 200),
    });
    throw new GeminiError({
      operation: 'vision-grade',
      status: res.status,
      message: err.slice(0, 200),
      traceId,
    });
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const durationMs = Date.now() - startMs;
    logGeminiSpan({
      operation: 'vision-grade',
      durationMs,
      status: res.status,
      success: false,
      traceId,
      error: 'Empty response',
    });
    throw new GeminiError({
      operation: 'vision-grade',
      status: 502,
      message: 'Empty response from Gemini Vision API',
      traceId,
    });
  }

  // Parse JSON from response (strip markdown fences if present)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const durationMs = Date.now() - startMs;
    logGeminiSpan({
      operation: 'vision-grade',
      durationMs,
      status: res.status,
      success: false,
      traceId,
      error: 'JSON shape missing in response',
    });
    console.warn(
      traceId ? `[trace ${traceId}] ` : '',
      'Failed to parse Gemini response as JSON:',
      text.slice(0, 200)
    );
    return {
      isClassic: false,
      educationalScore: 0,
      modality: 'unknown',
      isBlurry: true,
      isDiagram: false,
      reasoning: 'Failed to parse AI response',
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    logGeminiSpan({
      operation: 'vision-grade',
      durationMs: Date.now() - startMs,
      status: res.status,
      success: true,
      traceId,
    });
    return {
      isClassic: Boolean(parsed.isClassic),
      educationalScore: Number(parsed.educationalScore) || 0,
      modality: String(parsed.modality || 'unknown'),
      isBlurry: Boolean(parsed.isBlurry),
      isDiagram: Boolean(parsed.isDiagram),
      reasoning: String(parsed.reasoning || ''),
    };
  } catch (error) {
    const durationMs = Date.now() - startMs;
    const message = error instanceof Error ? error.message : String(error);
    logGeminiSpan({
      operation: 'vision-grade',
      durationMs,
      status: res.status,
      success: false,
      traceId,
      error: `JSON parse: ${message.slice(0, 150)}`,
    });
    console.warn(traceId ? `[trace ${traceId}] ` : '', 'JSON parse error:', error);
    return {
      isClassic: false,
      educationalScore: 0,
      modality: 'unknown',
      isBlurry: true,
      isDiagram: false,
      reasoning: 'JSON parse error',
    };
  }
}

/**
 * Infer MIME type from file extension in URL.
 */
function inferMimeType(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.webp')) return 'image/webp';
  return null;
}

export const EMBED_DIMENSIONS = EMBED_DIMS;
export const EMBED_MODEL_ID = EMBED_MODEL;
export const VISION_MODEL_ID = VISION_MODEL;
