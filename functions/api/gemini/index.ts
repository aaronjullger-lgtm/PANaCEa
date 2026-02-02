/**
 * API Endpoint: /api/gemini
 * POST: Non-streaming Gemini AI proxy endpoint
 *
 * This endpoint handles synchronous (non-streaming) requests to the Gemini API.
 * For streaming responses, use /api/gemini/stream instead.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: unknown;
}

const GeminiRequestSchema = z.object({
  modelName: z.string().optional().default('gemini-2.0-flash'),
  prompt: z.string().min(1, 'Prompt is required'),
  temperature: z.number().min(0).max(2).optional().default(0.8),
  maxTokens: z.number().int().min(1).max(8192).optional().default(2048),
  systemInstruction: z.string().optional(),
  /** Optional: use Gemini context cache (e.g. cachedContents/xxx) for "Chat with your Library" */
  cachedContent: z.string().min(1).startsWith('cachedContents/').optional(),
  /** Optional: Gemini 3 thinking level for reasoning control */
  thinkingLevel: z.enum(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']).optional(),
});

// Handle CORS preflight
export const onRequestOptions = withCors();

/**
 * POST /api/gemini
 * Synchronous Gemini API proxy (requires authentication)
 */
export const onRequestPost = authenticatedEndpoint(GeminiRequestSchema, async (context) => {
  const { request, env, validated } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof GeminiRequestSchema>;
  };

  // Validate required environment variables early (fail-fast)
  try {
    validateFunctionEnv(env, 'GEMINI');
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return error.toResponse();
    }
    throw error;
  }

  // Rate limit AI requests (user ID if available, else IP)
  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(
    env,
    identifier,
    'gemini'
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { modelName, prompt, temperature, maxTokens, systemInstruction, cachedContent, thinkingLevel } =
    validated;
  const apiKey = env.GEMINI_API_KEY;

  try {
    // Construct Gemini API URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // Build request body.
    // For visual drills (ECG/imaging/derm), contents[0].parts can include inlineData with
    // base64 image (mimeType + data) so the model can describe findings; keep payload
    // within Edge size limits (e.g. ~4MB request body).
    // When cachedContent is set, Gemini uses the cache as context; only the new turn is sent in contents.
    const requestBody: Record<string, unknown> = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
      },
    };

    if (cachedContent) {
      requestBody.cachedContent = cachedContent;
    }

    if (thinkingLevel) {
      requestBody.thinkingConfig = { thinkingLevel };
    }

    // Add system instruction if provided (ignored when cachedContent already has one)
    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    // Call Gemini API
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Handle non-OK responses
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      const statusCode = geminiResponse.status;

      console.error(`[Gemini] API error ${statusCode}:`, errorText);

      // Map Gemini errors to appropriate status codes
      if (statusCode === 429) {
        return {
          status: 429,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      if (statusCode === 401 || statusCode === 403) {
        return {
          status: 500,
          error: 'API authentication failed. Please contact support.',
        };
      }

      return {
        status: statusCode >= 500 ? 503 : 500,
        error: `Gemini API error: ${statusCode}`,
      };
    }

    // Parse response
    const responseData = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
        finishReason?: string;
      }>;
      promptFeedback?: {
        blockReason?: string;
      };
    };

    // Check for blocked content
    if (responseData.promptFeedback?.blockReason) {
      return {
        status: 400,
        error: `Content blocked: ${responseData.promptFeedback.blockReason}`,
      };
    }

    // Extract generated text
    const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.error('[Gemini] No text in response:', responseData);
      return {
        status: 500,
        error: 'No response generated. Please try again.',
      };
    }

    return new Response(
      JSON.stringify({
        data: {
          text: generatedText,
          model: modelName,
          finishReason: responseData.candidates?.[0]?.finishReason,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitHeaders,
        },
      }
    );
  } catch (error) {
    console.error('[Gemini] Unexpected error:', error);
    return {
      status: 500,
      error: 'Failed to process request. Please try again.',
    };
  }
});
