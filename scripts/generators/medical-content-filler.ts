import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private lastRefill: number;

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async consume(): Promise<void> {
    this.refill();
    while (this.tokens < 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
      this.refill();
    }
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

interface ContentToFill {
  overview?: boolean;
  epidemiology?: boolean;
  etiology?: boolean;
  pathophysiology?: boolean;
  symptoms?: boolean;
  physicalExam?: boolean;
  diagnostics?: boolean;
  treatment?: boolean;
  complications?: boolean;
  prognosis?: boolean;
  mnemonic?: boolean;
  clinical_pearls?: boolean;
  differentials?: boolean;
  classic_triad?: boolean;
  first_line_rx?: boolean;
  gold_standard_dx?: boolean;
  best_initial_test?: boolean;
}

async function generateContentForCondition(
  conditionName: string,
  system: string,
  fieldsToFill: ContentToFill
): Promise<any> {
  const fieldsNeeded = Object.keys(fieldsToFill).filter(k => fieldsToFill[k as keyof ContentToFill]);
  
  const prompt = `You are a medical content expert creating board-relevant content for PANCE/PANRE preparation.

Condition: ${conditionName}
System: ${system}

Generate the following fields with accurate, concise, board-relevant content:

${fieldsNeeded.includes('overview') ? '1. Overview (2-3 sentences defining the condition)' : ''}
${fieldsNeeded.includes('epidemiology') ? '2. Epidemiology (prevalence, demographics, risk populations - 2-3 sentences)' : ''}
${fieldsNeeded.includes('etiology') ? '3. Etiology (causes and triggers - 2-3 sentences)' : ''}
${fieldsNeeded.includes('pathophysiology') ? '4. Pathophysiology (mechanism of disease - 2-3 sentences)' : ''}
${fieldsNeeded.includes('symptoms') ? '5. Symptoms (key presenting symptoms - bulleted list)' : ''}
${fieldsNeeded.includes('physicalExam') ? '6. Physical Exam Findings (key examination findings - bulleted list)' : ''}
${fieldsNeeded.includes('diagnostics') ? '7. Diagnostics (diagnostic workup - bulleted list with best initial test, gold standard, etc.)' : ''}
${fieldsNeeded.includes('treatment') ? '8. Treatment (management approach - bulleted list with first-line, alternatives)' : ''}
${fieldsNeeded.includes('complications') ? '9. Complications (potential complications - bulleted list)' : ''}
${fieldsNeeded.includes('prognosis') ? '10. Prognosis (expected outcomes - 1-2 sentences)' : ''}
${fieldsNeeded.includes('mnemonic') ? '11. Mnemonic (memorable mnemonic for key features or diagnosis)' : ''}
${fieldsNeeded.includes('clinical_pearls') ? '12. Clinical Pearls (3-5 high-yield clinical pearls as JSON array)' : ''}
${fieldsNeeded.includes('differentials') ? '13. Differentials (top 3-5 differential diagnoses as JSON array)' : ''}
${fieldsNeeded.includes('classic_triad') ? '14. Classic Triad (if applicable, as JSON object with three features)' : ''}
${fieldsNeeded.includes('first_line_rx') ? '15. First-Line Treatment (specific first-line medication/approach)' : ''}
${fieldsNeeded.includes('gold_standard_dx') ? '16. Gold Standard Diagnosis (definitive diagnostic test)' : ''}
${fieldsNeeded.includes('best_initial_test') ? '17. Best Initial Test (most appropriate initial diagnostic test)' : ''}

Return a valid JSON object with these exact keys:
${JSON.stringify(fieldsNeeded)}

Be specific, accurate, and board-relevant. For JSON fields (clinical_pearls, differentials, classic_triad), return proper JSON structures.`;

  await rateLimiter.consume();

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const content = JSON.parse(jsonMatch[0]);
  
  // Convert JSON field strings back to proper JSON if needed
  if (content.clinical_pearls && typeof content.clinical_pearls === 'string') {
    content.clinical_pearls = JSON.parse(content.clinical_pearls);
  }
  if (content.differentials && typeof content.differentials === 'string') {
    content.differentials = JSON.parse(content.differentials);
  }
  if (content.classic_triad && typeof content.classic_triad === 'string') {
    content.classic_triad = JSON.parse(content.classic_triad);
  }

  return content;
}

async function fillMedicalContent() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSize = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '10');
  const skip = parseInt(args.find(a => a.startsWith('--skip='))?.split('=')[1] || '0');

  console.log('🏥 MedicalContent Comprehensive Filler');
  console.log('========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Skip: ${skip}\n`);

  try {
    // Find records with missing critical fields
    const records = await prisma.medicalContent.findMany({
      where: {
        OR: [
          { overview: '' },
          { overview: null },
          { epidemiology: '' },
          { epidemiology: null },
          { etiology: '' },
          { etiology: null },
          { pathophysiology: '' },
          { pathophysiology: null },
          { symptoms: '' },
          { symptoms: null },
          { physicalExam: '' },
          { physicalExam: null },
          { diagnostics: '' },
          { diagnostics: null },
          { treatment: '' },
          { treatment: null },
          { mnemonic: '' },
          { mnemonic: null },
          { first_line_rx: '' },
          { first_line_rx: null },
          { gold_standard_dx: '' },
          { gold_standard_dx: null },
          { best_initial_test: '' },
          { best_initial_test: null },
        ],
      },
      skip,
      take: batchSize,
      select: {
        id: true,
        conditionId: true,
        condition: true,
        system: true,
        overview: true,
        epidemiology: true,
        etiology: true,
        pathophysiology: true,
        symptoms: true,
        physicalExam: true,
        diagnostics: true,
        treatment: true,
        complications: true,
        prognosis: true,
        mnemonic: true,
        clinical_pearls: true,
        differentials: true,
        classic_triad: true,
        first_line_rx: true,
        gold_standard_dx: true,
        best_initial_test: true,
      },
    });

    console.log(`Found ${records.length} records needing content\n`);

    let successCount = 0;
    let failCount = 0;

    for (const record of records) {
      try {
        // Determine which fields need filling
        const fieldsToFill: ContentToFill = {
          overview: !record.overview || record.overview.trim() === '',
          epidemiology: !record.epidemiology || record.epidemiology.trim() === '',
          etiology: !record.etiology || record.etiology.trim() === '',
          pathophysiology: !record.pathophysiology || record.pathophysiology.trim() === '',
          symptoms: !record.symptoms || record.symptoms.trim() === '',
          physicalExam: !record.physicalExam || record.physicalExam.trim() === '',
          diagnostics: !record.diagnostics || record.diagnostics.trim() === '',
          treatment: !record.treatment || record.treatment.trim() === '',
          complications: !record.complications || record.complications.trim() === '',
          prognosis: !record.prognosis || record.prognosis.trim() === '',
          mnemonic: !record.mnemonic || record.mnemonic.trim() === '',
          clinical_pearls: !record.clinical_pearls,
          differentials: !record.differentials,
          classic_triad: !record.classic_triad,
          first_line_rx: !record.first_line_rx || record.first_line_rx.trim() === '',
          gold_standard_dx: !record.gold_standard_dx || record.gold_standard_dx.trim() === '',
          best_initial_test: !record.best_initial_test || record.best_initial_test.trim() === '',
        };

        const needsFilling = Object.values(fieldsToFill).some(v => v);
        if (!needsFilling) {
          continue;
        }

        console.log(`📋 Filling: ${record.condition}`);
        console.log(`   Fields: ${Object.keys(fieldsToFill).filter(k => fieldsToFill[k as keyof ContentToFill]).join(', ')}`);

        if (dryRun) {
          console.log('   [DRY RUN - Skipping actual generation]');
          successCount++;
          continue;
        }

        const generatedContent = await generateContentForCondition(
          record.condition,
          record.system,
          fieldsToFill
        );

        // Merge generated content with existing
        const updateData: any = {};
        for (const [key, value] of Object.entries(generatedContent)) {
          if (fieldsToFill[key as keyof ContentToFill]) {
            updateData[key] = value;
          }
        }

        await prisma.medicalContent.update({
          where: { id: record.id },
          data: updateData,
        });

        console.log(`   ✅ Updated successfully\n`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Error filling ${record.condition}:`, error instanceof Error ? error.message : String(error));
        failCount++;
      }
    }

    console.log('\n========================================');
    console.log(`Summary:`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  📊 Total: ${records.length}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fillMedicalContent();
