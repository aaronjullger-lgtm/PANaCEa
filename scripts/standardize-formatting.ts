/**
 * scripts/standardize-formatting.ts
 * 
 * 📝 Text Formatting Standardization Script
 * 
 * Standardizes markdown formatting across all medical content:
 * - Bold (**text**) for emphasis and key terms
 * - Italic (*text*) for medications, Latin terms
 * - Bullet points with proper nesting
 * - Consistent line breaks and spacing
 * - Numbered lists for sequences
 * - Headers for section organization
 * 
 * Usage: npx ts-node scripts/standardize-formatting.ts [--dry-run] [--system=CV]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    { pattern: /\b(PANCE|PANRE|FDA|CDC|WHO|HIV|AIDS|COPD|GERD|CHF|HTN|DM|MI|PE|DVT|AFib|SVT|VT|VF)\b/g, replacement: '**$1**' },
    // Key diagnostic terms
    { pattern: /\b(pathognomonic|gold standard|first-line|definitive|emergent|urgent|critical|essential)\b/gi, replacement: '**$1**' },
    // Cardinal signs/symptoms when preceded by numbers
    { pattern: /(\d+)\s+(cardinal|classic|major|primary)\s+(sign|symptom|feature|criterion|criteria)/gi, replacement: '$1 **$2 $3**' },
  ],
  
  italicPatterns: [
    // Generic drug names (common patterns)
    { pattern: /\b([a-z]+)(olol|pril|sartan|statin|mycin|cillin|floxacin|azole|pine|zepam|triptyline)\b/g, replacement: '*$1$2*' },
    // Latin terms
    { pattern: /\b(in situ|in vitro|in vivo|per os|status post|ad libitum)\b/gi, replacement: '*$1*' },
    // Organism names (genus species)
    { pattern: /\b([A-Z][a-z]+)\s+([a-z]+)\b(?=\s+(?:infection|disease|bacteria|virus|fungus))/g, replacement: '*$1 $2*' },
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
    { pattern: /\n([•\-])/g, replacement: '\n$1' },
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
  if (fieldName.includes('treatment') || fieldName.includes('symptoms') || fieldName.includes('complications')) {
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
  
  return arr.map(item => {
    if (typeof item !== 'string') return item;
    return standardizeText(item, fieldName);
  });
}

async function standardizeFormatting(dryRun: boolean = false, targetSystem?: string) {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Text Formatting Standardization                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be saved\n');
  }
  
  const whereClause = targetSystem ? { system: targetSystem } : {};
  
  const allContent = await prisma.medicalContent.findMany({
    where: whereClause,
  });
  
  console.log(`📊 Processing ${allContent.length} conditions...\n`);
  
  let updatedCount = 0;
  let unchangedCount = 0;
  const changes: Array<{ conditionId: string; field: string; before: string; after: string }> = [];
  
  for (const content of allContent) {
    let hasChanges = false;
    const updates: any = {};
    
    // Text fields to standardize
    const textFields = [
      'overview', 'etiology', 'epidemiology', 'pathophysiology', 'diagnostics',
      'treatment', 'prognosis', 'gold_standard_dx', 'first_line_rx', 
      'mnemonic', 'guidelines', 'classic_patient', 'image_query',
      'best_initial_test', 'rx_mechanism', 'rx_side_effects',
      'patient_education', 'disposition', 'prevention'
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
              after: formatted.substring(0, 100)
            });
          }
        }
      }
    }
    
    // Array fields to standardize
    const arrayFields = [
      'riskFactors', 'symptoms', 'physicalExam', 'differentialDiagnosis',
      'complications', 'buzzwords', 'clinical_pearls', 'synonyms',
      'age_demographic'
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
          data: updates
        });
        console.log(`  ✅ ${content.conditionId}: Standardized ${Object.keys(updates).length} fields`);
      }
    } else {
      unchangedCount++;
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('║   STANDARDIZATION SUMMARY                                ║');
  console.log('═'.repeat(70));
  console.log(`\n📊 Results:`);
  console.log(`   Total conditions: ${allContent.length}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Unchanged: ${unchangedCount}`);
  
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
  const systemArg = args.find(arg => arg.startsWith('--system='));
  const targetSystem = systemArg ? systemArg.split('=')[1] : undefined;
  
  try {
    await standardizeFormatting(dryRun, targetSystem);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
