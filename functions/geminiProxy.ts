// functions/geminiProxy.ts
// DEPRECATED: Gemini proxy has moved to /api/ai/chat/stream (streaming) and /api/ai/models (non-streaming).
// This file returns 410 Gone so clients use the consolidated Cloudflare Functions.

const MIGRATION_MESSAGE = {
  error: 'Endpoint deprecated',
  message: 'Use /api/ai/models for model listing or /api/ai/chat/stream for streaming.',
  migration: { models: '/api/ai/models', streaming: '/api/ai/chat/stream' },
};

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function onRequestGet(): Promise<Response> {
  return new Response(JSON.stringify(MIGRATION_MESSAGE), {
    status: 410,
    headers: corsHeaders(),
  });
}

export async function onRequestPost(): Promise<Response> {
  return new Response(JSON.stringify(MIGRATION_MESSAGE), {
    status: 410,
    headers: corsHeaders(),
  });
}
