// functions/geminiProxy.ts
// DEPRECATED: Gemini proxy has moved to /api/gemini and /api/gemini/stream.
// This file returns 410 Gone so clients use the Cloudflare Functions under functions/api/gemini/.

const MIGRATION_MESSAGE = {
  error: 'Endpoint deprecated',
  message: 'Use /api/gemini for non-streaming or /api/gemini/stream for streaming.',
  migration: { nonStreaming: '/api/gemini', streaming: '/api/gemini/stream' },
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
