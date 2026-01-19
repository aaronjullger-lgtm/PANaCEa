/**
 * scripts/standardize-formatting.ts
 *
 * 📝 Text Formatting & Structure Standardization Script
 *
 * Standardizes markdown formatting AND structure across all medical content:
 * - Bold (**text**) for emphasis and key terms
 * - Italic (*text*) for medications, Latin terms
 * - Bullet points with proper nesting
 * - Consistent line breaks and spacing
 * - Numbered lists for sequences
 * - Headers for section organization
 * - STRUCTURAL CONSISTENCY across all conditions
 * - AI-powered regeneration for malformed content
 *
 * Usage:
 *   npx ts-node scripts/standardize-formatting.ts [--dry-run] [--system=CV]
 *   npx ts-node scripts/standardize-formatting.ts --regenerate [--system=CV]
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

config();

config();

const prisma = new PrismaClient();

// Initialize Gemini for AI-powered regeneration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
}

// Standard structure template
const STANDARD_STRUCTURE = {
  overview: {
    minWords: 50,
    structure:
      'Start with a clear definition. Include prevalence if notable. End with clinical significance.',
    example:
      'Condition X is a [type] characterized by [key features]. It affects approximately [prevalence]. [Clinical significance].',
  },
  etiology: {
    minWords: 40,
    structure:
      'Primary causes first, then contributing factors. Use categories if multiple etiologies.',
    example:
      '**Primary causes**: [list]. **Contributing factors**: [list]. **Genetic/Environmental**: [if applicable].',
  },
  pathophysiology: {
    minWords: 50,
    structure:
      'Step-by-step mechanism. Start with initial insult, progress through cascade, end with clinical manifestation.',
    example: 'Initial [trigger] → [cascade steps] → [end result/clinical presentation].',
  },
  diagnostics: {
    minWords: 50,
    structure:
      'Organized by testing sequence: Initial workup → Confirmatory tests → Gold standard. Include sensitivity/specificity if known.',
    example:
      '**Initial**: [screening tests]. **Confirmatory**: [diagnostic tests]. **Gold standard**: [definitive test].',
  },
  treatment: {
    minItems: 3,
    structure:
      'Array format. Order: First-line → Second-line → Adjunctive → Emergency. Include drug classes and specific examples.',
    example: [
      'First-line: [drug class] (e.g., [specific drug])',
      'Second-line: [alternatives]',
      'Adjunctive: [supportive care]',
    ],
  },
  symptoms: {
    minItems: 4,
    structure: 'Array format. Cardinal symptoms first, then common, then rare but important.',
    example: [
      'Cardinal symptom 1',
      'Cardinal symptom 2',
      'Common symptom',
      'Rare but significant symptom',
    ],
  },
  complications: {
    minItems: 3,
    structure: 'Array format. Life-threatening first, then serious, then manageable.',
    example: [
      'Life-threatening: [complication]',
      'Serious: [complication]',
      'Common: [complication]',
    ],
  },
};

interface FormattingRules {
  // Bold patterns
  boldPatterns: Array<{ pattern: RegExp; replacement: string }>;
  // Italic patterns
  italicPatterns: Array<{ pattern: RegExp; replacement: string }>;
  // List formatting
  listPatterns: Array<{ pattern: RegExp; replacement: string }>;
  // Line break rules
  lineBreakRules: Array<{ pattern: RegExp; replacement: string }>;
}

const FORMATTING_RULES: FormattingRules = {
  boldPatterns: [
    // Medical abbreviations and acronyms
    {
      pattern:
        /\b(PANCE|PANRE|FDA|CDC|WHO|HIV|AIDS|COPD|GERD|CHF|HTN|DM|MI|PE|DVT|AFib|SVT|VT|VF)\b/g,
      replacement: '**$1**',
    },
    // Key diagnostic terms
    {
      pattern:
        /\b(pathognomonic|gold standard|first-line|definitive|emergent|urgent|critical|essential)\b/gi,
      replacement: '**$1**',
    },
    // Cardinal signs/symptoms when preceded by numbers
    {
      pattern:
        /(\d+)\s+(cardinal|classic|major|primary)\s+(sign|symptom|feature|criterion|criteria)/gi,
      replacement: '$1 **$2 $3**',
    },
  ],

  italicPatterns: [
    // Generic drug names (common patterns)
    {
      pattern:
        /\b([a-z]+)(olol|pril|sartan|statin|mycin|cillin|floxacin|azole|pine|zepam|triptyline)\b/g,
      replacement: '*$1$2*',
    },
    // Latin terms
    {
      pattern: /\b(in situ|in vitro|in vivo|per os|status post|ad libitum)\b/gi,
      replacement: '*$1*',
    },
    // Organism names (genus species)
    {
      pattern: /\b([A-Z][a-z]+)\s+([a-z]+)\b(?=\s+(?:infection|disease|bacteria|virus|fungus))/g,
      replacement: '*$1 $2*',
    },
  ],

  listPatterns: [
    // Convert numbered lists to markdown
    { pattern: /^(\d+)\.\s+/gm, replacement: '$1. ' },
    // Convert bullet variations to consistent markdown
    { pattern: /^[•●○▪▫]\s+/gm, replacement: '- ' },
    // Ensure space after dash bullets
    { pattern: /^-(?!\s)/gm, replacement: '- ' },
    // Create nested lists (2 spaces for sub-items)
    { pattern: /^\s{2,4}-\s+/gm, replacement: '  - ' },
    { pattern: /^\s{5,8}-\s+/gm, replacement: '    - ' },
  ],

  lineBreakRules: [
    // Remove triple+ line breaks
    { pattern: /\n{3,}/g, replacement: '\n\n' },
    // Ensure line break before headers
    { pattern: /([^\n])\n(#{1,6}\s)/g, replacement: '$1\n\n$2' },
    // Ensure line break after headers
    { pattern: /(#{1,6}\s[^\n]+)\n([^\n])/g, replacement: '$1\n\n$2' },
    // Trim trailing whitespace
    { pattern: /[ \t]+$/gm, replacement: '' },
    // Normalize list spacing
    { pattern: /\n([•-])/g, replacement: '\n$1' },
  ],
};

function standardizeText(text: string, fieldName: string): string {
  if (!text || text === 'NONE') return text;

  let formatted = text;

  // Apply bold patterns
  for (const rule of FORMATTING_RULES.boldPatterns) {
    formatted = formatted.replace(rule.pattern, rule.replacement);
  }

  // Apply italic patterns
  for (const rule of FORMATTING_RULES.italicPatterns) {
    formatted = formatted.replace(rule.pattern, rule.replacement);
  }

  // Apply list formatting
  if (
    fieldName.includes('treatment') ||
    fieldName.includes('symptoms') ||
    fieldName.includes('complications')
  ) {
    for (const rule of FORMATTING_RULES.listPatterns) {
      formatted = formatted.replace(rule.pattern, rule.replacement);
    }
  }

  // Apply line break rules
  for (const rule of FORMATTING_RULES.lineBreakRules) {
    formatted = formatted.replace(rule.pattern, rule.replacement);
  }

  // Remove duplicate bold/italic markers
  formatted = formatted.replace(/\*{3,}/g, '**');
  formatted = formatted.replace(/_{3,}/g, '__');

  // Fix nested markers
  formatted = formatted.replace(/\*\*([^*]+)\*([^*]+)\*\*/g, '**$1*$2***');

  return formatted.trim();
}

function standardizeArray(arr: string[], fieldName: string): string[] {
  if (!arr || !Array.isArray(arr)) return arr;

  return arr.map((item) => {
    if (typeof item !== 'string') return item;
    return standardizeText(item, fieldName);
  });
}

// Structural validation
function validateStructure(content: any): {
  isValid: boolean;
  issues: string[];
  needsRegeneration: boolean;
} {
  const issues: string[] = [];

  // Check key text fields for minimum length
  if (content.overview && content.overview !== 'NONE') {
    const wordCount = content.overview.split(/\s+/).length;
    if (wordCount < STANDARD_STRUCTURE.overview.minWords) {
      issues.push(
        `overview too short (${wordCount}w, min: ${STANDARD_STRUCTURE.overview.minWords}w)`
      );
    }
  }

  if (content.etiology && content.etiology !== 'NONE') {
    const wordCount = content.etiology.split(/\s+/).length;
    if (wordCount < STANDARD_STRUCTURE.etiology.minWords) {
      issues.push(
        `etiology too short (${wordCount}w, min: ${STANDARD_STRUCTURE.etiology.minWords}w)`
      );
    }
  }

  if (content.pathophysiology && content.pathophysiology !== 'NONE') {
    const wordCount = content.pathophysiology.split(/\s+/).length;
    if (wordCount < STANDARD_STRUCTURE.pathophysiology.minWords) {
      issues.push(
        `pathophysiology too short (${wordCount}w, min: ${STANDARD_STRUCTURE.pathophysiology.minWords}w)`
      );
    }
  }

  if (content.diagnostics && content.diagnostics !== 'NONE') {
    const wordCount = content.diagnostics.split(/\s+/).length;
    if (wordCount < STANDARD_STRUCTURE.diagnostics.minWords) {
      issues.push(
        `diagnostics too short (${wordCount}w, min: ${STANDARD_STRUCTURE.diagnostics.minWords}w)`
      );
    }
  }

  // Check array fields for minimum items
  if (content.symptoms && Array.isArray(content.symptoms)) {
    if (content.symptoms.length < STANDARD_STRUCTURE.symptoms.minItems) {
      issues.push(
        `symptoms insufficient (${content.symptoms.length} items, min: ${STANDARD_STRUCTURE.symptoms.minItems})`
      );
    }
  }

  if (content.complications && Array.isArray(content.complications)) {
    if (content.complications.length < STANDARD_STRUCTURE.complications.minItems) {
      issues.push(
        `complications insufficient (${content.complications.length} items, min: ${STANDARD_STRUCTURE.complications.minItems})`
      );
    }
  }

  // Check for structural consistency
  const hasOverview = content.overview && content.overview !== 'NONE';
  const hasPathophys = content.pathophysiology && content.pathophysiology !== 'NONE';
  const hasDiagnostics = content.diagnostics && content.diagnostics !== 'NONE';

  if (!hasOverview) {
    issues.push('missing overview');
  }
  if (!hasPathophys) {
    issues.push('missing pathophysiology');
  }
  if (!hasDiagnostics) {
    issues.push('missing diagnostics');
  }

  return {
    isValid: issues.length === 0,
    issues,
    needsRegeneration: issues.length >= 3, // Regenerate if 3+ issues
  };
}

// AI-powered regeneration for insufficient content
async function regenerateField(content: any, fieldName: string): Promise<string | string[]> {
  if (!model) {
    throw new Error('Gemini API not initialized. Set GEMINI_API_KEY environment variable.');
  }

  const structureGuide = STANDARD_STRUCTURE[fieldName as keyof typeof STANDARD_STRUCTURE];
  if (!structureGuide) {
    throw new Error(`No structure guide for field: ${fieldName}`);
  }

  const prompt = `You are enhancing medical education content for ${content.condition} (${content.system} system).

FIELD TO ENHANCE: ${fieldName}

CURRENT CONTENT (inadequate):
${typeof content[fieldName] === 'string' ? content[fieldName] : JSON.stringify(content[fieldName])}

STRUCTURAL REQUIREMENTS:
${JSON.stringify(structureGuide, null, 2)}

CONTEXT FROM EXISTING RECORD:
- Condition: ${content.condition}
- System: ${content.system}
- Overview: ${content.overview?.substring(0, 200) || 'Not available'}
- Buzzwords: ${Array.isArray(content.buzzwords) ? content.buzzwords.join(', ') : 'Not available'}

INSTRUCTIONS:
1. Generate comprehensive, high-quality content for the ${fieldName} field
2. Follow the structural requirements exactly
3. Use proper markdown formatting:
   - **Bold** for medical abbreviations and key terms
   - *Italic* for medications and Latin terms
   - Bullet points (- item) for lists
4. Be specific and clinically accurate
5. Ensure content meets minimum length/item requirements
6. ${Array.isArray(content[fieldName]) ? 'Return as JSON array of strings' : 'Return as single formatted text string'}

Return ONLY the enhanced content, no explanation. ${Array.isArray(content[fieldName]) ? 'Format as JSON array.' : 'Format as plain text with markdown.'}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse response
    if (Array.isArray(content[fieldName])) {
      // Array field - parse JSON
      let jsonText = text;
      if (jsonText.startsWith('```')) {
        jsonText = jsonText
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();
      }
      return JSON.parse(jsonText);
    } else {
      // Text field - return as-is
      return text;
    }
  } catch (error) {
    console.error(`Error regenerating ${fieldName}:`, error);
    throw error;
  }
}

async function standardizeFormatting(
  dryRun: boolean = false,
  regenerate: boolean = false,
  targetSystem?: string
) {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Text Formatting Standardization                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be saved\n');
  }

  if (regenerate) {
    if (!model) {
      console.error('❌ Error: GEMINI_API_KEY not set. Cannot regenerate content.');
      console.error('   Run: export GEMINI_API_KEY=your_api_key');
      process.exit(1);
    }
    console.log('🤖 REGENERATION MODE - AI will enhance inadequate content\n');
  }

  const whereClause = targetSystem ? { system: targetSystem } : {};

  // Get total count first
  const totalCount = await prisma.medicalContent.count({
    where: whereClause,
  });

  console.log(`📊 Processing ${totalCount} conditions in batches...\n`);

  let updatedCount = 0;
  let unchangedCount = 0;
  let regeneratedCount = 0;
  const changes: Array<{ conditionId: string; field: string; before: string; after: string }> = [];

  // Process in batches to avoid memory issues and Supabase 5MB response limit
  const BATCH_SIZE = 50;
  const totalBatches = Math.ceil(totalCount / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const skip = batchIndex * BATCH_SIZE;
    console.log(
      `\n📦 Batch ${batchIndex + 1}/${totalBatches} (conditions ${skip + 1}-${Math.min(skip + BATCH_SIZE, totalCount)})...`
    );

    const batchContent = await prisma.medicalContent.findMany({
      where: whereClause,
      skip,
      take: BATCH_SIZE,
      orderBy: { conditionId: 'asc' },
    });

    for (const content of batchContent) {
      let hasChanges = false;
      const updates: any = {};

      // Step 1: Structural validation (if regenerate mode)
      if (regenerate) {
        const validation = validateStructure(content);

        if (!validation.isValid) {
          console.log(
            `  ⚠️  ${content.conditionId}: ${validation.issues.length} structural issues`
          );
          validation.issues.forEach((issue) => console.log(`      - ${issue}`));

          if (validation.needsRegeneration) {
            console.log(`  🔄 ${content.conditionId}: Regenerating inadequate fields...`);

            // Regenerate specific fields
            for (const issue of validation.issues) {
              const fieldName = issue.split(' ')[0];

              try {
                if (
                  fieldName === 'overview' ||
                  fieldName === 'etiology' ||
                  fieldName === 'pathophysiology' ||
                  fieldName === 'diagnostics'
                ) {
                  const enhanced = await regenerateField(content, fieldName);
                  updates[fieldName] = enhanced;
                  console.log(`      ✓ Regenerated ${fieldName}`);
                  hasChanges = true;
                  regeneratedCount++;

                  // Rate limiting
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                } else if (fieldName === 'symptoms' || fieldName === 'complications') {
                  const enhanced = await regenerateField(content, fieldName);
                  updates[fieldName] = enhanced;
                  console.log(`      ✓ Regenerated ${fieldName}`);
                  hasChanges = true;
                  regeneratedCount++;

                  // Rate limiting
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
              } catch (error) {
                console.error(`      ✗ Failed to regenerate ${fieldName}:`, error);
              }
            }
          }
        }
      }

      // Step 2: Apply formatting rules to all text fields
      const textFields = [
        'overview',
        'etiology',
        'epidemiology',
        'pathophysiology',
        'diagnostics',
        'treatment',
        'prognosis',
        'gold_standard_dx',
        'first_line_rx',
        'mnemonic',
        'guidelines',
        'classic_patient',
        'image_query',
        'best_initial_test',
        'rx_mechanism',
        'rx_side_effects',
        'patient_education',
        'disposition',
        'prevention',
      ];

      for (const field of textFields) {
        const original = content[field];
        if (original && typeof original === 'string' && original !== 'NONE') {
          const formatted = standardizeText(original, field);
          if (formatted !== original) {
            updates[field] = formatted;
            hasChanges = true;
            if (dryRun && changes.length < 5) {
              changes.push({
                conditionId: content.conditionId,
                field,
                before: original.substring(0, 100),
                after: formatted.substring(0, 100),
              });
            }
          }
        }
      }

      // Array fields to standardize
      const arrayFields = [
        'riskFactors',
        'symptoms',
        'physicalExam',
        'differentialDiagnosis',
        'complications',
        'buzzwords',
        'clinical_pearls',
        'synonyms',
        'age_demographic',
      ];

      for (const field of arrayFields) {
        const original = content[field];
        if (original && Array.isArray(original)) {
          const formatted = standardizeArray(original, field);
          const changed = JSON.stringify(formatted) !== JSON.stringify(original);
          if (changed) {
            updates[field] = formatted;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        updatedCount++;
        if (!dryRun) {
          await prisma.medicalContent.update({
            where: { id: content.id },
            data: updates,
          });
          console.log(
            `  ✅ ${content.conditionId}: Standardized ${Object.keys(updates).length} fields`
          );
        }
      } else {
        unchangedCount++;
      }
    }

    console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} complete`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('║   STANDARDIZATION SUMMARY                                ║');
  console.log('═'.repeat(70));
  console.log(`\n📊 Results:`);
  console.log(`   Total conditions: ${totalCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Unchanged: ${unchangedCount}`);

  if (regenerate) {
    console.log(`   🤖 AI regenerated: ${regeneratedCount} fields`);
  }

  if (dryRun && changes.length > 0) {
    console.log('\n📝 Sample changes (first 5):');
    for (const change of changes.slice(0, 5)) {
      console.log(`\n  ${change.conditionId} - ${change.field}:`);
      console.log(`    Before: ${change.before}...`);
      console.log(`    After:  ${change.after}...`);
    }
    console.log('\n💡 Run without --dry-run to apply changes');
  }

  console.log('\n✅ Formatting standardization complete!');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const regenerate = args.includes('--regenerate');
  const systemArg = args.find((arg) => arg.startsWith('--system='));
  const targetSystem = systemArg ? systemArg.split('=')[1] : undefined;

  try {
    await standardizeFormatting(dryRun, regenerate, targetSystem);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
