// functions/api/gemini/stream.ts
// Edge-compatible streaming endpoint for Gemini AI responses
// Uses Web Streams API (not Node.js streams) for Cloudflare Pages Functions compatibility

import {
  ApiError,
  ExternalServiceError,
  RateLimitError,
  TimeoutError,
  ConfigurationError,
  ValidationError,
  type AppError,
  isAppError,
} from '../../lib/errors/types';
import { logError, addBreadcrumb } from '../../lib/errors/errorLogger';

interface Env {
  GEMINI_API_KEY: string;
}

interface StreamRequest {
  modelName?: string;
  prompt: string;
  temperature?: number;
}

/**
 * Convert AppError to JSON response with retry metadata
 */
function errorToResponse(error: AppError): Response {
  return new Response(
    JSON.stringify({
      error: error.message,
      errorId: error.errorId,
      category: error.category,
      retryable: error.retryMetadata.retryable,
      retryAfterMs: error.retryMetadata.retryAfterMs,
      timestamp: error.timestamp,
    }),
    {
      status: error.category === 'rate_limit' ? 429 
        : error.category === 'validation' ? 400
        : error.category === 'authentication' ? 401
        : error.category === 'authorization' ? 403
        : error.category === 'timeout' ? 408
        : error.category === 'configuration' ? 500
        : 503,
      headers: { 
        'Content-Type': 'application/json',
        ...(error.retryMetadata.retryAfterMs && {
          'Retry-After': Math.ceil(error.retryMetadata.retryAfterMs / 1000).toString()
        })
      },
    }
  );
}

/**
 * Cloudflare Pages Function for streaming Gemini responses
 * Returns Server-Sent Events (SSE) stream
 */
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    // Add breadcrumb for request start
    addBreadcrumb('Gemini stream request started', 'gemini-stream', 'info');

    const body = (await request.json()) as StreamRequest;
    const { modelName = 'gemini-2.5-flash', prompt, temperature = 0.8 } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      const validationError = new ValidationError(
        'Missing or invalid prompt',
        'prompt',
        prompt,
        { modelName, temperature }
      );
      
      addBreadcrumb('Invalid prompt provided', 'validation', 'warning', {
        promptType: typeof prompt,
        promptLength: typeof prompt === 'string' ? prompt.length : 0,
      });
      
      logError(validationError, {
        endpoint: '/api/gemini/stream',
        requestBody: { modelName, promptProvided: !!prompt },
      });
      
      return errorToResponse(validationError);
    }

    // Validate API key
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      const configError = new ConfigurationError(
        'Gemini API key not configured',
        'GEMINI_API_KEY'
      );
      
      addBreadcrumb('Missing API key', 'configuration', 'error');
      
      logError(configError, {
        endpoint: '/api/gemini/stream',
        environment: env,
      });
      
      return errorToResponse(configError);
    }

    addBreadcrumb('Request validated, calling Gemini API', 'gemini-stream', 'info', {
      modelName,
      promptLength: prompt.length,
      temperature,
    });

    // Construct Gemini API URL for streaming
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

    // Call Gemini with streaming enabled
    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      });
    } catch (fetchError) {
      const networkError = new ExternalServiceError(
        'Failed to connect to Gemini API',
        'gemini',
        undefined,
        {
          modelName,
          url: geminiUrl,
          originalError: fetchError instanceof Error ? fetchError.message : String(fetchError),
        }
      );
      
      addBreadcrumb('Network error calling Gemini', 'gemini-stream', 'error', {
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      });
      
      logError(networkError, {
        endpoint: '/api/gemini/stream',
        modelName,
        promptLength: prompt.length,
      });
      
      return errorToResponse(networkError);
    }

    // Handle non-OK responses
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      const statusCode = geminiResponse.status;
      
      let apiError: AppError;
      
      if (statusCode === 429) {
        apiError = new RateLimitError(
          'Gemini API rate limit exceeded',
          60,
          { service: 'gemini', endpoint: geminiUrl, statusCode, response: errorText }
        );
        addBreadcrumb('Gemini rate limit hit', 'gemini-stream', 'warning', { statusCode });
      } else if (statusCode === 408) {
        apiError = new TimeoutError(
          'Gemini API request timed out',
          30000,
          { service: 'gemini', endpoint: geminiUrl, statusCode, response: errorText }
        );
        addBreadcrumb('Gemini timeout', 'gemini-stream', 'warning', { statusCode });
      } else if (statusCode >= 500) {
        apiError = new ExternalServiceError(
          `Gemini API server error: ${statusCode}`,
          'gemini',
          statusCode,
          { endpoint: geminiUrl, response: errorText }
        );
        addBreadcrumb('Gemini server error', 'gemini-stream', 'error', { statusCode });
      } else {
        apiError = new ApiError(
          `Gemini API error: ${statusCode}`,
          statusCode,
          geminiUrl,
          { response: errorText }
        );
        addBreadcrumb('Gemini API error', 'gemini-stream', 'error', { statusCode });
      }
      
      logError(apiError, {
        endpoint: '/api/gemini/stream',
        modelName,
        promptLength: prompt.length,
        statusCode,
        responseText: errorText.slice(0, 500),
      });
      
      return errorToResponse(apiError);
    }

    // Verify stream exists
    const geminiStream = geminiResponse.body;
    if (!geminiStream) {
      const serviceError = new ExternalServiceError(
        'Gemini API returned no response stream',
        'gemini',
        200,
        { endpoint: geminiUrl }
      );
      
      addBreadcrumb('No stream from Gemini', 'gemini-stream', 'error');
      
      logError(serviceError, {
        endpoint: '/api/gemini/stream',
        modelName,
      });
      
      return errorToResponse(serviceError);
    }

    addBreadcrumb('Gemini stream started', 'gemini-stream', 'info');

    // Create a TransformStream to parse Gemini's SSE and extract text chunks
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process Gemini's SSE stream in the background
    (async () => {
      let chunksReceived = 0;
      
      try {
        const reader = geminiStream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                // Extract text from Gemini's response structure
                const text =
                  data.candidates?.[0]?.content?.parts?.[0]?.text ||
                  data.candidates?.[0]?.output ||
                  '';

                if (text) {
                  chunksReceived++;
                  // Send text chunk as SSE
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
              } catch (parseError) {
                addBreadcrumb('JSON parse error in stream', 'gemini-stream', 'warning', {
                  line: jsonStr.slice(0, 100),
                  error: parseError instanceof Error ? parseError.message : String(parseError),
                });
              }
            }
          }
        }

        // Send completion signal
        await writer.write(encoder.encode('data: [DONE]\n\n'));
        await writer.close();
        
        addBreadcrumb('Gemini stream completed', 'gemini-stream', 'info', {
          chunksReceived,
        });
      } catch (error) {
        const streamError = new ExternalServiceError(
          'Stream processing interrupted',
          'gemini',
          undefined,
          {
            chunksReceived,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        
        addBreadcrumb('Stream processing error', 'gemini-stream', 'error', {
          chunksReceived,
          error: error instanceof Error ? error.message : String(error),
        });
        
        logError(streamError, {
          endpoint: '/api/gemini/stream',
          modelName,
          chunksReceived,
        });
        
        try {
          // Send error to client
          const errorData = isAppError(streamError) ? {
            error: streamError.message,
            errorId: streamError.errorId,
            retryable: streamError.retryMetadata.retryable,
          } : {
            error: 'Stream interrupted',
          };
          
          await writer.write(
            encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
          );
          await writer.close();
        } catch {
          // Writer may already be closed
        }
      }
    })();

    // Return SSE stream to client
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    // Catch-all for unexpected errors
    const appError = isAppError(error)
      ? error
      : new ExternalServiceError(
          'Unexpected error in streaming endpoint',
          'gemini',
          undefined,
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }
        );
    
    addBreadcrumb('Unexpected streaming error', 'gemini-stream', 'error', {
      errorType: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    
    logError(appError, {
      endpoint: '/api/gemini/stream',
      unexpected: true,
    });
    
    return errorToResponse(appError);
  }
}
