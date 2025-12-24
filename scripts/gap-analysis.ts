/**
 * Gap Analysis Script - Database Audit Against PANCE Blueprint
 * 
 * Purpose:
 * - Compare database conditions against the PANCE Blueprint master list
 * - Identify missing high-yield topics that need content generation
 * - Generate a queue file for automated content creation
 * 
 * Usage:
 *   npx ts-node scripts/gap-analysis.ts
 * 
 * Output:
 *   - Console: Coverage report by system
 *   - File: scripts/queue/missing_conditions.json
 * 
 * Integration with content-doctor.ts:
 *   Once missing_conditions.json is generated, you can pipe it to content-doctor:
 *   
 *   Example workflow:
 *     1. Run gap analysis: npx ts-node scripts/gap-analysis.ts
 *     2. Review missing_conditions.json
 *     3. Generate missing content: npx ts-node scripts/content-doctor.ts --from-queue=missing_conditions.json
 *   
 *   Or implement a --from-queue flag in content-doctor.ts that reads this file
 *   and generates content for each missing condition automatically.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ============================================================================
// PANCE BLUEPRINT - MASTER LIST
// ============================================================================

/**
 * High-yield topics from the PANCE Blueprint
 * Organized by system for better tracking and reporting
 * 
 * TODO: Expand this list with all blueprint topics
 */
const PANCE_BLUEPRINT = {
  CARDIOVASCULAR: [
    'Atrial Fibrillation',
    'Aortic Stenosis',
    'Mitral Regurgitation',
    'Essential Hypertension',
    'Coronary Artery Disease',
    'Heart Failure',
    'Acute Coronary Syndrome',
    'Myocardial Infarction',
    'Angina Pectoris',
    'Pericarditis',
    'Endocarditis',
    'Ventricular Tachycardia',
    'Aortic Dissection',
    'Deep Vein Thrombosis',
  ],
  PULMONARY: [
    'Pneumonia',
    'Asthma',
    'COPD',
    'Pulmonary Embolism',
    'Bronchitis',
    'Pneumothorax',
    'Pleural Effusion',
    'Lung Cancer',
    'Tuberculosis',
    'Pulmonary Fibrosis',
    'Sleep Apnea',
    'Acute Respiratory Distress Syndrome',
  ],
  // TODO: Add more systems as you expand
  // GASTROINTESTINAL: [...],
  // NEUROLOGIC: [...],
  // MUSCULOSKELETAL: [...],
  // etc.
};

// ============================================================================
// TYPES
// ============================================================================

interface SystemReport {
  system: string;
  total: number;
  present: number;
  missing: number;
  coverage: number; // percentage
  missingTopics: string[];
}

interface GapAnalysisReport {
  timestamp: string;
  totalBlueprint: number;
  totalPresent: number;
  totalMissing: number;
  overallCoverage: number;
  systemReports: SystemReport[];
  allMissingTopics: Array<{
    condition: string;
    system: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize a condition name for comparison
 * - Lowercase
 * - Trim whitespace
 * - Remove extra spaces
 * - Remove punctuation for better matching
 */
function normalizeConditionName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
}

/**
 * Check if a blueprint condition exists in the database
 * Uses normalized string comparison and checks for close matches
 */
function conditionExistsInDB(
  blueprintCondition: string,
  dbConditions: string[]
): boolean {
  const normalized = normalizeConditionName(blueprintCondition);
  
  return dbConditions.some(dbCondition => {
    const dbNormalized = normalizeConditionName(dbCondition);
    
    // Exact match
    if (normalized === dbNormalized) return true;
    
    // Check if one contains the other (handles variations like "CHF" vs "Congestive Heart Failure")
    if (normalized.includes(dbNormalized) || dbNormalized.includes(normalized)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Determine priority based on system and topic importance
 * (This is a simple heuristic - customize based on your needs)
 */
function determinePriority(system: string, condition: string): 'high' | 'medium' | 'low' {
  // High-yield conditions (common on PANCE)
  const highYieldKeywords = [
    'failure', 'infarction', 'embolism', 'syndrome', 
    'pneumonia', 'asthma', 'copd', 'hypertension'
  ];
  
  const normalizedCondition = normalizeConditionName(condition);
  
  if (highYieldKeywords.some(keyword => normalizedCondition.includes(keyword))) {
    return 'high';
  }
  
  // CV and PULM are high priority systems
  if (system === 'CARDIOVASCULAR' || system === 'PULMONARY') {
    return 'high';
  }
  
  return 'medium';
}

/**
 * Map system code to display name
 */
function getSystemDisplayName(systemCode: string): string {
  const displayNames: Record<string, string> = {
    CARDIOVASCULAR: 'Cardiology',
    PULMONARY: 'Pulmonary',
    GASTROINTESTINAL: 'Gastroenterology',
    NEUROLOGIC: 'Neurology',
    MUSCULOSKELETAL: 'Orthopedics',
    DERMATOLOGY: 'Dermatology',
    ENDOCRINE: 'Endocrinology',
    HEMATOLOGY: 'Hematology',
    INFECTIOUS_DISEASE: 'Infectious Disease',
    RENAL: 'Nephrology',
    REPRODUCTIVE: 'Reproductive Health',
    PSYCHIATRIC: 'Psychiatry',
  };
  
  return displayNames[systemCode] || systemCode;
}

// ============================================================================
// MAIN AUDIT LOGIC
// ============================================================================

async function performGapAnalysis(): Promise<GapAnalysisReport> {
  console.log('🔍 Starting PANCE Blueprint Gap Analysis...\n');
  
  // Fetch all existing conditions from database
  console.log('📊 Querying database for existing conditions...');
  const dbConditions = await prisma.condition.findMany({
    select: { name: true }
  });
  
  const dbConditionNames = dbConditions.map(c => c.name);
  console.log(`   Found ${dbConditionNames.length} conditions in database\n`);
  
  // Analyze each system
  const systemReports: SystemReport[] = [];
  let totalBlueprint = 0;
  let totalPresent = 0;
  
  for (const [systemCode, blueprintConditions] of Object.entries(PANCE_BLUEPRINT)) {
    const missingTopics: string[] = [];
    let presentCount = 0;
    
    for (const blueprintCondition of blueprintConditions) {
      totalBlueprint++;
      
      if (conditionExistsInDB(blueprintCondition, dbConditionNames)) {
        presentCount++;
        totalPresent++;
      } else {
        missingTopics.push(blueprintCondition);
      }
    }
    
    const total = blueprintConditions.length;
    const missing = total - presentCount;
    const coverage = total > 0 ? Math.round((presentCount / total) * 100) : 0;
    
    systemReports.push({
      system: systemCode,
      total,
      present: presentCount,
      missing,
      coverage,
      missingTopics,
    });
  }
  
  // Build comprehensive missing topics list with priority
  const allMissingTopics = systemReports.flatMap(report =>
    report.missingTopics.map(condition => ({
      condition,
      system: report.system,
      priority: determinePriority(report.system, condition),
    }))
  );
  
  // Sort by priority (high > medium > low)
  allMissingTopics.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  const totalMissing = totalBlueprint - totalPresent;
  const overallCoverage = totalBlueprint > 0 
    ? Math.round((totalPresent / totalBlueprint) * 100) 
    : 0;
  
  return {
    timestamp: new Date().toISOString(),
    totalBlueprint,
    totalPresent,
    totalMissing,
    overallCoverage,
    systemReports,
    allMissingTopics,
  };
}

// ============================================================================
// OUTPUT FUNCTIONS
// ============================================================================

/**
 * Print a formatted console report
 */
function printConsoleReport(report: GapAnalysisReport): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('          PANCE BLUEPRINT COVERAGE REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Overall stats
  console.log('📈 OVERALL COVERAGE');
  console.log(`   Total Blueprint Topics: ${report.totalBlueprint}`);
  console.log(`   Present in Database:    ${report.totalPresent} ✅`);
  console.log(`   Missing from Database:  ${report.totalMissing} ❌`);
  console.log(`   Coverage:               ${report.overallCoverage}%`);
  console.log();
  
  // System breakdown
  console.log('📋 SYSTEM BREAKDOWN\n');
  
  for (const systemReport of report.systemReports) {
    const systemName = getSystemDisplayName(systemReport.system);
    const coverageBar = generateProgressBar(systemReport.coverage);
    const statusEmoji = systemReport.coverage === 100 ? '✅' : 
                        systemReport.coverage >= 75 ? '🟡' : 
                        systemReport.coverage >= 50 ? '🟠' : '🔴';
    
    console.log(`${statusEmoji} ${systemName}`);
    console.log(`   ${coverageBar} ${systemReport.coverage}%`);
    console.log(`   Present: ${systemReport.present}/${systemReport.total}  Missing: ${systemReport.missing}`);
    
    if (systemReport.missingTopics.length > 0) {
      console.log(`   Missing: ${systemReport.missingTopics.join(', ')}`);
    }
    console.log();
  }
  
  // Priority breakdown
  if (report.allMissingTopics.length > 0) {
    const highPriority = report.allMissingTopics.filter(t => t.priority === 'high').length;
    const mediumPriority = report.allMissingTopics.filter(t => t.priority === 'medium').length;
    const lowPriority = report.allMissingTopics.filter(t => t.priority === 'low').length;
    
    console.log('🎯 PRIORITY BREAKDOWN');
    console.log(`   🔴 High Priority:   ${highPriority} topics`);
    console.log(`   🟡 Medium Priority: ${mediumPriority} topics`);
    console.log(`   🟢 Low Priority:    ${lowPriority} topics`);
    console.log();
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
}

/**
 * Generate a simple ASCII progress bar
 */
function generateProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
}

/**
 * Write missing topics to JSON file for queue processing
 */
async function writeMissingTopicsFile(report: GapAnalysisReport): Promise<void> {
  const queueDir = path.join(__dirname, 'queue');
  
  // Ensure queue directory exists
  if (!fs.existsSync(queueDir)) {
    fs.mkdirSync(queueDir, { recursive: true });
  }
  
  const outputPath = path.join(queueDir, 'missing_conditions.json');
  
  const queueData = {
    generatedAt: report.timestamp,
    totalMissing: report.totalMissing,
    metadata: {
      purpose: 'Auto-generated queue for missing PANCE Blueprint conditions',
      usage: 'Pass this file to content-doctor.ts with --from-queue flag',
      priorityLevels: {
        high: 'Common/high-yield PANCE topics - generate first',
        medium: 'Important but less common topics',
        low: 'Nice-to-have topics for comprehensive coverage'
      }
    },
    missingConditions: report.allMissingTopics,
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(queueData, null, 2), 'utf-8');
  
  console.log(`\n✅ Missing topics written to: ${outputPath}`);
  console.log(`\n💡 NEXT STEPS:`);
  console.log(`   1. Review the missing_conditions.json file`);
  console.log(`   2. Modify content-doctor.ts to add a --from-queue flag:`);
  console.log(`      - Read missing_conditions.json`);
  console.log(`      - Loop through each missing condition`);
  console.log(`      - Generate content for each using Gemini`);
  console.log(`   3. Run: npx ts-node scripts/content-doctor.ts --from-queue=missing_conditions.json`);
  console.log(`   4. Verify generated content in database`);
  console.log(`   5. Re-run gap analysis to confirm 100% coverage\n`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    const report = await performGapAnalysis();
    printConsoleReport(report);
    await writeMissingTopicsFile(report);
    
    // Exit with status code based on coverage
    if (report.overallCoverage === 100) {
      console.log('🎉 Perfect! 100% PANCE Blueprint coverage achieved!\n');
      process.exit(0);
    } else if (report.overallCoverage >= 75) {
      console.log('👍 Good coverage, but room for improvement.\n');
      process.exit(0);
    } else {
      console.log('⚠️  Significant gaps detected. Consider running content generation.\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error during gap analysis:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { performGapAnalysis, PANCE_BLUEPRINT };
