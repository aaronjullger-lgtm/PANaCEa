// lib/utils/streamingClient.ts
// Browser-compatible SSE streaming client for Gemini responses
// Provides callback-based API for progressive rendering

import { getApiEndpoint, API_ENDPOINTS } from './apiConfig';

/**
 * Callback function called for each chunk of text received
 */
export type StreamChunkCallback = (chunk: string) => void;

/**
 * Callback function called when stream completes
 */
export type StreamCompleteCallback = (fullText: string) => void;

/**
 * Callback function called on error
 */
export type StreamErrorCallback = (error: Error) => void;

/** Single turn for Deep Think multi-turn (history + thoughtSignature). */
export interface StreamHistoryTurn {
  role: 'user' | 'model';
  text: string;
  thoughtSignature?: string;
}

/**
 * Options for streaming requests
 */
export interface StreamOptions {
  modelName?: string;
  temperature?: number;
  /** Optional: Gemini context cache name (e.g. cachedContents/xxx) for "Chat with your Library" */
  cachedContent?: string;
  /** Optional: Bearer token for authenticated requests (required when backend requires auth) */
  token?: string | null;
  /** Optional: Gemini 3 thinking level for reasoning depth control */
  thinkingLevel?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  /** Multi-turn history; include thoughtSignature on model turns to preserve reasoning chain */
  history?: StreamHistoryTurn[];
  /** Previous model turn thought signature(s); send back to preserve reasoning chain */
  previousThoughtSignatures?: string[];
  /** System instruction (e.g. PANaCEa Deep Think: rank differentials, explain pathophysiology of error) */
  systemInstruction?: string;
  onChunk?: StreamChunkCallback;
  onComplete?: StreamCompleteCallback;
  onError?: StreamErrorCallback;
  /** Called when server sends thoughtSignatures (Gemini 3); pass them in next request as previousThoughtSignatures */
  onThoughtSignatures?: (signatures: string[]) => void;
  signal?: AbortSignal; // For cancellation support
}

/**
 * Stream Gemini text response with progressive chunks
 *
 * @param prompt - The prompt to send to Gemini
 * @param options - Streaming options and callbacks
 * @returns Promise that resolves with the complete text when streaming finishes
 *
 * @example
 * ```typescript
 * const fullText = await streamGeminiText(
 *   "Explain myocardial infarction",
 *   {
 *     onChunk: (chunk) => setDisplayText(prev => prev + chunk),
 *     onComplete: (full) => console.log('Done:', full),
 *     onError: (err) => console.error(err)
 *   }
 * );
 * ```
 */
export async function streamGeminiText(
  prompt: string,
  options: StreamOptions = {}
): Promise<string> {
  const {
    modelName = 'gemini-3-flash-preview',
    temperature = 0.8,
    cachedContent,
    token,
    thinkingLevel = 'HIGH',
    history,
    previousThoughtSignatures,
    systemInstruction,
    onChunk,
    onComplete,
    onError,
    onThoughtSignatures,
    signal,
  } = options;

  let accumulatedText = '';

  try {
    const body: Record<string, unknown> = {
      modelName,
      prompt,
      temperature,
      thinkingLevel,
    };
    if (cachedContent && cachedContent.startsWith('cachedContents/')) {
      body.cachedContent = cachedContent;
    }
    if (history?.length) {
      body.history = history;
    }
    if (previousThoughtSignatures?.length) {
      body.previousThoughtSignatures = previousThoughtSignatures;
    }
    if (systemInstruction?.trim()) {
      body.systemInstruction = systemInstruction.trim();
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Make request to streaming endpoint
    const response = await fetch(getApiEndpoint(API_ENDPOINTS.GEMINI_STREAM), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal, // Support cancellation
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = (await response.json()) as { error?: string; message?: string };
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(`Streaming request failed: ${errorMessage}`);
    }

    // Check if response is SSE
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/event-stream')) {
      throw new Error('Response is not a valid SSE stream');
    }

    // Get the readable stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();

            // Check for completion signal
            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const data = JSON.parse(dataStr);

              // Handle error messages in stream
              if (data.error) {
                throw new Error(data.error);
              }

              // Gemini 3: thought signatures (send back in next request as previousThoughtSignatures)
              const thoughtSigs = data.thoughtSignatures;
              if (Array.isArray(thoughtSigs) && thoughtSigs.length > 0) {
                onThoughtSignatures?.(thoughtSigs);
              }

              // Extract text chunk
              const textChunk = data.text || '';
              if (textChunk) {
                accumulatedText += textChunk;
                onChunk?.(textChunk);
              }
            } catch (parseError) {
              console.error('[StreamClient] Parse error:', parseError);
              // Continue processing other chunks even if one fails
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Call completion callback
    onComplete?.(accumulatedText);

    return accumulatedText;
  } catch (error) {
    const streamError = error instanceof Error ? error : new Error('Unknown streaming error');

    // Call error callback
    onError?.(streamError);

    throw streamError;
  }
}

/**
 * Helper function to create a cancellable streaming request
 * Returns the promise and an abort function
 *
 * @example
 * ```typescript
 * const { promise, abort } = createCancellableStream(prompt, options);
 *
 * // Later, to cancel:
 * abort();
 * ```
 */
export function createCancellableStream(
  prompt: string,
  options: Omit<StreamOptions, 'signal'> = {}
): {
  promise: Promise<string>;
  abort: () => void;
} {
  const abortController = new AbortController();

  const promise = streamGeminiText(prompt, {
    ...options,
    signal: abortController.signal,
  });

  return {
    promise,
    abort: () => abortController.abort(),
  };
}

/**
 * React-friendly hook-style wrapper (can be used directly or as reference for custom hooks)
 *
 * @example
 * ```typescript
 * const [text, setText] = useState('');
 * const [isStreaming, setIsStreaming] = useState(false);
 *
 * const handleStream = async () => {
 *   setIsStreaming(true);
 *   setText('');
 *
 *   await streamGeminiText(prompt, {
 *     onChunk: (chunk) => setText(prev => prev + chunk),
 *     onComplete: () => setIsStreaming(false),
 *     onError: (err) => {
 *       console.error(err);
 *       setIsStreaming(false);
 *     }
 *   });
 * };
 * ```
 */
export interface StreamState {
  text: string;
  isStreaming: boolean;
  error: Error | null;
}

/**
 * Utility function to estimate streaming progress (character-based)
 * Useful for progress bars during streaming
 */
export function estimateStreamProgress(
  currentLength: number,
  estimatedTotalLength: number = 1000
): number {
  const progress = (currentLength / estimatedTotalLength) * 100;
  return Math.min(progress, 95); // Cap at 95% until complete
}
