#!/usr/bin/env npx tsx
/**
 * DDx Mnemonic Filler - Fill missing mnemonics in DifferentialDiagnosis table
 *
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/ddx-mnemonic-filler.ts
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateMnemonic(complaint: string, differentials: string[]): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Create 1-2 helpful mnemonics for remembering the differential diagnosis of "${complaint}".

Key differentials to include: ${differentials.slice(0, 8).join(', ')}

Return JSON with format:
{
  "mnemonics": ["MNEMONIC: M-meaning, N-meaning, E-meaning...", "Optional second mnemonic"]
}

Guidelines:
- Each mnemonic should spell out a memorable word or phrase
- Include what each letter stands for
- Focus on the most important/testable diagnoses
- If no good mnemonic exists, still create one that captures the key differentials
- Return at least 1 mnemonic, maximum 2

Return ONLY valid JSON.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON for ${complaint}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.mnemonics || [];
}

async function main(): Promise<void> {
  console.log('🧠 DDx Mnemonic Filler\n');

  // Find records with empty mnemonics
  const records = await prisma.differentialDiagnosis.findMany({
    where: { mnemonics: { isEmpty: true } },
    select: {
      id: true,
      presentingComplaint: true,
      differentialList: true,
      mostDangerous: true,
    },
  });

  console.log(`📊 Found ${records.length} DDx records missing mnemonics\n`);

  if (records.length === 0) {
    console.log('✅ All records have mnemonics!');
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const record of records) {
    try {
      console.log(`  🔄 Generating mnemonic for: ${record.presentingComplaint}...`);

      const differentials = [...(record.mostDangerous || []), ...(record.differentialList || [])];
      const mnemonics = await generateMnemonic(record.presentingComplaint, differentials);

      if (mnemonics.length > 0) {
        await prisma.differentialDiagnosis.update({
          where: { id: record.id },
          data: { mnemonics },
        });
        console.log(`  ✅ Updated: ${record.presentingComplaint} (${mnemonics.length} mnemonics)`);
        updated++;
      } else {
        console.log(`  ⚠️  No mnemonics generated for: ${record.presentingComplaint}`);
      }

      // Rate limiting
      await sleep(1500);
    } catch (error) {
      console.log(
        `  ❌ Failed: ${record.presentingComplaint} - ${error instanceof Error ? error.message : error}`
      );
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed:  ${failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
