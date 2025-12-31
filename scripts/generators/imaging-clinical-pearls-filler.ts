/**
 * Imaging Clinical Pearls Filler
 * 
 * Fills missing clinicalPearls for ImagingStudy records using Gemini 2.5 Flash.
 * Generates board-relevant clinical pearls for imaging findings.
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Token bucket for rate limiting
class TokenBucket {
  private tokens: number = 5;
  private lastRequest: number = 0;

  async acquire(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < 2000) {
      await new Promise(resolve => setTimeout(resolve, 2000 - timeSinceLastRequest));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
    
    this.lastRequest = Date.now();
  }
}

const rateLimiter = new TokenBucket();

const prisma = new PrismaClient();

interface ClinicalPearls {
  clinicalPearls: string[];
}

async function generateClinicalPearls(
  studyName: string,
  description: string,
  indications: string,
  classicSigns: string
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  });

  await rateLimiter.acquire();

  const prompt = `You are a medical education expert creating board exam study materials.

Generate exactly 3 high-yield clinical pearls for this imaging study that would be valuable for PANCE preparation:

Imaging Study: ${studyName}
Description: ${description}
Indications: ${indications}
Classic Signs: ${classicSigns}

Requirements:
- Focus on board-relevant clinical correlations
- Each pearl must be 1 sentence only (maximum 20 words)
- Mention classic presentations or patterns
- Make them memorable and clinically actionable
- Generate EXACTLY 3 pearls

Return only JSON:
{"clinicalPearls": ["pearl 1", "pearl 2", "pearl 3"]}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  try {
    const parsed: ClinicalPearls = JSON.parse(text);
    return parsed.clinicalPearls || [];
  } catch (parseError) {
    throw new Error(`JSON parse error: ${parseError}. Response: ${text.substring(0, 200)}`);
  }
}

async function fillImagingClinicalPearls(batchSize: number = 5) {
  console.log('\n🔬 Imaging Clinical Pearls Filler');
  console.log('============================================================\n');

  try {
    // Find ImagingStudy records missing clinicalPearls
    const missingPearls = await prisma.imagingStudy.findMany({
      where: {
        clinicalPearls: { isEmpty: true }
      },
      select: {
        id: true,
        name: true,
        modality: true,
        description: true,
        indications: true,
        classicSigns: true,
      },
      take: batchSize,
    });

    console.log(`📊 Found ${missingPearls.length} ImagingStudy records missing clinical pearls\n`);

    if (missingPearls.length === 0) {
      console.log('✅ All ImagingStudy records have clinical pearls!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const study of missingPearls) {
      try {
        console.log(`\n🔍 Processing: ${study.name}`);
        
        const clinicalPearls = await generateClinicalPearls(
          study.name,
          study.description || '',
          study.indications.join(', '),
          study.classicSigns.join(', ')
        );

        await prisma.imagingStudy.update({
          where: { id: study.id },
          data: { clinicalPearls },
        });

        console.log(`✅ Generated ${clinicalPearls.length} clinical pearls`);
        clinicalPearls.forEach((pearl, idx) => {
          console.log(`   ${idx + 1}. ${pearl}`);
        });
        successCount++;

      } catch (error) {
        console.error(`❌ Error processing ${study.name}:`, error);
        errorCount++;
      }
    }

    console.log('\n============================================================');
    console.log(`✅ Successfully filled: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Completion rate: ${((successCount / missingPearls.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const batchSizeArg = args.find(arg => arg.startsWith('--batch='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 5;

fillImagingClinicalPearls(batchSize);
