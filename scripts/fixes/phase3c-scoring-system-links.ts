#!/usr/bin/env npx tsx
/**
 * Phase 3c: Populate ScoringSystemConditionLink
 *
 * Uses Gemini to link ScoringSystem records to relevant Conditions.
 *
 * Usage: npx tsx scripts/fixes/phase3c-scoring-system-links.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
config({ override: true });

const DRY_RUN = process.argv.includes('--dry-run');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function generateScoringLinks(
  scoringSystem: { id: string; name: string; category: string },
  conditions: Array<{ id: string; name: string; system: string }>
): Promise<Array<{ conditionId: string; clinicalApplication: string; isStandard: boolean }>> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const conditionsList = conditions.map((c) => `${c.name} (${c.system})`).join(', ');

  const prompt = `You are a medical expert. For the clinical scoring system "${scoringSystem.name}" (category: ${scoringSystem.category}), identify which conditions from this list it is used for:

Conditions: ${conditionsList}

Return a JSON array. For each relevant condition:
[{"conditionName": "Exact condition name from list", "clinicalApplication": "How this scoring system is used for this condition", "isStandard": true/false}]

Rules:
- Only include conditions where this scoring system is clinically relevant
- isStandard = true if this is a standard/guideline-recommended tool for the condition
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
    const links: Array<{ conditionId: string; clinicalApplication: string; isStandard: boolean }> =
      [];

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
          clinicalApplication: item.clinicalApplication || '',
          isStandard: item.isStandard ?? false,
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
  console.log('║  Phase 3c: Populate ScoringSystemConditionLink            ║');
  console.log(
    `║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`
  );
  console.log('╚════════════════════════════════════════════════════════════╝');

  const scoringSystems = await prisma.scoringSystem.findMany({
    select: { id: true, name: true, category: true },
  });
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true },
  });

  const existing = await prisma.scoringSystemConditionLink.findMany({
    select: { scoringSystemId: true, conditionId: true },
  });
  const existingSet = new Set(existing.map((l) => `${l.scoringSystemId}:${l.conditionId}`));

  console.log(`\nScoring systems: ${scoringSystems.length}`);
  console.log(`Conditions: ${conditions.length}`);
  console.log(`Existing links: ${existing.length}\n`);

  let created = 0;
  let skipped = 0;

  for (const ss of scoringSystems) {
    console.log(`🎯 ${ss.name}...`);
    const links = await generateScoringLinks(ss, conditions);

    for (const link of links) {
      const key = `${ss.id}:${link.conditionId}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      if (!DRY_RUN) {
        try {
          await prisma.scoringSystemConditionLink.create({
            data: {
              id: uuidv4(),
              scoringSystemId: ss.id,
              conditionId: link.conditionId,
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

    // Rate limit
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
