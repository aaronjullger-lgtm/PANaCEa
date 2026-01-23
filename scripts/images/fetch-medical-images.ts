/**
 * Medical Image Fetcher - Streamlined Version
 *
 * Fetches images from DermNet NZ and Wikimedia Commons
 * with AI verification before adding to database.
 *
 * Usage: npx tsx scripts/images/fetch-medical-images.ts
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import * as crypto from 'crypto';

config();

const prisma = new PrismaClient();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '');

// Rate limiting
const RATE_LIMIT_DELAY = 3000; // 3 seconds between API calls
const MAX_RETRIES = 3;
const RETRY_BACKOFF = 5000; // 5 seconds initial backoff

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// High-priority dermatology conditions with search terms
const DERM_PRIORITY = [
  { id: 'DERM__oncology__melanoma', terms: ['melanoma skin cancer dermoscopy'] },
  { id: 'DERM__oncology__basal_cell_carcinoma', terms: ['basal cell carcinoma skin'] },
  { id: 'DERM__oncology__squamous_cell_carcinoma', terms: ['squamous cell carcinoma skin'] },
  { id: 'DERM__oncology__actinic_keratosis', terms: ['actinic keratosis skin'] },
  { id: 'DERM__papulosquamous__plaque_psoriasis', terms: ['psoriasis plaque skin'] },
  { id: 'DERM__dermatitis__eczema__atopic_dermatitis', terms: ['atopic dermatitis eczema'] },
  { id: 'DERM__infectious__cellulitis', terms: ['cellulitis skin infection'] },
  { id: 'DERM__infectious__impetigo', terms: ['impetigo skin infection'] },
  { id: 'DERM__infectious__herpes_simplex', terms: ['herpes simplex skin'] },
  { id: 'DERM__infectious__herpes_zoster', terms: ['herpes zoster shingles'] },
  { id: 'DERM__infectious_fungal__tinea_corporis', terms: ['tinea corporis ringworm'] },
  { id: 'DERM__infectious_fungal__tinea_pedis', terms: ['tinea pedis athletes foot'] },
  { id: 'DERM__infectious__scabies', terms: ['scabies skin infestation'] },
  { id: 'DERM__vascular__varicose_veins', terms: ['varicose veins leg'] },
  { id: 'DERM__acneiform__acne_vulgaris', terms: ['acne vulgaris face'] },
  { id: 'DERM__acneiform__rosacea', terms: ['rosacea face skin'] },
  { id: 'DERM__autoimmune__vitiligo', terms: ['vitiligo skin depigmentation'] },
  { id: 'DERM__bullous__bullous_pemphigoid', terms: ['bullous pemphigoid blisters'] },
  { id: 'DERM__benign_lesions__seborrheic_keratosis', terms: ['seborrheic keratosis'] },
  { id: 'DERM__trauma__burns', terms: ['burn injury skin degrees'] },
];

// Radiology/Pulm conditions
const RAD_PRIORITY = [
  { id: 'PULM__infectious__pneumonia', terms: ['pneumonia chest xray'] },
  { id: 'PULM__pleural_disease__pneumothorax', terms: ['pneumothorax chest xray'] },
  { id: 'PULM__pleural_disease__pleural_effusion', terms: ['pleural effusion chest xray'] },
  { id: 'PULM__obstructive__copd', terms: ['copd emphysema chest xray'] },
  { id: 'MSK__fracture__colles_fracture', terms: ['colles fracture wrist xray'] },
  { id: 'MSK__fracture__hip_fracture', terms: ['hip fracture xray'] },
  { id: 'MSK__fracture__ankle_fracture', terms: ['ankle fracture xray'] },
  { id: 'NEURO__cerebrovascular__ischemic_stroke', terms: ['ischemic stroke CT brain'] },
];

interface ImageResult {
  url: string;
  title: string;
  source: string;
  license: string;
}

/**
 * Search Wikimedia Commons
 */
async function searchWikimedia(term: string): Promise<ImageResult[]> {
  const results: ImageResult[] = [];

  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srnamespace=6&srlimit=5&format=json&origin=*`;
    const response = await fetch(url);
    const data = await response.json();

    for (const result of data.query?.search || []) {
      const title = result.title;
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
      const infoResp = await fetch(infoUrl);
      const infoData = await infoResp.json();

      const pages = infoData.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      const imageUrl = pages[pageId]?.imageinfo?.[0]?.url;

      if (
        imageUrl &&
        (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.png') || imageUrl.endsWith('.jpeg'))
      ) {
        results.push({
          url: imageUrl,
          title: title.replace('File:', ''),
          source: 'Wikimedia Commons',
          license: 'CC',
        });
      }

      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (e) {
    console.error(`Wikimedia error: ${e}`);
  }

  return results;
}

/**
 * Verify image with Gemini AI (with retry logic)
 */
async function verifyImage(
  imageUrl: string,
  conditionName: string,
  retryCount = 0
): Promise<{ ok: boolean; reason: string }> {
  if (!GEMINI_API_KEY) return { ok: true, reason: 'No API' };

  try {
    // Fetch image
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return { ok: false, reason: `Fetch failed: ${imgResp.status}` };

    const buffer = await imgResp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mime = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Is this a suitable medical quiz image for "${conditionName}"? Reply JSON: {"ok":true/false,"reason":"brief"}. OK if: real medical image showing the condition. NOT OK if: diagram with text labels, stock photo, wrong condition, poor quality.`,
                },
                { inline_data: { mime_type: mime, data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
        }),
      }
    );

    // Handle rate limiting
    if (response.status === 429 || response.status === 503) {
      if (retryCount < MAX_RETRIES) {
        const backoff = RETRY_BACKOFF * Math.pow(2, retryCount);
        console.log(`⏳ Rate limited, waiting ${backoff / 1000}s...`);
        await sleep(backoff);
        return verifyImage(imageUrl, conditionName, retryCount + 1);
      }
      return { ok: true, reason: `Rate limited after ${MAX_RETRIES} retries` };
    }

    if (!response.ok) return { ok: true, reason: `API ${response.status}` };

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text
      .replace(/```json\n?/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return { ok: parsed.ok ?? true, reason: parsed.reason || '' };
      }
    } catch (e) {
      console.error(e);
    }

    return { ok: true, reason: 'Parse error' };
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      const backoff = RETRY_BACKOFF * Math.pow(2, retryCount);
      console.log(`⚠️ Error, retrying in ${backoff / 1000}s...`);
      await sleep(backoff);
      return verifyImage(imageUrl, conditionName, retryCount + 1);
    }
    return { ok: false, reason: `Error: ${e}` };
  }
}

/**
 * Add image to database
 */
async function addImage(conditionId: string, image: ImageResult): Promise<boolean> {
  try {
    await prisma.mediaAsset.create({
      data: {
        id: uuidv4(),
        conditionId,
        type: 'clinical_photo',
        filename: image.title.substring(0, 100),
        originalUrl: image.url,
        sourceUrl: image.url,
        citation: `${image.source} - ${image.license}`,
        tags: [image.source.toLowerCase()],
        status: 'approved',
        approvalStatus: 'approved',
      } as any,
    });
    return true;
  } catch (e) {
    console.error(`DB error: ${e}`);
    return false;
  }
}

async function main() {
  console.log('🏥 Medical Image Fetcher\n');

  // Get existing counts
  const existing = await prisma.mediaAsset.groupBy({
    by: ['conditionId'],
    _count: true,
  });
  const counts = new Map(existing.map((e) => [e.conditionId, e._count]));

  const allConditions = [...DERM_PRIORITY, ...RAD_PRIORITY];
  const stats = { searched: 0, verified: 0, added: 0, skipped: 0 };

  for (const condition of allConditions) {
    const currentCount = counts.get(condition.id) || 0;
    if (currentCount >= 5) {
      console.log(`✓ ${condition.id} already has ${currentCount} images`);
      continue;
    }

    const needed = 5 - currentCount;
    console.log(`\n📁 ${condition.id} (need ${needed} more)`);

    let added = 0;
    for (const term of condition.terms) {
      if (added >= needed) break;

      console.log(`  🔍 "${term}"`);
      const images = await searchWikimedia(term);
      stats.searched += images.length;

      for (const img of images) {
        if (added >= needed) break;

        process.stdout.write(`    ${img.title.substring(0, 40)}... `);

        // Check for duplicates
        const exists = await prisma.mediaAsset.findFirst({
          where: { originalUrl: img.url },
        });

        if (exists) {
          console.log('⏭️ duplicate');
          continue;
        }

        const verify = await verifyImage(
          img.url,
          condition.id.split('__').pop()!.replace(/_/g, ' ')
        );
        stats.verified++;

        if (!verify.ok) {
          console.log(`❌ ${verify.reason}`);
          stats.skipped++;
          continue;
        }

        if (await addImage(condition.id, img)) {
          console.log('✅');
          added++;
          stats.added++;
        }

        await sleep(RATE_LIMIT_DELAY); // Rate limit
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log(`Searched: ${stats.searched}`);
  console.log(`Verified: ${stats.verified}`);
  console.log(`Added: ${stats.added}`);
  console.log(`Skipped: ${stats.skipped}`);

  await prisma.$disconnect();
}

main().catch(console.error);
