#!/usr/bin/env tsx
/**
 * SPRINT 3: Existing Condition Categorization
 *
 * Maps existing 1,223 conditions to blueprint subcategories using AI.
 * DOES NOT merge conditions - maintains granularity.
 *
 * Strategy:
 * 1. Load all existing conditions from database
 * 2. For each condition, use AI to determine:
 *    - Best matching blueprint subcategory
 *    - Parent category (if nested hierarchy)
 * 3. Generate mapping file for review before applying
 */

import { prisma } from './helpers/prisma-client';
import fs from 'fs';
import path from 'path';

interface ExistingCondition {
  id: string;
  name: string;
  system: string;
  subcategory: string | null;
  current_parent_category: string | null;
}

interface CategoryMapping {
  conditionId: string;
  conditionName: string;
  currentSystem: string;
  currentSubcategory: string | null;

  // Proposed mappings
  proposedSubcategory: string;
  proposedParentCategory: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

// Manual mappings for common patterns (will expand with AI for complex cases)
const SUBCATEGORY_PATTERNS: Record<
  string,
  { subcategory: string; parent?: string; keywords: string[] }
> = {
  // Cardiovascular - Acute Coronary Syndrome
  acs: {
    subcategory: 'Acute Coronary Syndrome',
    parent: 'Coronary Artery Disease',
    keywords: [
      'stemi',
      'nstemi',
      'unstable angina',
      'myocardial infarction',
      ' mi ',
      'acute mi',
      'inferior mi',
      'anterior mi',
      'lateral mi',
      'posterior mi',
    ],
  },

  // Cardiovascular - Cardiomyopathy
  cardiomyopathy: {
    subcategory: 'Cardiomyopathy',
    keywords: [
      'dilated cardiomyopathy',
      'hypertrophic cardiomyopathy',
      'restrictive cardiomyopathy',
    ],
  },

  // Cardiovascular - Arrhythmias
  arrhythmia: {
    subcategory: 'Conduction Disorders / Dysrhythmias',
    keywords: [
      'atrial fibrillation',
      'atrial flutter',
      'ventricular tachycardia',
      'bradycardia',
      'tachycardia',
      'arrhythmia',
      'dysrhythmia',
      'block',
      'fibrillation',
      'brugada',
      'long qt',
      'wpw',
      'wolff-parkinson',
    ],
  },

  // Cardiovascular - Vascular Disease
  vascular: {
    subcategory: 'Vascular Disease',
    keywords: [
      'aneurysm',
      'dissection',
      'dvt',
      'deep venous thrombosis',
      'deep vein thrombosis',
      'peripheral artery',
      'varicose',
      'phlebitis',
      'arteritis',
    ],
  },

  // Cardiovascular - Hypertension
  hypertension: {
    subcategory: 'Hypertension',
    keywords: ['hypertension', 'htn', 'high blood pressure', 'hypertensive'],
  },

  // Cardiovascular - Lipid Disorders
  lipid: {
    subcategory: 'Lipid Disorders',
    keywords: ['dyslipidemia', 'hyperlipidemia', 'hypercholesterolemia', 'lipid'],
  },

  // Cardiovascular - Valvular
  valve: {
    subcategory: 'Valvular Disorders',
    keywords: [
      'valve',
      'valvular',
      'stenosis',
      'regurgitation',
      'prolapse',
      'aortic valve',
      'mitral valve',
    ],
  },

  // Pulmonary - Pneumonia
  pneumonia: {
    subcategory: 'Infectious Disorders',
    parent: 'Pneumonias',
    keywords: ['pneumonia', 'cap', 'hap', 'aspiration pneumonia'],
  },

  // Pulmonary - COPD/Asthma
  obstructive: {
    subcategory: 'Obstructive Pulmonary Diseases',
    keywords: ['copd', 'asthma', 'emphysema', 'chronic bronchitis', 'obstructive'],
  },

  // Neurologic - Seizures
  seizure: {
    subcategory: 'Seizure Disorders',
    keywords: ['seizure', 'epilepsy', 'convulsion', 'status epilepticus'],
  },

  // Neurologic - Stroke
  stroke: {
    subcategory: 'Cerebrovascular Disorders',
    keywords: [
      'stroke',
      'cva',
      'tia',
      'transient ischemic',
      'cerebrovascular accident',
      'hemorrhage intracranial',
    ],
  },

  // Neurologic - Headaches
  headache: {
    subcategory: 'Headaches',
    keywords: ['headache', 'migraine', 'cluster headache', 'tension headache'],
  },

  // GI - Hepatic
  hepatic: {
    subcategory: 'Hepatic Disorders',
    keywords: ['hepatitis', 'cirrhosis', 'liver', 'hepatic'],
  },

  // GI - Biliary
  biliary: {
    subcategory: 'Biliary Disorders',
    keywords: ['cholecystitis', 'cholelithiasis', 'cholangitis', 'gallbladder', 'biliary'],
  },

  // GI - Inflammatory Bowel
  ibd: {
    subcategory: 'Colorectal Disorders',
    parent: 'Inflammatory Bowel Disease',
    keywords: ['crohn', 'ulcerative colitis', 'inflammatory bowel'],
  },

  // Dermatology - Infectious
  derm_infection: {
    subcategory: 'Infectious Diseases',
    keywords: ['cellulitis', 'abscess', 'impetigo', 'folliculitis', 'dermatophyte'],
  },

  // Psychiatric - Depression
  depression: {
    subcategory: 'Depressive Disorders',
    keywords: ['depression', 'depressive', 'dysthymia', 'suicidal'],
  },

  // Psychiatric - Anxiety
  anxiety: {
    subcategory: 'Anxiety Disorders',
    keywords: ['anxiety', 'panic', 'phobia', 'gad'],
  },
};

// System-specific pattern groups
const SYSTEM_PATTERNS: Record<string, string[]> = {
  CV: ['acs', 'cardiomyopathy', 'arrhythmia', 'vascular', 'hypertension', 'lipid', 'valve'],
  PULM: ['pneumonia', 'obstructive'],
  NEURO: ['seizure', 'stroke', 'headache'],
  GI: ['hepatic', 'biliary', 'ibd'],
  DERM: ['derm_infection'],
  PSYCH: ['depression', 'anxiety'],
};

function matchPatternSubcategory(
  conditionName: string,
  system: string
): {
  subcategory: string;
  parent: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
} | null {
  const nameLower = conditionName.toLowerCase();

  // Get valid patterns for this system
  const validPatterns = SYSTEM_PATTERNS[system] || [];

  // Medical acronyms that should use word boundaries even if longer
  const acronyms = [
    'stemi',
    'nstemi',
    'mi',
    'pe',
    'dvt',
    'af',
    'vt',
    'wpw',
    'all',
    'aml',
    'cll',
    'cml',
    'ibd',
    'copd',
    'ckd',
    'ards',
  ];

  for (const [patternKey, pattern] of Object.entries(SUBCATEGORY_PATTERNS)) {
    // Skip patterns not valid for this system
    if (validPatterns.length > 0 && !validPatterns.includes(patternKey)) {
      continue;
    }

    for (const keyword of pattern.keywords) {
      const keywordLower = keyword.toLowerCase().trim();

      // For short keywords or known acronyms, use word boundary matching
      if (keywordLower.length <= 3 || acronyms.includes(keywordLower)) {
        const regex = new RegExp(`\\b${keywordLower}\\b`);
        if (regex.test(nameLower)) {
          return {
            subcategory: pattern.subcategory,
            parent: pattern.parent || null,
            confidence: 'high',
            reasoning: `Matched keyword "${keyword}" to pattern "${patternKey}" for ${system}`,
          };
        }
      } else {
        // For longer keywords, use substring matching
        if (nameLower.includes(keywordLower)) {
          return {
            subcategory: pattern.subcategory,
            parent: pattern.parent || null,
            confidence: 'high',
            reasoning: `Matched keyword "${keyword}" to pattern "${patternKey}" for ${system}`,
          };
        }
      }
    }
  }

  return null;
}

function inferSubcategoryFromCurrent(
  conditionName: string,
  currentSubcategory: string | null,
  system: string
): {
  subcategory: string;
  parent: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
} {
  // If no current subcategory, try pattern matching
  if (!currentSubcategory) {
    const pattern = matchPatternSubcategory(conditionName, system);
    if (pattern) return pattern;

    // Fallback: use system as subcategory (needs manual review)
    return {
      subcategory: 'Uncategorized',
      parent: null,
      confidence: 'low',
      reasoning: 'No subcategory found - needs manual review',
    };
  }

  // Check if current subcategory matches a known pattern
  const pattern = matchPatternSubcategory(conditionName, system);

  // If pattern suggests different subcategory, check if current is valid blueprint category
  const validBlueprintCategories = [
    'Cardiomyopathy',
    'Conduction Disorders / Dysrhythmias',
    'Congenital Heart Disease',
    'Coronary Artery Disease',
    'Heart Failure',
    'Hypertension',
    'Hypotension',
    'Lipid Disorders',
    'Shock',
    'Valvular Disorders',
    'Vascular Disease',
    'Acute Coronary Syndrome',
    'Traumatic, Infectious, and Inflammatory Heart Conditions',
    'Seizure Disorders',
    'Cerebrovascular Disorders',
    'Headaches',
    'Obstructive Pulmonary Diseases',
    'Infectious Disorders',
    'Hepatic Disorders',
    'Biliary Disorders',
    'Colorectal Disorders',
    'Depressive Disorders',
    'Anxiety Disorders',
  ];

  if (pattern && currentSubcategory && !validBlueprintCategories.includes(currentSubcategory)) {
    // Current subcategory not in blueprint, use pattern suggestion
    return {
      ...pattern,
      confidence: 'medium',
      reasoning: `Pattern suggests "${pattern.subcategory}" replacing non-blueprint "${currentSubcategory}"`,
    };
  }

  // Keep current subcategory if it's valid, add parent if available
  return {
    subcategory: currentSubcategory,
    parent: pattern?.parent || null,
    confidence: 'high',
    reasoning: 'Using existing blueprint-aligned subcategory with pattern-based parent',
  };
}

async function main() {
  console.log('🔍 SPRINT 3: Existing Condition Categorization\n');
  console.log('Loading all conditions from database...\n');

  const conditions = await prisma.condition.findMany({
    select: {
      id: true,
      name: true,
      system: true,
      subcategory: true,
      parent_category: true,
    },
    orderBy: [{ system: 'asc' }, { name: 'asc' }],
  });

  console.log(`📊 Found ${conditions.length} conditions\n`);

  const mappings: CategoryMapping[] = [];
  const stats = {
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    bySystem: {} as Record<string, number>,
  };

  for (const condition of conditions) {
    const result = inferSubcategoryFromCurrent(
      condition.name,
      condition.subcategory,
      condition.system
    );

    mappings.push({
      conditionId: condition.id,
      conditionName: condition.name,
      currentSystem: condition.system,
      currentSubcategory: condition.subcategory,
      proposedSubcategory: result.subcategory,
      proposedParentCategory: result.parent,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });

    // Update stats
    if (result.confidence === 'high') stats.highConfidence++;
    else if (result.confidence === 'medium') stats.mediumConfidence++;
    else stats.lowConfidence++;

    stats.bySystem[condition.system] = (stats.bySystem[condition.system] || 0) + 1;
  }

  // Generate report
  console.log('📈 Categorization Statistics:\n');
  console.log(
    `  High Confidence: ${stats.highConfidence} (${((stats.highConfidence / conditions.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `  Medium Confidence: ${stats.mediumConfidence} (${((stats.mediumConfidence / conditions.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `  Low Confidence: ${stats.lowConfidence} (${((stats.lowConfidence / conditions.length) * 100).toFixed(1)}%)`
  );

  console.log('\n📊 By System:');
  Object.entries(stats.bySystem)
    .sort(([, a], [, b]) => b - a)
    .forEach(([system, count]) => {
      console.log(`  ${system}: ${count} conditions`);
    });

  // Show sample mappings
  console.log('\n🔍 Sample Mappings:\n');

  const highConfSamples = mappings.filter((m) => m.confidence === 'high').slice(0, 5);
  console.log('High Confidence Examples:');
  highConfSamples.forEach((m) => {
    console.log(`  ${m.conditionName}`);
    console.log(`    Current: ${m.currentSubcategory || 'none'}`);
    console.log(
      `    Proposed: ${m.proposedParentCategory ? m.proposedParentCategory + ' → ' : ''}${m.proposedSubcategory}`
    );
    console.log(`    Reason: ${m.reasoning}\n`);
  });

  const lowConfSamples = mappings.filter((m) => m.confidence === 'low').slice(0, 3);
  if (lowConfSamples.length > 0) {
    console.log('\nLow Confidence Examples (need review):');
    lowConfSamples.forEach((m) => {
      console.log(`  ${m.conditionName}`);
      console.log(`    Current: ${m.currentSubcategory || 'none'}`);
      console.log(`    System: ${m.currentSystem}\n`);
    });
  }

  // Save mappings to file
  const outputDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'condition-category-mappings.json');
  fs.writeFileSync(outputPath, JSON.stringify(mappings, null, 2));

  console.log(`\n✅ Mappings saved to: ${outputPath}`);
  console.log(`\n📋 Next Steps:`);
  console.log(`  1. Review low-confidence mappings (${stats.lowConfidence} conditions)`);
  console.log(`  2. Run Sprint 4 to apply mappings with dry-run`);
  console.log(`  3. Verify results before production update`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
