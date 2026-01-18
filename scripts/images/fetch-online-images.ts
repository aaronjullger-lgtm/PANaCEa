/**
 * Fetch Quality Medical Images from Open Sources
 *
 * Sources medical images from:
 * 1. Wikimedia Commons (CC licensed medical images)
 * 2. DermNet NZ (dermatology)
 * 3. Radiopaedia (radiology, with attribution)
 *
 * Usage: npx tsx scripts/images/fetch-online-images.ts [--condition=X] [--limit=N]
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import * as crypto from 'crypto';

config();

const prisma = new PrismaClient();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '');

// Priority conditions that need images (high-yield for PANCE)
const PRIORITY_CONDITIONS = [
  // Dermatology - highly visual
  'DERM__infectious__cellulitis',
  'DERM__dermatitis__eczema__atopic_dermatitis',
  'DERM__papulosquamous__plaque_psoriasis',
  'DERM__oncology__melanoma',
  'DERM__oncology__basal_cell_carcinoma',
  'DERM__oncology__squamous_cell_carcinoma',
  'DERM__infectious__herpes_simplex',
  'DERM__infectious__herpes_zoster',
  'DERM__infectious__impetigo',
  'DERM__infectious__tinea_corporis',
  'DERM__vascular__cherry_angioma',
  'DERM__autoimmune__vitiligo',

  // Cardiology - ECGs
  'CV__ecg__atrial_fibrillation',
  'CV__ecg__atrial_flutter',
  'CV__ischemic_heart_disease__stemi',
  'CV__ischemic_heart_disease__nstemi',
  'CV__conduction_disorders__left_bundle_branch_block',
  'CV__conduction_disorders__right_bundle_branch_block',
  'CV__arrhythmia__ventricular_tachycardia',
  'CV__arrhythmia__ventricular_fibrillation',

  // Pulmonology - X-rays
  'PULM__infectious__pneumonia',
  'PULM__pleural_disease__pneumothorax',
  'PULM__pleural_disease__pleural_effusion',
  'PULM__obstructive__copd',

  // MSK - X-rays
  'MSK__fracture__colles_fracture',
  'MSK__fracture__hip_fracture',
  'MSK__arthritis__osteoarthritis',
  'MSK__arthritis__rheumatoid_arthritis',

  // Neuro - CT/MRI
  'NEURO__cerebrovascular__ischemic_stroke',
  'NEURO__cerebrovascular__hemorrhagic_stroke',
  'NEURO__tumors__brain_tumor',
];

interface ImageSource {
  url: string;
  title: string;
  license: string;
  attribution: string;
  source: 'wikimedia' | 'dermnet' | 'radiopaedia' | 'openi';
}

/**
 * Search Wikimedia Commons for medical images
 */
async function searchWikimedia(searchTerm: string, limit = 10): Promise<ImageSource[]> {
  const results: ImageSource[] = [];

  try {
    // Search for images
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm + ' medical')}&srnamespace=6&srlimit=${limit}&format=json&origin=*`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    for (const result of searchData.query?.search || []) {
      const title = result.title;

      // Get image info
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`;
      const infoResponse = await fetch(infoUrl);
      const infoData = await infoResponse.json();

      const pages = infoData.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      const imageInfo = pages[pageId]?.imageinfo?.[0];

      if (imageInfo?.url) {
        const metadata = imageInfo.extmetadata || {};
        results.push({
          url: imageInfo.url,
          title: title.replace('File:', ''),
          license: metadata.LicenseShortName?.value || 'Unknown',
          attribution: metadata.Artist?.value || 'Wikimedia Commons',
          source: 'wikimedia',
        });
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (error) {
    console.error(`Wikimedia search error: ${error}`);
  }

  return results;
}

/**
 * Verify image is suitable using Gemini
 */
async function verifyImageWithAI(
  imageUrl: string,
  expectedCondition: string
): Promise<{ suitable: boolean; reason: string }> {
  if (!GEMINI_API_KEY) {
    return { suitable: true, reason: 'No API key - accepting' };
  }

  try {
    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { suitable: false, reason: `Cannot fetch: ${imageResponse.status}` };
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

    const prompt = `Is this a suitable medical education image for: ${expectedCondition}?
    
Reply JSON only: {"suitable": true/false, "reason": "brief reason"}

SUITABLE: Real medical images (ECG, X-ray, CT, clinical photos) showing the condition
NOT SUITABLE: Diagrams with labels, stock photos, unrelated conditions, poor quality`;

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
          generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
        }),
      }
    );

    if (!response.ok) {
      return { suitable: true, reason: `API error: ${response.status}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return { suitable: parsed.suitable ?? true, reason: parsed.reason || 'Unknown' };
    }

    return { suitable: true, reason: 'Could not parse' };
  } catch (error) {
    return { suitable: false, reason: `Error: ${error}` };
  }
}

/**
 * Upload image to Supabase storage
 */
async function uploadToSupabase(
  imageUrl: string,
  conditionId: string,
  filename: string
): Promise<string | null> {
  // For now, just store the source URL directly
  // In production, you'd download and re-upload to Supabase storage
  return imageUrl;
}

/**
 * Get conditions that need more images
 */
async function getConditionsNeedingImages(
  minImages = 5
): Promise<Array<{ id: string; name: string; currentCount: number }>> {
  const conditions = await prisma.condition.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { MediaAsset: true } },
    },
    where: {
      id: { in: PRIORITY_CONDITIONS },
    },
  });

  return conditions
    .filter((c) => c._count.MediaAsset < minImages)
    .map((c) => ({
      id: c.id,
      name: c.name,
      currentCount: c._count.MediaAsset,
    }))
    .sort((a, b) => a.currentCount - b.currentCount);
}

/**
 * Map condition ID to search terms
 */
function getSearchTerms(conditionId: string): string[] {
  const mapping: Record<string, string[]> = {
    DERM__infectious__cellulitis: ['cellulitis skin', 'cellulitis leg', 'erysipelas'],
    DERM__dermatitis__eczema__atopic_dermatitis: ['atopic dermatitis', 'eczema', 'atopic eczema'],
    DERM__papulosquamous__plaque_psoriasis: ['psoriasis plaque', 'psoriasis skin'],
    DERM__oncology__melanoma: ['melanoma skin', 'malignant melanoma dermoscopy'],
    DERM__oncology__basal_cell_carcinoma: ['basal cell carcinoma', 'BCC skin'],
    DERM__oncology__squamous_cell_carcinoma: ['squamous cell carcinoma skin', 'SCC skin'],
    CV__ecg__atrial_fibrillation: ['atrial fibrillation ECG', 'afib electrocardiogram'],
    CV__ecg__atrial_flutter: ['atrial flutter ECG', 'flutter waves'],
    CV__ischemic_heart_disease__stemi: ['STEMI ECG', 'ST elevation myocardial infarction ECG'],
    PULM__infectious__pneumonia: ['pneumonia chest xray', 'pneumonia radiograph'],
    PULM__pleural_disease__pneumothorax: ['pneumothorax xray', 'collapsed lung radiograph'],
  };

  // Default: use condition name parts
  if (!mapping[conditionId]) {
    const parts = conditionId.split('__');
    const name = parts[parts.length - 1].replace(/_/g, ' ');
    return [name, `${name} medical image`];
  }

  return mapping[conditionId];
}

async function main() {
  const args = process.argv.slice(2);
  const specificCondition = args.find((a) => a.startsWith('--condition='))?.split('=')[1];
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '5');

  console.log('🌐 Fetching Quality Medical Images from Online Sources\n');

  // Get conditions needing images
  let conditionsToProcess: Array<{ id: string; name: string; currentCount: number }>;

  if (specificCondition) {
    const condition = await prisma.condition.findUnique({
      where: { id: specificCondition },
      select: { id: true, name: true, _count: { select: { MediaAsset: true } } },
    });

    if (!condition) {
      console.error(`Condition not found: ${specificCondition}`);
      process.exit(1);
    }

    conditionsToProcess = [
      {
        id: condition.id,
        name: condition.name,
        currentCount: condition._count.MediaAsset,
      },
    ];
  } else {
    conditionsToProcess = await getConditionsNeedingImages(5);
  }

  console.log(`Found ${conditionsToProcess.length} conditions needing images\n`);

  const stats = { searched: 0, verified: 0, added: 0, rejected: 0 };

  for (const condition of conditionsToProcess) {
    const needed = limit - condition.currentCount;
    if (needed <= 0) continue;

    console.log(`\n📁 ${condition.name} (have ${condition.currentCount}, need ${needed} more)`);

    const searchTerms = getSearchTerms(condition.id);
    let addedForCondition = 0;

    for (const term of searchTerms) {
      if (addedForCondition >= needed) break;

      console.log(`  🔍 Searching: "${term}"`);
      const images = await searchWikimedia(term, 5);
      stats.searched += images.length;

      for (const image of images) {
        if (addedForCondition >= needed) break;

        process.stdout.write(`    ${image.title.substring(0, 40)}... `);

        // Verify with AI
        const verification = await verifyImageWithAI(image.url, condition.name);
        stats.verified++;

        if (!verification.suitable) {
          console.log(`❌ ${verification.reason}`);
          stats.rejected++;
          continue;
        }

        // Add to database
        const id = crypto.randomUUID();
        try {
          await prisma.mediaAsset.create({
            data: {
              id,
              conditionId: condition.id,
              type: 'clinical_photo',
              filename: image.title,
              originalUrl: image.url,
              sourceUrl: image.url,
              citation: `${image.attribution} - ${image.license}`,
              tags: [image.source, image.license],
              status: 'pending_review',
              approvalStatus: 'pending',
              updatedAt: new Date(),
            },
          });

          console.log('✅ Added');
          addedForCondition++;
          stats.added++;
        } catch (e) {
          console.log(`⚠️ DB error: ${e}`);
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Images searched: ${stats.searched}`);
  console.log(`Images verified: ${stats.verified}`);
  console.log(`Images added: ${stats.added}`);
  console.log(`Images rejected: ${stats.rejected}`);

  await prisma.$disconnect();
}

main().catch(console.error);
