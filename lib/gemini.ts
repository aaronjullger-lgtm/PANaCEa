/**
 * Gemini / Google AI helpers for embeddings (text-embedding-005) and vision (gemini-1.5-pro).
 * Used by RAG chunking, hybrid search, semantic scripts, and image quality assessment.
 */

const EMBED_MODEL = 'text-embedding-005';
const EMBED_DIMS = 768;
const VISION_MODEL = 'gemini-1.5-pro';

/**
 * Generate a 768-d embedding for the given text using Google AI embedContent API.
 * Requires GEMINI_API_KEY (or pass apiKey).
 */
export async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
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
    throw new Error(`Embed API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data: { embedding?: { values?: number[] } } = await res.json();
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new Error(`Invalid embedding: expected ${EMBED_DIMS} dims, got ${values?.length ?? 0}`);
  }
  return values;
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
 * Grade a medical image for educational quality using Gemini 1.5 Pro Vision.
 * 
 * @param imageUrl - Public URL of the image to grade
 * @param conditionName - Medical condition name (e.g., "Pneumonia")
 * @param apiKey - Gemini API key
 * @returns Grade result with educational score and metadata
 */
export async function gradeMedicalImage(
  imageUrl: string,
  conditionName: string,
  apiKey: string
): Promise<GradeResult> {
  // Fetch image as buffer and convert to base64
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image: ${imageRes.status}`);
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
  
  const res = await fetch(url, {
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Vision API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini Vision API');
  }

  // Parse JSON from response (strip markdown fences if present)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('Failed to parse Gemini response as JSON:', text.slice(0, 200));
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
    return {
      isClassic: Boolean(parsed.isClassic),
      educationalScore: Number(parsed.educationalScore) || 0,
      modality: String(parsed.modality || 'unknown'),
      isBlurry: Boolean(parsed.isBlurry),
      isDiagram: Boolean(parsed.isDiagram),
      reasoning: String(parsed.reasoning || ''),
    };
  } catch (error) {
    console.warn('JSON parse error:', error);
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
