/**
 * Vertex AI Smoke Test — Verify Vertex AI integration is working.
 *
 * Run: npx tsx scripts/test-vertex-ai.ts
 *
 * Tests:
 *   1. Config detection (are Vertex env vars set?)
 *   2. Non-streaming call (generateContent)
 *   3. Grounded call (Google Search grounding)
 *   4. Reports which provider will be used
 */

import 'dotenv/config';

async function main() {
  console.log('=== Vertex AI Smoke Test ===\n');

  const project = process.env.VERTEX_AI_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION ?? 'us-central1';
  const apiKey = process.env.VERTEX_AI_API_KEY;

  // 1. Config check
  console.log('1. Configuration:');
  console.log(`   VERTEX_AI_PROJECT: ${project ?? '❌ not set'}`);
  console.log(`   VERTEX_AI_LOCATION: ${location}`);
  console.log(`   VERTEX_AI_API_KEY: ${apiKey ? `✅ set (${apiKey.substring(0, 8)}...)` : '❌ not set'}`);
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ set (fallback available)' : '❌ not set'}`);

  if (!project || !apiKey) {
    console.log('\n⚠️  Vertex AI not configured. Set VERTEX_AI_PROJECT and VERTEX_AI_API_KEY.');
    console.log('   The system will use the direct Gemini API instead.');
    process.exit(0);
  }

  // 2. Non-streaming test
  console.log('\n2. Testing non-streaming call...');
  const model = 'gemini-2.0-flash';
  const endpoint = `${location === 'global' ? '' : `${location}-`}aiplatform.googleapis.com`;
  const url = `https://${endpoint}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say "Vertex AI is working" and nothing else.' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 20 },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.log(`   ❌ Failed: ${resp.status} - ${text.slice(0, 200)}`);
      process.exit(1);
    }

    const data = await resp.json() as Record<string, unknown>;
    const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    const response = parts?.[0]?.text as string;
    console.log(`   ✅ Success: "${response?.trim()}"`);

    // Check usage metadata
    const usage = data.usageMetadata as Record<string, number>;
    if (usage) {
      console.log(`   Tokens: ${usage.promptTokenCount ?? 0} prompt, ${usage.candidatesTokenCount ?? 0} completion`);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // 3. Grounded test (Google Search)
  console.log('\n3. Testing Google Search grounding...');
  try {
    const groundedResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'What is the first-line treatment for hypertension per current guidelines?' }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
      }),
    });

    if (!groundedResp.ok) {
      const text = await groundedResp.text();
      console.log(`   ❌ Failed: ${groundedResp.status} - ${text.slice(0, 200)}`);
    } else {
      const data = await groundedResp.json() as Record<string, unknown>;
      const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
      const firstCandidate = candidates?.[0];
      const grounding = firstCandidate?.groundingMetadata as Record<string, unknown> | undefined;

      if (grounding) {
        const chunks = grounding.groundingChunks as Array<Record<string, unknown>> | undefined;
        const sourceCount = chunks?.length ?? 0;
        console.log(`   ✅ Grounded response with ${sourceCount} sources`);

        if (sourceCount > 0 && chunks) {
          const firstSource = chunks[0]?.web as Record<string, unknown> | undefined;
          console.log(`   First source: ${firstSource?.title ?? 'unknown'} - ${firstSource?.uri ?? 'no URI'}`);
        }
      } else {
        const content = firstCandidate?.content as Record<string, unknown> | undefined;
        const parts = content?.parts as Array<Record<string, unknown>> | undefined;
        console.log(`   ⚠ Response received but no grounding metadata (may not be available for this model)`);
        console.log(`   Response: ${String(parts?.[0]?.text).slice(0, 100)}...`);
      }
    }
  } catch (err) {
    console.log(`   ❌ Grounding error: ${err instanceof Error ? err.message : err}`);
  }

  console.log('\n=== Smoke Test Complete ===');
  console.log('Vertex AI is configured and ready. All Gemini calls will route through Vertex.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
