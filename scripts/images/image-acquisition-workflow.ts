#!/usr/bin/env npx tsx
/**
 * Context-Aware Image Acquisition Workflow
 * 
 * This script analyzes MedicalContent deeply to generate comprehensive
 * image acquisition plans that include:
 * - Gold standard imaging
 * - Best initial test imaging
 * - Physical exam findings
 * - Stepwise diagnostic workup images
 * 
 * Usage:
 *   npx tsx scripts/images/image-acquisition-workflow.ts plan <conditionId>
 *   npx tsx scripts/images/image-acquisition-workflow.ts plan-system <system> [limit]
 *   npx tsx scripts/images/image-acquisition-workflow.ts status
 *   npx tsx scripts/images/image-acquisition-workflow.ts list [system] [limit]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

interface ImageRequirement {
  query: string;
  modality: string;
  purpose: string;  // "gold_standard", "initial_test", "physical_exam", "finding", "classification"
  priority: number; // 1 = must have, 2 = high value, 3 = nice to have
  source: string;   // Which field this came from
}

interface ConditionImagePlan {
  conditionId: string;
  condition: string;
  system: string;
  existingImages: number;
  targetImages: number;
  requirements: ImageRequirement[];
  distractors: string[];
  buzzwords: string[];
  goldStandardDx: string | null;
  bestInitialTest: string | null;
}

// ============================================================================
// SYSTEM NAME MAPPING
// ============================================================================

const SYSTEM_NAME_MAP: Record<string, string> = {
  // Natural names -> DB abbreviations
  'cardiology': 'CV',
  'cardiovascular': 'CV',
  'cardiac': 'CV',
  'heart': 'CV',
  'pulmonology': 'PULM',
  'pulmonary': 'PULM',
  'respiratory': 'PULM',
  'lung': 'PULM',
  'dermatology': 'DERM',
  'skin': 'DERM',
  'musculoskeletal': 'MSK',
  'orthopedics': 'MSK',
  'ortho': 'MSK',
  'neurology': 'NEURO',
  'neuro': 'NEURO',
  'brain': 'NEURO',
  'gastroenterology': 'GI',
  'gastrointestinal': 'GI',
  'gi': 'GI',
  'ent': 'HEENT',
  'heent': 'HEENT',
  'eyes': 'HEENT',
  'ears': 'HEENT',
  'infectious': 'ID',
  'infectious-disease': 'ID',
  'id': 'ID',
  'hematology': 'HEME',
  'heme': 'HEME',
  'blood': 'HEME',
  'endocrinology': 'ENDO',
  'endocrine': 'ENDO',
  'endo': 'ENDO',
  'nephrology': 'RENAL',
  'renal': 'RENAL',
  'kidney': 'RENAL',
  'reproductive': 'REPRO',
  'repro': 'REPRO',
  'obgyn': 'REPRO',
  'psychiatry': 'PSYCH',
  'psych': 'PSYCH',
  'mental': 'PSYCH',
  'urology': 'GU',
  'gu': 'GU',
  // DB abbreviations map to themselves
  'cv': 'CV',
  'pulm': 'PULM',
  'derm': 'DERM',
  'msk': 'MSK',
  'other': 'OTHER',
};

function normalizeSystemName(system: string): string {
  const lower = system.toLowerCase();
  return SYSTEM_NAME_MAP[lower] || system.toUpperCase();
}

// ============================================================================
// IMAGE REQUIREMENT EXTRACTION
// ============================================================================

/**
 * Parse the image_query field which may contain multiple queries
 * Examples:
 *   "Pulmonary embolism CTPA, Pulmonary embolism chest X-ray Westermark sign, ECG S1Q3T3"
 *   "aortic dissection CT angiogram false lumen"
 */
function parseImageQueries(imageQuery: string | null): string[] {
  if (!imageQuery) return [];
  
  // Split by comma, semicolon, or period (but not inside parentheses)
  const queries = imageQuery
    .split(/[,;.](?![^(]*\))/)
    .map(q => q.trim())
    .filter(q => q.length > 3);
  
  return queries;
}

/**
 * Extract imaging modalities mentioned in text
 */
function extractImagingFromText(text: string | null): Array<{modality: string, finding: string}> {
  if (!text) return [];
  
  const findings: Array<{modality: string, finding: string}> = [];
  
  // Specific finding patterns
  const specificPatterns = [
    { regex: /widened mediastinum/gi, modality: 'radiology', finding: 'Widened mediastinum on chest X-ray' },
    { regex: /Hampton['']?s?\s*hump/gi, modality: 'radiology', finding: 'Hampton hump on chest X-ray' },
    { regex: /Westermark['']?s?\s*sign/gi, modality: 'radiology', finding: 'Westermark sign on chest X-ray' },
    { regex: /intimal flap/gi, modality: 'radiology', finding: 'CT showing intimal flap' },
    { regex: /filling defect/gi, modality: 'radiology', finding: 'CT/CTA showing filling defect' },
    { regex: /S1Q3T3/gi, modality: 'ecg', finding: 'ECG with S1Q3T3 pattern' },
    { regex: /ST[- ]?elevation/gi, modality: 'ecg', finding: 'ECG with ST elevation' },
    { regex: /ST[- ]?depression/gi, modality: 'ecg', finding: 'ECG with ST depression' },
    { regex: /PR[- ]?depression/gi, modality: 'ecg', finding: 'ECG with PR depression' },
    { regex: /prolonged QT/gi, modality: 'ecg', finding: 'ECG with prolonged QT interval' },
    { regex: /papilledema/gi, modality: 'derm', finding: 'Funduscopic exam showing papilledema' },
    { regex: /retinopathy/gi, modality: 'derm', finding: 'Funduscopic exam showing retinopathy' },
    { regex: /Kayser[- ]?Fleischer/gi, modality: 'derm', finding: 'Kayser-Fleischer rings on slit lamp exam' },
    { regex: /target lesion/gi, modality: 'derm', finding: 'Target lesions on skin' },
    { regex: /erythema migrans/gi, modality: 'derm', finding: 'Erythema migrans (bullseye rash)' },
  ];
  
  for (const pattern of specificPatterns) {
    if (pattern.regex.test(text)) {
      // Reset regex lastIndex
      pattern.regex.lastIndex = 0;
      findings.push({ modality: pattern.modality, finding: pattern.finding });
    }
  }
  
  return findings;
}

/**
 * Determine modality from a search query
 */
function determineModality(query: string): string {
  const q = query.toLowerCase();
  
  if (q.includes('ecg') || q.includes('ekg') || q.includes('rhythm') || 
      q.includes('12-lead') || q.includes('12 lead') || q.includes('electrocardiogram')) {
    return 'ecg';
  }
  if (q.includes('ct') || q.includes('mri') || q.includes('x-ray') || q.includes('xray') ||
      q.includes('chest') || q.includes('radiograph') || q.includes('ultrasound') ||
      q.includes('angiogra') || q.includes('scan')) {
    return 'radiology';
  }
  if (q.includes('smear') || q.includes('microscop') || q.includes('slide') ||
      q.includes('biopsy') || q.includes('histolog')) {
    return 'labs';
  }
  if (q.includes('fundus') || q.includes('skin') || q.includes('rash') || 
      q.includes('lesion') || q.includes('exam') || q.includes('sign') ||
      q.includes('appearance') || q.includes('photo')) {
    return 'derm';
  }
  
  return 'diagrams';
}

/**
 * Generate comprehensive image requirements for a condition
 */
async function generateImagePlan(conditionId: string): Promise<ConditionImagePlan | null> {
  const content = await prisma.medicalContent.findFirst({
    where: { conditionId },
    select: {
      conditionId: true,
      condition: true,
      system: true,
      image_query: true,
      gold_standard_dx: true,
      best_initial_test: true,
      diagnostics: true,
      physicalExam: true,
      treatment: true,
      buzzwords: true,
      differentials: true,
    },
  });
  
  if (!content) return null;
  
  const requirements: ImageRequirement[] = [];
  const addedQueries = new Set<string>();
  
  // Helper to add requirement without duplicates
  const addRequirement = (req: ImageRequirement) => {
    const key = req.query.toLowerCase().substring(0, 40);
    if (!addedQueries.has(key)) {
      addedQueries.add(key);
      requirements.push(req);
    }
  };
  
  // 1. Parse explicit image_query (may have multiple)
  const explicitQueries = parseImageQueries(content.image_query);
  for (let i = 0; i < explicitQueries.length; i++) {
    addRequirement({
      query: explicitQueries[i],
      modality: determineModality(explicitQueries[i]),
      purpose: i === 0 ? 'primary' : 'supplementary',
      priority: i === 0 ? 1 : 2,
      source: 'image_query',
    });
  }
  
  // 2. Gold standard diagnostic image
  if (content.gold_standard_dx) {
    const goldStd = content.gold_standard_dx;
    if (goldStd.toLowerCase().match(/ct|mri|x-?ray|echo|ecg|ultrasound|angio|fundus|smear/)) {
      addRequirement({
        query: `${content.condition} ${goldStd}`,
        modality: determineModality(goldStd),
        purpose: 'gold_standard',
        priority: 1,
        source: 'gold_standard_dx',
      });
    }
  }
  
  // 3. Best initial test image (if different from gold standard)
  if (content.best_initial_test && content.best_initial_test !== content.gold_standard_dx) {
    const initial = content.best_initial_test;
    if (initial.toLowerCase().match(/ct|mri|x-?ray|echo|ecg|ultrasound|angio|chest|fundus/)) {
      addRequirement({
        query: `${content.condition} ${initial}`,
        modality: determineModality(initial),
        purpose: 'initial_test',
        priority: 1,
        source: 'best_initial_test',
      });
    }
  }
  
  // 4. Extract imaging findings from diagnostics text
  const diagnosticFindings = extractImagingFromText(content.diagnostics);
  for (const finding of diagnosticFindings) {
    addRequirement({
      query: `${content.condition} ${finding.finding}`,
      modality: finding.modality,
      purpose: 'diagnostic_finding',
      priority: 2,
      source: 'diagnostics',
    });
  }
  
  // 5. Physical exam findings that are visual
  const examFindings = extractImagingFromText(content.physicalExam);
  for (const finding of examFindings) {
    addRequirement({
      query: `${content.condition} ${finding.finding}`,
      modality: finding.modality,
      purpose: 'physical_exam',
      priority: 3,
      source: 'physicalExam',
    });
  }
  
  // Count existing images
  const existingCount = await prisma.mediaAsset.count({
    where: { conditionId },
  });
  
  // Parse differentials
  let distractors: string[] = [];
  if (content.differentials && Array.isArray(content.differentials)) {
    distractors = (content.differentials as any[])
      .map(d => typeof d === 'string' ? d : d?.condition)
      .filter(Boolean)
      .slice(0, 5);
  }
  
  // Determine target images based on content complexity
  let targetImages = 2; // Minimum
  if (content.gold_standard_dx && content.best_initial_test && 
      content.gold_standard_dx !== content.best_initial_test) {
    targetImages = 3; // Has both gold standard and different initial test
  }
  if (explicitQueries.length > 2) {
    targetImages = Math.min(explicitQueries.length, 5); // Has multiple explicit queries
  }
  
  return {
    conditionId: content.conditionId,
    condition: content.condition || 'Unknown',
    system: content.system || 'OTHER',
    existingImages: existingCount,
    targetImages,
    requirements: requirements.slice(0, 8), // Cap at 8 images max
    distractors,
    buzzwords: (content.buzzwords as string[]) || [],
    goldStandardDx: content.gold_standard_dx,
    bestInitialTest: content.best_initial_test,
  };
}

// ============================================================================
// CLI COMMANDS
// ============================================================================

async function planCondition(conditionId: string): Promise<void> {
  const plan = await generateImagePlan(conditionId);
  
  if (!plan) {
    console.log(`❌ Condition not found: ${conditionId}`);
    return;
  }
  
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`📋 IMAGE ACQUISITION PLAN: ${plan.condition}`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`System: ${plan.system}`);
  console.log(`Condition ID: ${plan.conditionId}`);
  console.log(`Existing Images: ${plan.existingImages}`);
  console.log(`Target Images: ${plan.targetImages}`);
  
  if (plan.goldStandardDx) {
    console.log(`\n🥇 Gold Standard Dx: ${plan.goldStandardDx}`);
  }
  if (plan.bestInitialTest) {
    console.log(`📝 Best Initial Test: ${plan.bestInitialTest}`);
  }
  
  console.log(`\n📸 IMAGE REQUIREMENTS (${plan.requirements.length}):`);
  console.log(`───────────────────────────────────────────────────────────────`);
  
  for (let i = 0; i < plan.requirements.length; i++) {
    const req = plan.requirements[i];
    const priorityIcon = req.priority === 1 ? '🔴' : req.priority === 2 ? '🟡' : '🟢';
    console.log(`\n${i + 1}. ${priorityIcon} [${req.modality.toUpperCase()}] ${req.purpose}`);
    console.log(`   🔎 Search: "${req.query}"`);
    console.log(`   📁 Source: ${req.source}`);
  }
  
  if (plan.distractors.length > 0) {
    console.log(`\n❌ DISTRACTORS: ${plan.distractors.join(', ')}`);
  }
  
  console.log(`\n💡 UPLOAD COMMANDS:`);
  console.log(`───────────────────────────────────────────────────────────────`);
  for (const req of plan.requirements.slice(0, 3)) {
    const distractors = plan.distractors.slice(0, 3).join(',') || 'TBD,TBD,TBD';
    console.log(`npm run images:upload "<URL>" "${req.modality}" "${plan.condition}" "${distractors}"`);
  }
  console.log();
}

async function planSystem(system: string, limit = 10): Promise<void> {
  const normalizedSystem = normalizeSystemName(system);
  
  // Get conditions that need more images
  const conditions = await prisma.medicalContent.findMany({
    where: { 
      system: normalizedSystem,
    },
    select: { conditionId: true, condition: true },
    take: limit * 2, // Get extra in case some have enough images
  });
  
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`📋 ${system} SYSTEM - IMAGE ACQUISITION PLANS`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  
  let count = 0;
  for (const cond of conditions) {
    if (count >= limit) break;
    
    const plan = await generateImagePlan(cond.conditionId);
    if (!plan) continue;
    
    const needed = plan.targetImages - plan.existingImages;
    if (needed <= 0) continue;
    
    count++;
    console.log(`${count}. ${plan.condition}`);
    console.log(`   📋 ID: ${plan.conditionId}`);
    console.log(`   📸 Has: ${plan.existingImages}/${plan.targetImages} images (need ${needed} more)`);
    if (plan.goldStandardDx) {
      console.log(`   🥇 Gold Standard: ${plan.goldStandardDx}`);
    }
    if (plan.bestInitialTest && plan.bestInitialTest !== plan.goldStandardDx) {
      console.log(`   📝 Initial Test: ${plan.bestInitialTest}`);
    }
    console.log(`   🔎 Searches:`);
    for (const req of plan.requirements.slice(0, 3)) {
      const icon = req.priority === 1 ? '🔴' : '🟡';
      console.log(`      ${icon} [${req.modality}] ${req.query}`);
    }
    if (plan.distractors.length > 0) {
      console.log(`   ❌ Distractors: ${plan.distractors.slice(0, 3).join(', ')}`);
    }
    console.log();
  }
}

async function getStatus(): Promise<void> {
  // Count by system with detailed breakdowns
  const conditions = await prisma.medicalContent.findMany({
    where: { image_query: { not: null } },
    select: { conditionId: true, system: true, gold_standard_dx: true, best_initial_test: true },
  });
  
  const images = await prisma.mediaAsset.groupBy({
    by: ['conditionId'],
    _count: { id: true },
    where: { conditionId: { not: null } },
  });
  
  const imageCountMap = new Map(images.map(i => [i.conditionId, i._count.id]));
  
  // Calculate stats by system
  const systemStats: Record<string, {
    total: number;
    withImages: number;
    totalImages: number;
    needGoldStandard: number;
    needInitialTest: number;
  }> = {};
  
  for (const c of conditions) {
    const sys = c.system || 'OTHER';
    if (!systemStats[sys]) {
      systemStats[sys] = { total: 0, withImages: 0, totalImages: 0, needGoldStandard: 0, needInitialTest: 0 };
    }
    systemStats[sys].total++;
    
    const imgCount = imageCountMap.get(c.conditionId) || 0;
    if (imgCount > 0) {
      systemStats[sys].withImages++;
      systemStats[sys].totalImages += imgCount;
    }
    
    // Track if gold standard / initial test imaging exists
    if (c.gold_standard_dx?.match(/ct|mri|x-?ray|echo|ecg|ultrasound/i)) {
      systemStats[sys].needGoldStandard++;
    }
    if (c.best_initial_test?.match(/ct|mri|x-?ray|echo|ecg|ultrasound/i)) {
      systemStats[sys].needInitialTest++;
    }
  }
  
  console.log("\n📊 CONTEXT-AWARE IMAGE ACQUISITION STATUS\n");
  console.log("═".repeat(80));
  console.log(
    "System".padEnd(10) + 
    "Conditions".padStart(12) + 
    "Has Images".padStart(12) +
    "Total Imgs".padStart(12) +
    "Need Gold".padStart(12) +
    "Need Initial".padStart(14)
  );
  console.log("─".repeat(80));
  
  let totalConditions = 0;
  let totalWithImages = 0;
  let totalImages = 0;
  
  const sortedSystems = Object.entries(systemStats).sort((a, b) => b[1].total - a[1].total);
  
  for (const [sys, stats] of sortedSystems) {
    totalConditions += stats.total;
    totalWithImages += stats.withImages;
    totalImages += stats.totalImages;
    
    console.log(
      sys.padEnd(10) + 
      String(stats.total).padStart(12) +
      String(stats.withImages).padStart(12) +
      String(stats.totalImages).padStart(12) +
      String(stats.needGoldStandard).padStart(12) +
      String(stats.needInitialTest).padStart(14)
    );
  }
  
  console.log("─".repeat(80));
  console.log(
    "TOTAL".padEnd(10) + 
    String(totalConditions).padStart(12) +
    String(totalWithImages).padStart(12) +
    String(totalImages).padStart(12)
  );
  console.log("═".repeat(80));
  
  const avgImgPerCondition = totalWithImages > 0 ? (totalImages / totalWithImages).toFixed(1) : '0';
  console.log(`\n📈 Coverage: ${totalWithImages}/${totalConditions} conditions have images (${((totalWithImages/totalConditions)*100).toFixed(1)}%)`);
  console.log(`📸 Average: ${avgImgPerCondition} images per condition (target: 2-3)`);
  console.log(`🎯 Estimated total images needed: ~${totalConditions * 2 - totalImages}\n`);
}

async function listConditions(systemFilter?: string, limit = 20): Promise<void> {
  const whereClause: any = {};
  if (systemFilter) {
    whereClause.system = normalizeSystemName(systemFilter);
  }
  
  const conditions = await prisma.medicalContent.findMany({
    where: whereClause,
    select: {
      conditionId: true,
      condition: true,
      system: true,
      image_query: true,
      gold_standard_dx: true,
      best_initial_test: true,
      differentials: true,
    },
    orderBy: { system: 'asc' },
    take: limit * 2,
  });
  
  // Get existing image counts
  const existingImages = await prisma.mediaAsset.groupBy({
    by: ['conditionId'],
    _count: { id: true },
    where: { conditionId: { not: null } },
  });
  const imageMap = new Map(existingImages.map(e => [e.conditionId, e._count.id]));
  
  // Filter to conditions needing images
  const needingImages = conditions
    .filter(c => (imageMap.get(c.conditionId) || 0) < 2)
    .slice(0, limit);
  
  console.log(`\n🔍 Next ${needingImages.length} conditions needing images${systemFilter ? ` (${systemFilter})` : ''}:\n`);
  
  for (let i = 0; i < needingImages.length; i++) {
    const c = needingImages[i];
    const existing = imageMap.get(c.conditionId) || 0;
    const queries = parseImageQueries(c.image_query);
    
    // Parse differentials
    let distractors: string[] = [];
    if (c.differentials && Array.isArray(c.differentials)) {
      distractors = (c.differentials as any[])
        .map(d => typeof d === 'string' ? d : d?.condition)
        .filter(Boolean)
        .slice(0, 3);
    }
    
    console.log(`${(i + 1).toString().padStart(3)}. ${c.condition} (${existing}/2+ images)`);
    console.log(`     📋 ID: ${c.conditionId}`);
    if (c.gold_standard_dx) {
      console.log(`     🥇 Gold Standard: ${c.gold_standard_dx}`);
    }
    if (c.best_initial_test && c.best_initial_test !== c.gold_standard_dx) {
      console.log(`     📝 Initial Test: ${c.best_initial_test}`);
    }
    console.log(`     🔎 Searches:`);
    for (const q of queries.slice(0, 3)) {
      console.log(`        - "${q}"`);
    }
    if (distractors.length > 0) {
      console.log(`     ❌ Distractors: ${distractors.join(', ')}`);
    }
    console.log();
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  const [command, arg1, arg2] = process.argv.slice(2);
  
  try {
    switch (command) {
      case "plan":
        if (!arg1) {
          console.log("Usage: npx tsx scripts/images/image-acquisition-workflow.ts plan <conditionId>");
          console.log("\nExample: npx tsx ... plan CV__vascular_disease__aortic_dissection");
          break;
        }
        await planCondition(arg1);
        break;
        
      case "plan-system":
        if (!arg1) {
          console.log("Usage: npx tsx scripts/images/image-acquisition-workflow.ts plan-system <system> [limit]");
          console.log("\nSystems: CV, PULM, DERM, MSK, NEURO, GI, HEENT, ID, HEME, ENDO, RENAL, REPRO, PSYCH, OTHER");
          break;
        }
        await planSystem(arg1, arg2 ? parseInt(arg2) : 10);
        break;
        
      case "status":
        await getStatus();
        break;
        
      case "list":
        await listConditions(arg1, arg2 ? parseInt(arg2) : 20);
        break;
        
      default:
        console.log("Context-Aware Image Acquisition Workflow");
        console.log("=========================================\n");
        console.log("Commands:");
        console.log("  status                         - Show detailed acquisition progress");
        console.log("  list [system] [limit]          - List conditions needing images");
        console.log("  plan <conditionId>             - Generate full image plan for one condition");
        console.log("  plan-system <system> [limit]   - Generate plans for a whole system\n");
        console.log("Examples:");
        console.log("  npx tsx scripts/images/image-acquisition-workflow.ts status");
        console.log("  npx tsx scripts/images/image-acquisition-workflow.ts list CV 10");
        console.log("  npx tsx scripts/images/image-acquisition-workflow.ts plan CV__vascular_disease__aortic_dissection");
        console.log("  npx tsx scripts/images/image-acquisition-workflow.ts plan-system PULM 5");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
