/**
 * API Endpoint: /api/gemini
 * POST: Non-streaming Gemini AI proxy endpoint
 * 
 * This endpoint handles synchronous (non-streaming) requests to the Gemini API.
 * For streaming responses, use /api/gemini/stream instead.
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';

interface Env {
  GEMINI_API_KEY: string;
}

const GeminiRequestSchema = z.object({
  modelName: z.string().optional().default('gemini-2.0-flash'),
  prompt: z.string().min(1, 'Prompt is required'),
  temperature: z.number().min(0).max(2).optional().default(0.8),
  maxTokens: z.number().int().min(1).max(8192).optional().default(2048),
  systemInstruction: z.string().optional(),
});

// Handle CORS preflight
export const onRequestOptions = withCors();

/**
 * POST /api/gemini
 * Synchronous Gemini API proxy
 */
export const onRequestPost = publicEndpoint(GeminiRequestSchema, async (context) => {
  const { env, validated } = context as { env: Env; validated: z.infer<typeof GeminiRequestSchema> };
  const { modelName, prompt, temperature, maxTokens, systemInstruction } = validated;

  // Validate API key
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Gemini] API key not configured');
    return {
      status: 500,
      error: 'Gemini API key not configured. Please contact support.',
    };
  }

  try {
    // Construct Gemini API URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // Build request body
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

    // Add system instruction if provided
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
    const responseData = await geminiResponse.json() as {
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

    return {
      data: {
        text: generatedText,
        model: modelName,
        finishReason: responseData.candidates?.[0]?.finishReason,
      },
    };
  } catch (error) {
    console.error('[Gemini] Unexpected error:', error);
    return {
      status: 500,
      error: 'Failed to process request. Please try again.',
    };
  }
});
