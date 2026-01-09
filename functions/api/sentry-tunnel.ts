/**
 * Sentry Tunnel - Cloudflare Pages Function
 * 
 * This tunnel proxies Sentry SDK requests from the browser to Sentry's ingest servers.
 * This bypasses ad-blockers and CORS/origin restrictions that may block direct Sentry requests.
 * 
 * How it works:
 * 1. Sentry SDK sends envelopes to /api/sentry-tunnel instead of directly to sentry.io
 * 2. This function validates the project ID matches our Sentry project
 * 3. Forwards the envelope to Sentry's ingest endpoint
 * 
 * Security:
 * - Only forwards to our specific Sentry organization/project
 * - Rejects requests with mismatched project IDs
 * 
 * Note: This does NOT violate Database-First architecture - it's a pure proxy with no data storage.
 */

// Our Sentry project configuration
const SENTRY_HOST = 'o4510664011087872.ingest.us.sentry.io';
const SENTRY_PROJECT_ID = '4510664018231296';

export async function onRequestPost(context: any) {
  const { request } = context;
  
  try {
    // Get the raw envelope body
    const envelopeBody = await request.text();
    
    if (!envelopeBody) {
      return new Response(JSON.stringify({ error: 'Empty envelope body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Sentry envelopes are newline-delimited JSON
    // First line is the header containing the DSN
    const pieces = envelopeBody.split('\n');
    
    if (pieces.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid envelope format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse the envelope header to extract DSN
    let header: any;
    try {
      header = JSON.parse(pieces[0]);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse envelope header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Extract and validate DSN
    const dsn = header.dsn;
    if (!dsn) {
      return new Response(JSON.stringify({ error: 'No DSN in envelope header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse DSN URL to extract project ID
    let dsnUrl: URL;
    try {
      dsnUrl = new URL(dsn);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid DSN format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Extract project ID from DSN path (e.g., /4510664018231296)
    const projectId = dsnUrl.pathname.replace(/^\//, '');
    
    // Security: Only allow our project
    if (projectId !== SENTRY_PROJECT_ID) {
      console.warn(`[Sentry Tunnel] Rejected envelope with wrong project ID: ${projectId}`);
      return new Response(JSON.stringify({ error: 'Invalid project ID' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Construct Sentry ingest URL
    const sentryUrl = `https://${SENTRY_HOST}/api/${SENTRY_PROJECT_ID}/envelope/`;
    
    // Forward the envelope to Sentry
    const sentryResponse = await fetch(sentryUrl, {
      method: 'POST',
      body: envelopeBody,
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        // Pass through the SDK info for Sentry's analytics
        'User-Agent': request.headers.get('User-Agent') || 'PANaCEa-SentryTunnel/1.0',
      },
    });
    
    // Return Sentry's response
    const responseText = await sentryResponse.text();
    
    return new Response(responseText, {
      status: sentryResponse.status,
      headers: {
        'Content-Type': sentryResponse.headers.get('Content-Type') || 'text/plain',
        // CORS headers for browser
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
    
  } catch (error) {
    console.error('[Sentry Tunnel] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Tunnel error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    }
  });
}
