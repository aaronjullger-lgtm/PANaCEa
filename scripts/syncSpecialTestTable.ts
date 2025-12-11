#!/usr/bin/env tsx
/**
 * Sync SpecialTest Table from Registry
 * 
 * This script syncs the SpecialTest table with the specialTestRegistry.
 * 
 * IMPORTANT: This script only ADDS new tests. It never overwrites existing database records.
 * This preserves any manual edits or AI-generated content in the database.
 * 
 * SPECIAL FEATURE: Uses Gemini API to generate in-depth content for each test including:
 * - Detailed technique/procedure
 * - Clinical rationale
 * - Interpretation of results
 * - Clinical pearls
 * 
 * Workflow:
 * 1. Add special test to specialTestRegistry.ts
 * 2. Run this script to sync SpecialTest table (adds only, no overwrites)
 * 3. Script generates comprehensive content via Gemini API
 * 4. Further automation can enhance content over time
 * 
 * Usage: tsx scripts/syncSpecialTestTable.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { SPECIAL_TEST_REGISTRY, buildSpecialTestId } from '../specialTestRegistry';

// Load environment variables
config();

const prisma = new PrismaClient();

interface SyncReport {
  startTime: Date;
  endTime?: Date;
  totalInRegistry: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ test: string; error: string }>;
}

const report: SyncReport = {
  startTime: new Date(),
  totalInRegistry: 0,
  created: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

/**
 * Generate comprehensive content for a special test using Gemini API
 */
async function generateTestContent(meta: any): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('  ⚠️  GEMINI_API_KEY not set - skipping AI content generation');
    return {
      technique: meta.technique || null,
      description: meta.description || null,
    };
  }

  const prompt = `You are a medical education expert writing comprehensive content about a physical exam special test for PA (Physician Assistant) students.

Test Name: ${meta.name}
System: ${meta.system}
Region: ${meta.region || 'N/A'}
Brief Description: ${meta.description || 'Not provided'}
Sensitivity: ${meta.sensitivity || 'Unknown'}%
Specificity: ${meta.specificity || 'Unknown'}%

Please provide detailed, high-yield content in the following JSON format:

{
  "technique": "Step-by-step instructions on how to perform the test. Be specific and clear. Include patient positioning, examiner hand placement, and the specific maneuver.",
  "positiveTest": "What constitutes a positive test result? What does the examiner feel, see, or observe?",
  "interpretation": "What does a positive test indicate? What pathology does it suggest? Include sensitivity/specificity context.",
  "clinicalPearls": "2-3 high-yield clinical pearls about this test. Tips for students to remember.",
  "limitations": "When might this test give false positives or false negatives? What are its limitations?",
  "relatedTests": "What other tests might be performed alongside this one for the same pathology?"
}

Keep the content concise but comprehensive. Use clear, professional medical language appropriate for PA students. Focus on PANCE-relevant information.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 }, // Lower temperature for factual content
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data: any = await response.json();
    let rawText = '';
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      rawText = data.candidates[0].content.parts[0].text;
    }

    // Strip code fences if present
    let text = rawText.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const generatedContent = JSON.parse(text);
    
    // Combine with registry metadata
    return {
      technique: generatedContent.technique || meta.technique || null,
      description: meta.description || null,
      positiveTest: generatedContent.positiveTest || null,
      interpretation: generatedContent.interpretation || null,
      clinicalPearls: generatedContent.clinicalPearls || null,
      limitations: generatedContent.limitations || null,
      relatedTests: generatedContent.relatedTests || null,
    };
  } catch (error: any) {
    console.warn(`  ⚠️  Failed to generate AI content: ${error.message}`);
    // Fallback to basic content
    return {
      technique: meta.technique || null,
      description: meta.description || null,
    };
  }
}

/**
 * Evaluate if existing content is sufficient and accurate
 */
function evaluateContentQuality(existing: any): { needsUpdate: boolean; reason?: string } {
  // Check if technique field is missing or too short
  if (!existing.technique || existing.technique.length < 50) {
    return { needsUpdate: true, reason: 'Insufficient technique description' };
  }

  // Check for placeholder content
  if (existing.technique.includes('[NO CONTENT') || existing.technique.includes('TODO')) {
    return { needsUpdate: true, reason: 'Contains placeholder text' };
  }

  // If description is too basic or missing
  if (!existing.description || existing.description.length < 30) {
    return { needsUpdate: true, reason: 'Insufficient description' };
  }

  // Content seems adequate
  return { needsUpdate: false };
}

/**
 * Sync a single special test from registry to database (ADD ONLY)
 * Checks existing content and evaluates if it needs improvement
 */
async function syncSpecialTest(meta: any): Promise<void> {
  const testId = buildSpecialTestId(meta);

  try {
    // Check if test exists by name
    const existing = await prisma.specialTest.findFirst({
      where: {
        name: meta.name,
      },
    });

    if (existing) {
      // Evaluate if existing content is sufficient
      const quality = evaluateContentQuality(existing);
      
      if (!quality.needsUpdate) {
        report.skipped++;
        console.log(`  ⏭️  Skipped (already exists with sufficient content): ${meta.name}`);
        return;
      } else {
        // Content exists but needs improvement - for now, still skip to preserve manual edits
        // Future enhancement: could offer to update with approval
        report.skipped++;
        console.log(`  ⏭️  Skipped (exists but ${quality.reason} - preserving existing): ${meta.name}`);
        return;
      }
    }

    // Generate comprehensive content using Gemini API
    console.log(`  🤖 Generating content for: ${meta.name}...`);
    const generatedContent = await generateTestContent(meta);

    // Build comprehensive description
    let fullDescription = meta.description || '';
    if (generatedContent.clinicalPearls) {
      fullDescription += `\n\nClinical Pearls:\n${generatedContent.clinicalPearls}`;
    }
    if (generatedContent.limitations) {
      fullDescription += `\n\nLimitations:\n${generatedContent.limitations}`;
    }
    if (generatedContent.relatedTests) {
      fullDescription += `\n\nRelated Tests:\n${generatedContent.relatedTests}`;
    }

    // Build comprehensive technique description
    let fullTechnique = generatedContent.technique || '';
    if (generatedContent.positiveTest) {
      fullTechnique += `\n\nPositive Test:\n${generatedContent.positiveTest}`;
    }
    if (generatedContent.interpretation) {
      fullTechnique += `\n\nInterpretation:\n${generatedContent.interpretation}`;
    }

    // Create new special test (ADD ONLY) with AI-generated content
    await prisma.specialTest.create({
      data: {
        id: testId,
        name: meta.name,
        description: fullDescription.trim() || null,
        sensitivity: meta.sensitivity || null,
        specificity: meta.specificity || null,
        technique: fullTechnique.trim() || null,
        imageUrl: null, // Will be filled by media automation
        videoUrl: null, // Will be filled by media automation
      },
    });
    report.created++;
    console.log(`  ✨ Created with AI content: ${meta.name} (${meta.system}${meta.region ? ' - ' + meta.region : ''})`);
  } catch (error: any) {
    report.failed++;
    report.errors.push({
      test: meta.name,
      error: error.message,
    });
    console.error(`  ❌ Failed: ${meta.name} - ${error.message}`);
  }
}

/**
 * Sync all special tests from registry
 */
async function syncAllTests(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    Syncing SpecialTest Table from Registry (ADD ONLY)     ║');
  console.log('║    Using Gemini API for In-Depth Content Generation       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  report.totalInRegistry = SPECIAL_TEST_REGISTRY.length;
  console.log(`📊 Total special tests in registry: ${report.totalInRegistry}\n`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('⚠️  WARNING: GEMINI_API_KEY not set.');
    console.log('   Tests will be created with basic metadata only.');
    console.log('   Set GEMINI_API_KEY to enable AI-powered content generation.\n');
  }

  for (const meta of SPECIAL_TEST_REGISTRY) {
    await syncSpecialTest(meta);
    
    // Rate limiting: Wait 1 second between API calls to avoid hitting rate limits
    if (apiKey) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Print summary report
 */
function printReport(): void {
  report.endTime = new Date();
  const duration = (report.endTime.getTime() - report.startTime.getTime()) / 1000;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    Sync Report Summary                                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`⏱️  Duration: ${duration.toFixed(2)}s`);
  console.log(`📊 Total in Registry: ${report.totalInRegistry}`);
  console.log(`✨ Created (New): ${report.created}`);
  console.log(`⏭️  Skipped (Existing): ${report.skipped}`);
  console.log(`❌ Failed: ${report.failed}`);

  if (report.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    report.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.test}: ${err.error}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Main execution
 */
async function main() {
  try {
    await syncAllTests();
    printReport();

    if (report.failed > 0) {
      console.log('\n⚠️  Some tests failed to sync. Check errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ SpecialTest table sync completed successfully!');
      
      if (report.created > 0) {
        console.log(`\n💡 ${report.created} new special tests added to database.`);
        console.log('   Automation will generate detailed content for these tests.');
      }
      
      if (report.skipped > 0) {
        console.log(`\n📝 ${report.skipped} tests already exist in database (preserved, not overwritten).`);
      }
      
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during sync:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { syncAllTests };
