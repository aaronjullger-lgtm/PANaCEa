#!/usr/bin/env npx tsx
/**
 * Phase 3c: Populate AntibioticConditionLink
 *
 * Uses Gemini to link AntibioticGuideline organisms to Conditions.
 *
 * Usage: npx tsx scripts/fixes/phase3c-antibiotic-links.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
config({ override: true });

const DRY_RUN = process.argv.includes('--dry-run');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function generateAntibioticLinks(
  abx: { id: string; organism: string; class: string; commonInfections: string[] },
  conditions: Array<{ id: string; name: string; system: string }>
): Promise<Array<{ conditionId: string; isFirstLine: boolean; notes: string }>> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const conditionsList = conditions.map((c) => `${c.name} (${c.system})`).join(', ');

  const prompt = `You are a medical expert. The organism "${abx.organism}" (class: ${abx.class}) causes infections. Which conditions from this list are caused by or associated with this organism?

Known infections: ${abx.commonInfections.join(', ')}

Conditions: ${conditionsList}

Return a JSON array:
[{"conditionName": "Exact condition name", "isFirstLine": true/false, "notes": "How this organism relates to this condition"}]

Rules:
- Only include conditions directly caused by or associated with this organism
- isFirstLine = true if this organism is the primary/most common cause
- Return ONLY valid JSON array, no markdown`;

  try {
    const result = await model.generateContent(prompt);
    let jsonStr = result.response
      .text()
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');
    const first = jsonStr.indexOf('[');
    const last = jsonStr.lastIndexOf(']');
    if (first === -1 || last === -1) return [];
    jsonStr = jsonStr
      .substring(first, last + 1)
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/,(\s*[\]}])/g, '$1');

    const parsed = JSON.parse(jsonStr);
    const links: Array<{ conditionId: string; isFirstLine: boolean; notes: string }> = [];

    for (const item of parsed) {
      const condition = conditions.find(
        (c) =>
          c.name.toLowerCase() === item.conditionName?.toLowerCase() ||
          c.name.toLowerCase().includes(item.conditionName?.toLowerCase()) ||
          item.conditionName?.toLowerCase().includes(c.name.toLowerCase())
      );
      if (condition) {
        links.push({
          conditionId: condition.id,
          isFirstLine: item.isFirstLine ?? false,
          notes: item.notes || '',
        });
      }
    }
    return links;
  } catch (e: any) {
    console.error(`  ❌ Error: ${e.message?.substring(0, 100)}`);
    return [];
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 3c: Populate AntibioticConditionLink               ║');
  console.log(
    `║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`
  );
  console.log('╚════════════════════════════════════════════════════════════╝');

  const antibiotics = await prisma.antibioticGuideline.findMany({
    select: { id: true, organism: true, class: true, commonInfections: true },
  });
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true },
  });

  const existing = await prisma.antibioticConditionLink.findMany({
    select: { antibioticId: true, conditionId: true },
  });
  const existingSet = new Set(existing.map((l) => `${l.antibioticId}:${l.conditionId}`));

  console.log(`\nAntibiotics: ${antibiotics.length}`);
  console.log(`Conditions: ${conditions.length}`);
  console.log(`Existing links: ${existing.length}\n`);

  let created = 0;
  let skipped = 0;

  for (const abx of antibiotics) {
    console.log(`🦠 ${abx.organism}...`);
    const links = await generateAntibioticLinks(abx, conditions);

    for (const link of links) {
      const key = `${abx.id}:${link.conditionId}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      if (!DRY_RUN) {
        try {
          await prisma.antibioticConditionLink.create({
            data: {
              id: uuidv4(),
              antibioticId: abx.id,
              conditionId: link.conditionId,
              isFirstLine: link.isFirstLine,
              notes: link.notes,
              updatedAt: new Date(),
            } as any,
          });
          existingSet.add(key);
          created++;
        } catch {
          skipped++;
        }
      } else {
        created++;
      }
    }
    console.log(`   Created ${links.length} links`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
