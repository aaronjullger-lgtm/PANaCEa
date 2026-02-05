/**
 * POST /api/conditions/:identifier/mnemonic
 * Generate a visual mnemonic for a condition via Adobe Firefly.
 * Prompt: "Medical illustration of [Condition] showing [Key Symptom], white background."
 */

import { z } from 'zod';
import { assertAdobeHostAllowed } from '../../_shared/adobeAllowlist';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEndpointLogger } from '../../_shared/secureLogger';

const FIREFLY_GENERATE = 'https://firefly-api.adobe.io/v3/images/generate';
const IMS_TOKEN = 'https://ims-na1.adobelogin.com/ims/token/v3';

const MnemonicBodySchema = z.object({
  /** Key symptom or finding to show (e.g. "bullseye rash", "jaundice"). */
  keySymptom: z.string().max(200).optional(),
});

interface Env {
  ADOBE_CLIENT_ID?: string;
  ADOBE_CLIENT_SECRET?: string;
  ADOBE_ACCESS_TOKEN?: string;
}

async function getAdobeToken(env: Env): Promise<string> {
  if (env.ADOBE_ACCESS_TOKEN) return env.ADOBE_ACCESS_TOKEN;
  if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET) {
    throw new Error('Adobe credentials not configured');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.ADOBE_CLIENT_ID,
    client_secret: env.ADOBE_CLIENT_SECRET,
    scope: 'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis',
  });
  assertAdobeHostAllowed(IMS_TOKEN);
  const res = await fetch(IMS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Adobe token failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('No access_token in Adobe response');
  return data.access_token;
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(MnemonicBodySchema, async (context) => {
  const { env, auth, validated, params } = context;
  const logger = createEndpointLogger('/api/conditions/[identifier]/mnemonic');

  const identifier = (params?.identifier
    ? decodeURIComponent(String(params.identifier))
    : ''
  ).trim();
  if (!identifier) {
    return new Response(
      JSON.stringify({ error: 'Missing identifier in path' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const conditionName = identifier.replaceAll('-', ' ');
  const keySymptom = validated.keySymptom?.trim() ?? conditionName;

  const prompt = `Medical illustration of ${conditionName} showing ${keySymptom}, white background, clinical education style.`;

  try {
    const token = await getAdobeToken(env as Env);
    const fireflyBody = {
      prompt,
      numVariations: 1,
      contentClass: 'art',
    };

    assertAdobeHostAllowed(FIREFLY_GENERATE);
    const res = await fetch(FIREFLY_GENERATE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-api-key': env.ADOBE_CLIENT_ID ?? '',
      },
      body: JSON.stringify(fireflyBody),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.warn('Firefly mnemonic failed', { status: res.status, text: text.slice(0, 200) });
      return new Response(
        JSON.stringify({
          error: 'Failed to generate mnemonic',
          details: env.ADOBE_CLIENT_ID ? text.slice(0, 300) : 'Adobe credentials not configured',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = (await res.json()) as {
      images?: Array<{ image?: { source?: { url?: string }; uploadId?: string } }>;
    };
    const img = data.images?.[0]?.image;
    const imageUrl = img?.source?.url ?? (img?.uploadId ? `uploadId:${img.uploadId}` : null);

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'No image URL in Firefly response' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Condition mnemonic generated', {
      identifier,
      userId: auth.userId?.substring(0, 10),
    });

    return new Response(
      JSON.stringify({
        data: { imageUrl, prompt, conditionName, keySymptom },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Mnemonic error', {
      error: error instanceof Error ? error.message : String(error),
      identifier,
    });
    return new Response(
      JSON.stringify({
        error: 'Failed to generate mnemonic',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}, { source: 'params' });
