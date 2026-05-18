export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';
export const GEMINI_API_VERSION = 'v1beta';

/**
 * Cloudflare AI Gateway base URL.
 * When CF_AI_GATEWAY_ID and CF_ACCOUNT_ID are set in env, Gemini requests can
 * be proxied through Cloudflare AI Gateway for semantic caching, analytics,
 * and provider-level rate limiting.
 */
function getAIGatewayBaseUrl(env?: Record<string, string>): string | null {
  const accountId = env?.CF_ACCOUNT_ID;
  const gatewayId = env?.CF_AI_GATEWAY_ID;
  if (!accountId || !gatewayId) return null;
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/google-ai-studio`;
}

/**
 * Build the full Gemini API URL for a given model and action.
 * Routes through Cloudflare AI Gateway when CF_ACCOUNT_ID + CF_AI_GATEWAY_ID
 * are set.
 */
export function buildGeminiUrl(
  apiKey: string,
  model: string,
  action: 'generateContent' | 'streamGenerateContent' | 'embedContent' = 'generateContent',
  env?: Record<string, string>
): string {
  const gatewayBase = getAIGatewayBaseUrl(env);
  if (gatewayBase) {
    return `${gatewayBase}/${GEMINI_API_VERSION}/models/${model}:${action}?key=${apiKey}`;
  }
  return `${GEMINI_BASE_URL}/${GEMINI_API_VERSION}/models/${model}:${action}?key=${apiKey}`;
}
