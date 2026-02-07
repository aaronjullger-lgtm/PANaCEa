/**
 * Audit Database Images with AI
 *
 * Reviews all images currently in the database using Gemini AI
 * and removes ones that are unsuitable for medical education quizzes.
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '');

// Rate limiting
const RATE_LIMIT_DELAY = 3000; // 3 seconds between calls
const MAX_RETRIES = 3;
const RETRY_BACKOFF = 5000; // 5 seconds initial backoff

interface AuditResult {
  keep: boolean;
  reason: string;
  suggestedCondition?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeImageUrl(
  url: string,
  expectedCondition: string,
  retryCount = 0
): Promise<AuditResult> {
  if (!GEMINI_API_KEY) {
    return { keep: true, reason: 'No API key - keeping by default' };
  }

  const prompt = `You are auditing medical images for a quiz app. Students must identify conditions from images.

CONDITION: ${expectedCondition}

Analyze if this image is suitable. Reply with ONLY valid JSON (no markdown):
{"keep": true, "reason": "brief reason"}

KEEP if:
- Shows the actual medical condition (ECG, X-ray, clinical photo, dermoscopy)
- Students could reasonably identify the condition
- Standard medical labels are OK (ECG leads, L/R markers)

DELETE if:
- Text/diagram explaining the condition (gives away answer)
- Stock photo, icon, or non-medical image
- Unrelated condition shown
- Poor quality or unidentifiable
- Contains diagnostic labels like "STEMI" or "Melanoma"`;

  try {
    // Fetch image and convert to base64
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      return { keep: false, reason: `Cannot fetch image: ${imageResponse.status}` };
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const mimeType = url.includes('.png') ? 'image/png' : 'image/jpeg';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      }
    );

    // Handle rate limiting
    if (response.status === 429 || response.status === 503) {
      if (retryCount < MAX_RETRIES) {
        const backoff = RETRY_BACKOFF * Math.pow(2, retryCount);
        console.log(`  ⏳ Rate limited, waiting ${backoff / 1000}s...`);
        await sleep(backoff);
        return analyzeImageUrl(url, expectedCondition, retryCount + 1);
      }
      return { keep: true, reason: `Rate limited after ${MAX_RETRIES} retries` };
    }

    if (!response.ok) {
      return { keep: true, reason: `API error: ${response.status}` };
    }

    const data = await response.json();
    return parseResponse(data);
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const backoff = RETRY_BACKOFF * Math.pow(2, retryCount);
      console.log(`  ⚠️ Error, retrying in ${backoff / 1000}s...`);
      await sleep(backoff);
      return analyzeImageUrl(url, expectedCondition, retryCount + 1);
    }
    console.error(`  Error analyzing: ${error}`);
    return { keep: true, reason: `Error: ${error}` };
  }
}

function parseResponse(data: any): AuditResult {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip markdown code blocks
  const clean = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match && match[0]) {
      const parsed = JSON.parse(match[0]);
      return {
        keep: parsed.keep ?? true,
        reason: parsed.reason || 'Unknown',
        suggestedCondition: parsed.suggestedCondition,
      };
    }
  } catch (e) {
    // Try to extract keep/delete from text
    if (
      clean.toLowerCase().includes('"keep": false') ||
      clean.toLowerCase().includes('"keep":false')
    ) {
      return { keep: false, reason: 'Parsed as delete from partial response' };
    }
  }

  return { keep: true, reason: 'Could not parse response - keeping' };
}

async function main() {
  console.log('🔍 Auditing Database Images with AI\n');

  // Get all images grouped by condition
  const images = await prisma.mediaAsset.findMany({
    select: {
      id: true,
      originalUrl: true,
      sourceUrl: true,
      thumbnailUrl: true,
      conditionId: true,
      type: true,
      filename: true,
    },
    orderBy: { conditionId: 'asc' },
  });

  console.log(`Found ${images.length} images to audit\n`);

  const stats = {
    total: images.length,
    kept: 0,
    deleted: 0,
    errors: 0,
    byCondition: new Map<string, { kept: number; deleted: number }>(),
  };

  let currentCondition = '';

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (!image) continue;
    const imageUrl = image.originalUrl || image.sourceUrl || image.thumbnailUrl;

    if (!imageUrl) {
      console.log(`  [${i + 1}/${images.length}] ${image.filename} - ⚠️ NO URL, deleting`);
      await prisma.mediaAsset.delete({ where: { id: image.id } });
      stats.deleted++;
      continue;
    }

    // Log condition header
    if (image.conditionId !== currentCondition) {
      currentCondition = image.conditionId || 'unknown';
      const conditionImages = images.filter((img) => img.conditionId === currentCondition);
      console.log(`\n📁 ${currentCondition} (${conditionImages.length} images)`);
      stats.byCondition.set(currentCondition, { kept: 0, deleted: 0 });
    }

    process.stdout.write(
      `  [${i + 1}/${images.length}] ${image.filename?.substring(0, 40) || image.id.substring(0, 8)}... `
    );

    const result = await analyzeImageUrl(imageUrl, currentCondition);

    if (result.keep) {
      console.log('✅ KEEP');
      stats.kept++;
      const condStats = stats.byCondition.get(currentCondition)!;
      condStats.kept++;
    } else {
      console.log(`❌ DELETE: ${result.reason}`);
      stats.deleted++;
      const condStats = stats.byCondition.get(currentCondition)!;
      condStats.deleted++;

      // Delete from database
      try {
        await prisma.mediaAsset.delete({ where: { id: image.id } });
      } catch (e) {
        console.error(`    Failed to delete: ${e}`);
        stats.errors++;
      }
    }

    // Rate limit between calls
    await sleep(RATE_LIMIT_DELAY);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total audited: ${stats.total}`);
  console.log(`Kept: ${stats.kept} (${((stats.kept / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Deleted: ${stats.deleted} (${((stats.deleted / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Errors: ${stats.errors}`);

  console.log('\nBy Condition:');
  for (const [condition, data] of stats.byCondition) {
    const total = data.kept + data.deleted;
    console.log(`  ${condition}: ${data.kept}/${total} kept`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
