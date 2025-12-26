/**
 * Drug Doctor Enhanced - AI-powered pharmacology content generator with gap analysis
 * Enhances Drug table entries with comprehensive PANCE high-yield information
 * 
 * Features:
 * - Gap analysis: Identifies missing/incomplete fields
 * - Data quality: Validates completeness and formatting
 * - Capitalization: Ensures proper drug name formatting
 * - Field mending: Fixes existing data issues
 * - Invalid entry removal: Removes non-drug entries
 * - Drug class standardization: Normalizes classifications
 * - Comprehensive reporting
 * 
 * Usage: npx ts-node scripts/generators/drug-doctor-enhanced.ts [options]
 * Options:
 *   --analyze          Run gap analysis only (no generation)
 *   --limit=N          Process N drugs (default: 10)
 *   --fix-existing     Fix formatting in existing records
 *   --cleanup          Remove invalid entries and standardize
 *   --dry-run          Preview changes without saving
 * 
 * Note: Unset GEMINI_API_KEY to avoid expired key errors
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

// ==================== DRUG CLASS STANDARDIZATION ====================

const STANDARD_DRUG_CLASSES: Record<string, string> = {
  // Cardiovascular
  'ace inhibitor': 'ACE Inhibitor',
  'ace-inhibitor': 'ACE Inhibitor',
  'angiotensin converting enzyme inhibitor': 'ACE Inhibitor',
  'arb': 'ARB',
  'angiotensin receptor blocker': 'ARB',
  'beta blocker': 'Beta Blocker',
  'beta-blocker': 'Beta Blocker',
  'β-blocker': 'Beta Blocker',
  'calcium channel blocker': 'Calcium Channel Blocker',
  'ccb': 'Calcium Channel Blocker',
  'diuretic': 'Diuretic',
  'loop diuretic': 'Loop Diuretic',
  'thiazide diuretic': 'Thiazide Diuretic',
  'potassium sparing diuretic': 'Potassium-Sparing Diuretic',
  'anticoagulant': 'Anticoagulant',
  'antiplatelet': 'Antiplatelet',
  'statin': 'Statin',
  'hmg-coa reductase inhibitor': 'Statin',
  'fibrate': 'Fibrate',
  'nitrate': 'Nitrate',
  'antiarrhythmic': 'Antiarrhythmic',
  
  // Psychiatric
  'ssri': 'SSRI',
  'selective serotonin reuptake inhibitor': 'SSRI',
  'snri': 'SNRI',
  'serotonin-norepinephrine reuptake inhibitor': 'SNRI',
  'maoi': 'MAOI',
  'monoamine oxidase inhibitor': 'MAOI',
  'tricyclic antidepressant': 'Tricyclic Antidepressant',
  'tca': 'Tricyclic Antidepressant',
  'atypical antidepressant': 'Atypical Antidepressant',
  'benzodiazepine': 'Benzodiazepine',
  'antipsychotic': 'Antipsychotic',
  'atypical antipsychotic': 'Atypical Antipsychotic',
  'typical antipsychotic': 'Typical Antipsychotic',
  'mood stabilizer': 'Mood Stabilizer',
  
  // Antibiotics
  'antibiotic': 'Antibiotic',
  'penicillin': 'Penicillin',
  'cephalosporin': 'Cephalosporin',
  'macrolide': 'Macrolide',
  'fluoroquinolone': 'Fluoroquinolone',
  'quinolone': 'Fluoroquinolone',
  'tetracycline': 'Tetracycline',
  'aminoglycoside': 'Aminoglycoside',
  'sulfonamide': 'Sulfonamide',
  'carbapenem': 'Carbapenem',
  'glycopeptide': 'Glycopeptide',
  
  // Anti-infectives
  'antiviral': 'Antiviral',
  'antifungal': 'Antifungal',
  'antiparasitic': 'Antiparasitic',
  'antimicrobial': 'Antimicrobial',
  
  // Pain/Inflammation
  'nsaid': 'NSAID',
  'nonsteroidal anti-inflammatory drug': 'NSAID',
  'non-steroidal anti-inflammatory': 'NSAID',
  'opioid': 'Opioid',
  'narcotic': 'Opioid',
  'analgesic': 'Analgesic',
  'cox-2 inhibitor': 'COX-2 Inhibitor',
  
  // Endocrine
  'insulin': 'Insulin',
  'sulfonylurea': 'Sulfonylurea',
  'biguanide': 'Biguanide',
  'thiazolidinedione': 'Thiazolidinedione',
  'tzd': 'Thiazolidinedione',
  'glp-1 agonist': 'GLP-1 Agonist',
  'dpp-4 inhibitor': 'DPP-4 Inhibitor',
  'sglt2 inhibitor': 'SGLT2 Inhibitor',
  'thyroid hormone': 'Thyroid Hormone',
  'antithyroid': 'Antithyroid Agent',
  'corticosteroid': 'Corticosteroid',
  'steroid': 'Corticosteroid',
  'glucocorticoid': 'Glucocorticoid',
  
  // Respiratory
  'bronchodilator': 'Bronchodilator',
  'beta-2 agonist': 'Beta-2 Agonist',
  'anticholinergic': 'Anticholinergic',
  'leukotriene modifier': 'Leukotriene Modifier',
  'inhaled corticosteroid': 'Inhaled Corticosteroid',
  
  // GI
  'proton pump inhibitor': 'Proton Pump Inhibitor',
  'ppi': 'Proton Pump Inhibitor',
  'h2 blocker': 'H2 Receptor Antagonist',
  'h2 antagonist': 'H2 Receptor Antagonist',
  'antacid': 'Antacid',
  'antiemetic': 'Antiemetic',
  'laxative': 'Laxative',
  'antidiarrheal': 'Antidiarrheal',
  
  // Other
  'immunosuppressant': 'Immunosuppressant',
  'immunomodulator': 'Immunomodulator',
  'chemotherapy': 'Chemotherapy Agent',
  'antineoplastic': 'Antineoplastic',
  'vaccine': 'Vaccine',
  'biologic': 'Biologic',
  'monoclonal antibody': 'Monoclonal Antibody',
  'antihistamine': 'Antihistamine',
  'decongestant': 'Decongestant',
  'muscle relaxant': 'Muscle Relaxant',
  'anticonvulsant': 'Anticonvulsant',
  'antiepileptic': 'Antiepileptic',
};

// Invalid entries that should be removed
const INVALID_DRUG_NAMES = new Set([
  'oral', 'po', 'iv', 'im', 'sq', 'subcutaneous', 'topical', 'intravenous', 'intramuscular',
  'tablet', 'capsule', 'injection', 'solution', 'suspension', 'cream', 'ointment', 'gel',
  'spray', 'inhaler', 'suppository', 'patch', 'drops', 'lotion', 'powder', 'syrup',
  'elixir', 'tincture', 'emulsion', 'aerosol', 'foam', 'paste', 'film', 'granules',
  'antibiotic', 'antiviral', 'antifungal', 'analgesic', 'nsaid', 'steroid', 'vaccine',
  'corticosteroid', 'beta blocker', 'ace inhibitor', 'arb', 'ssri', 'snri', 'maoi',
  'diuretic', 'anticoagulant', 'antiplatelet', 'statin', 'immunosuppressant',
  'chemotherapy', 'opioid', 'benzodiazepine', 'antidepressant', 'antipsychotic',
  'once daily', 'twice daily', 'three times daily', 'four times daily', 'as needed',
  'prn', 'qd', 'bid', 'tid', 'qid', 'q4h', 'q6h', 'q8h', 'q12h',
  'mg', 'g', 'mcg', 'ml', 'l', 'unit', 'units', 'iu',
  'morning', 'evening', 'bedtime', 'with food', 'without food', 'empty stomach',
]);

// ==================== TYPE DEFINITIONS ====================

interface DrugEnhancement {
  brandName: string;
  displayName: string;
  aliases: string[];
  indications: string[];
  dosing: string;
  mechanismDetailed: string;
  pharmacokinetics: {
    absorption: string;
    distribution: string;
    metabolism: string;
    elimination: string;
    halfLife: string;
    bioavailability: string;
  };
  absorption: string;
  distribution: string;
  metabolismDetail: string;
  eliminationRoute: string;
  halfLife: string;
  onsetOfAction: string;
  peakEffect: string;
  duration: string;
  bioavailability: string;
  pregnancyCategory: string;
  pregnancyNotes: string;
  lactationSafety: string;
  lactationNotes: string;
  pediatricDosing: string;
  pediatricNotes: string;
  geriatricDosing: string;
  geriatricNotes: string;
  renalDosing: string;
  hepaticDosing: string;
  blackBoxWarnings: string[];
  riskStrategies: string[];
  monitoringParams: string[];
  reversalAgent: string;
  toxicity: string;
  maxDailyDose: string;
  clinicalPearls: string[];
  commonMistakes: string[];
  mnemonics: string[];
  testQuestionTips: string[];
  boardYieldFacts: string[];
  majorInteractions: Array<{
    drug: string;
    severity: string;
    mechanism: string;
    clinicalEffect: string;
    management: string;
  }>;
  cyp450Effects: {
    inhibits: string[];
    induces: string[];
    substrates: string[];
  };
  foodInteractions: string[];
  routesOfAdmin: string[];
  formulations: string[];
  administrationTips: string;
  storageRequirements: string;
  genericAvailable: boolean;
  typicalCost: string;
  insuranceTier: number;
  isFirstLine: boolean;
  panceYield: number;
}

interface QualityIssue {
  drugName: string;
  field: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
}

interface GapAnalysisReport {
  totalDrugs: number;
  emptyFields: Map<string, number>;
  qualityIssues: QualityIssue[];
  drugsNeedingUpdate: string[];
  completionRate: number;
}

// ==================== VALIDATION & CLEANUP ====================

/**
 * Check if a name is a valid drug (not a dosing method, drug class, etc.)
 */
function isValidDrugName(name: string): boolean {
  if (!name || name.trim().length < 3) return false;
  
  const normalized = name.toLowerCase().trim();
  
  // Check against invalid names
  if (INVALID_DRUG_NAMES.has(normalized)) return false;
  
  // Check if it's just a number or dosage
  if (/^\d+\s*(mg|g|mcg|ml|l|unit|iu)s?$/i.test(normalized)) return false;
  
  // Check if it's a frequency/timing instruction
  if (/^(once|twice|three|four|daily|hourly|weekly|monthly|as needed)$/i.test(normalized)) return false;
  
  // Check if it starts with route of administration
  if (/^(oral|iv|im|sq|topical|rectal|vaginal|sublingual|inhalation)\s/i.test(normalized)) return false;
  
  return true;
}

/**
 * Standardize drug class names
 */
function standardizeDrugClasses(classes: string[]): string[] {
  if (!Array.isArray(classes)) return [];
  
  const standardized = new Set<string>();
  
  for (const drugClass of classes) {
    if (!drugClass || typeof drugClass !== 'string') continue;
    
    const normalized = drugClass.toLowerCase().trim();
    const standard = STANDARD_DRUG_CLASSES[normalized] || drugClass.trim();
    
    // Only add if it's not an invalid entry
    if (standard && !INVALID_DRUG_NAMES.has(normalized)) {
      standardized.add(standard);
    }
  }
  
  return Array.from(standardized).sort();
}

/**
 * Normalize drug name for duplicate detection
 */
function normalizeDrugName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s\-\/\(\)]/g, '')
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical info
    .trim();
}

/**
 * Find and merge duplicate drug entries
 */
async function findAndMergeDuplicates(dryRun: boolean = false): Promise<number> {
  console.log('\n🔍 DETECTING DUPLICATES');
  console.log('=' .repeat(80));
  
  const allDrugs = await prisma.drug.findMany({
    select: {
      id: true,
      genericName: true,
      brandName: true,
      drugClass: true,
      mechanismDetailed: true,
      indications: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'asc' } // Keep oldest (most likely to have data)
  });
  
  const nameMap = new Map<string, typeof allDrugs>();
  let merged = 0;
  
  // Group by normalized name
  for (const drug of allDrugs) {
    const normalized = normalizeDrugName(drug.genericName);
    const existing = nameMap.get(normalized);
    
    if (existing) {
      existing.push(drug);
    } else {
      nameMap.set(normalized, [drug]);
    }
  }
  
  // Process duplicates
  for (const [normalized, drugs] of nameMap.entries()) {
    if (drugs.length > 1) {
      console.log(`\n  🔄 Found ${drugs.length} duplicates of "${drugs[0].genericName}":`);
      drugs.forEach((d, i) => console.log(`     ${i + 1}. ID ${d.id}: "${d.genericName}" (created: ${d.createdAt.toISOString().split('T')[0]})`));
      
      // Keep the one with most data (or oldest if equal)
      const sorted = drugs.sort((a, b) => {
        const aScore = (a.mechanismDetailed ? 1 : 0) + (a.indications?.length || 0);
        const bScore = (b.mechanismDetailed ? 1 : 0) + (b.indications?.length || 0);
        if (aScore !== bScore) return bScore - aScore;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      
      const keeper = sorted[0];
      const toDelete = sorted.slice(1);
      
      console.log(`     ✓ Keeping: ID ${keeper.id} "${keeper.genericName}"`);
      
      if (!dryRun) {
        for (const duplicate of toDelete) {
          console.log(`     ❌ Deleting: ID ${duplicate.id} "${duplicate.genericName}"`);
          await prisma.drug.delete({ where: { id: duplicate.id } });
          merged++;
        }
      } else {
        console.log(`     [DRY RUN] Would delete ${toDelete.length} duplicates`);
        merged += toDelete.length;
      }
    }
  }
  
  console.log(`\n✅ Duplicate detection complete: ${merged} duplicates ${dryRun ? 'found' : 'removed'}`);
  return merged;
}

/**
 * Validate data integrity
 */
async function validateDataIntegrity(): Promise<void> {
  console.log('\n🔬 DATA INTEGRITY CHECKS');
  console.log('=' .repeat(80));
  
  // Get all drugs to check
  const allDrugs = await prisma.drug.findMany({
    select: { id: true, genericName: true, drugClass: true }
  });
  
  // Check for empty or null generic names
  const emptyNames = allDrugs.filter(d => !d.genericName || d.genericName.trim() === '').length;
  if (emptyNames > 0) {
    console.log(`  ⚠️  Warning: ${emptyNames} drugs with empty generic names`);
  }
  
  // Check for very short names (likely invalid)
  const shortNames = allDrugs.filter(d => d.genericName && d.genericName.length < 3).length;
  if (shortNames > 0) {
    console.log(`  ⚠️  Warning: ${shortNames} drugs with names shorter than 3 characters`);
  }
  
  // Check for drugs with no drug class
  const noDrugClass = allDrugs.filter(d => !d.drugClass || d.drugClass.length === 0).length;
  if (noDrugClass > 0) {
    console.log(`  ℹ️  Info: ${noDrugClass} drugs with no drug class assigned`);
  }
  
  console.log(`  ✅ Integrity checks complete`);
}

/**
 * Clean up and validate drug entry
 */
async function cleanupInvalidDrugs(dryRun: boolean = false): Promise<number> {
  console.log('\n🧹 PHASE 0: CLEANUP & VALIDATION');
  console.log('=' .repeat(80));
  
  // Step 1: Find and merge duplicates
  await findAndMergeDuplicates(dryRun);
  
  // Step 2: Validate data integrity
  await validateDataIntegrity();
  
  // Step 3: Remove invalid entries
  console.log('\n🗑️  REMOVING INVALID ENTRIES');
  console.log('-' .repeat(80));
  
  const allDrugs = await prisma.drug.findMany({
    select: { id: true, genericName: true, drugClass: true }
  });
  
  let removed = 0;
  let standardized = 0;
  
  for (const drug of allDrugs) {
    // Check if drug name is invalid
    if (!isValidDrugName(drug.genericName)) {
      console.log(`  ❌ Removing invalid entry: "${drug.genericName}"`);
      if (!dryRun) {
        await prisma.drug.delete({ where: { id: drug.id } });
      }
      removed++;
      continue;
    }
    
    // Standardize drug classes
    if (drug.drugClass && drug.drugClass.length > 0) {
      const standardizedClasses = standardizeDrugClasses(drug.drugClass);
      
      if (JSON.stringify(standardizedClasses) !== JSON.stringify(drug.drugClass)) {
        console.log(`  🔧 Standardizing "${drug.genericName}": ${drug.drugClass.join(', ')} → ${standardizedClasses.join(', ')}`);
        if (!dryRun) {
          await prisma.drug.update({
            where: { id: drug.id },
            data: { drugClass: standardizedClasses }
          });
        }
        standardized++;
      }
    }
  }
  
  console.log(`\n✅ Cleanup complete:`);
  console.log(`   Removed: ${removed} invalid entries`);
  console.log(`   Standardized: ${standardized} drug class lists`);
  
  return removed;
}

// ==================== CAPITALIZATION & FORMATTING ====================

/**
 * Properly capitalize drug names following pharmaceutical conventions
 */
function capitalizeDrugName(name: string): string {
  if (!name) return name;
  
  // Special cases that should be lowercase or specific capitalization
  const specialCases: Record<string, string> = {
    'hctz': 'HCTZ',
    'hydrochlorothiazide': 'hydrochlorothiazide',
    'nsaid': 'NSAID',
    'nsaids': 'NSAIDs',
    'ace': 'ACE',
    'arb': 'ARB',
    'ssri': 'SSRI',
    'snri': 'SNRI',
    'maoi': 'MAOI',
    'tnf': 'TNF',
    'iv': 'IV',
    'po': 'PO',
    'im': 'IM',
    'dtap': 'DTaP',
    'mmr': 'MMR',
    'tdap': 'Tdap',
    'hpv': 'HPV',
    'subcutaneous': 'subcutaneous',
    'oral': 'oral',
    'cana2edta': 'CaNa2EDTA',
  };

  // Handle hyphenated compounds (e.g., "amoxicillin-clavulanate")
  if (name.includes('-')) {
    return name.split('-').map(part => capitalizeDrugName(part)).join('-');
  }

  // Handle slashes (e.g., "sulfamethoxazole/trimethoprim")
  if (name.includes('/')) {
    return name.split('/').map(part => capitalizeDrugName(part)).join('/');
  }

  // Handle parentheses (e.g., "Edetate Calcium Disodium (CaNa2EDTA)")
  if (name.includes('(')) {
    const parts = name.split(/([()])/);
    return parts.map(part => {
      if (part === '(' || part === ')') return part;
      return capitalizeDrugName(part);
    }).join('');
  }

  const lower = name.toLowerCase().trim();
  
  // Check special cases first
  if (specialCases[lower]) {
    return specialCases[lower];
  }

  // Generic drug names: lowercase (pharmaceutical convention)
  return lower;
}

/**
 * Format display name with proper capitalization for UI
 */
function formatDisplayName(name: string): string {
  if (!name) return name;
  
  // Special capitalization for acronyms and compounds
  const specialDisplayNames: Record<string, string> = {
    'hctz': 'HCTZ',
    'hydrochlorothiazide': 'Hydrochlorothiazide',
    'dtap': 'DTaP',
    'mmr': 'MMR',
    'tdap': 'Tdap',
    'hpv': 'HPV',
    'nsaid': 'NSAID',
    'ace': 'ACE Inhibitor',
    'arb': 'ARB',
    'ssri': 'SSRI',
    'snri': 'SNRI',
    'maoi': 'MAOI',
  };

  const lower = name.toLowerCase().trim();
  
  // Check special cases
  if (specialDisplayNames[lower]) {
    return specialDisplayNames[lower];
  }

  // Handle hyphenated compounds
  if (lower.includes('-')) {
    return lower.split('-').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('-');
  }

  // Handle slashes
  if (lower.includes('/')) {
    return lower.split('/').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('/');
  }

  // Standard capitalization: First letter uppercase
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Format brand name with proper capitalization
 */
function formatBrandName(name: string): string {
  if (!name || name === 'None' || name === 'N/A') return name;
  
  // Brand names always start with capital letter
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Clean and format text content
 */
function cleanText(text: string): string {
  if (!text) return text;
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/^[•\-\*]\s+/gm, '- ') // Normalize bullet points
    .replace(/\s+([.,;:])/g, '$1') // Remove space before punctuation
    .replace(/([.,;:])\s*([a-zA-Z])/g, '$1 $2') // Ensure space after punctuation
    .trim();
}

/**
 * Validate and format arrays
 */
function cleanArray(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  
  return arr
    .filter(item => item && typeof item === 'string' && item.trim().length > 0)
    .map(item => cleanText(item))
    .filter((item, index, self) => self.indexOf(item) === index); // Remove duplicates
}

// ==================== DATA SANITIZATION ====================

function sanitizeDrugData(data: any, drugName: string): DrugEnhancement {
  // Helper to ensure string
  const ensureString = (val: any, fallback = 'Not available'): string => {
    if (typeof val === 'string') return cleanText(val);
    if (Array.isArray(val)) return val.join(', ');
    return fallback;
  };

  // Helper to ensure array
  const ensureArray = (val: any): string[] => {
    if (Array.isArray(val)) return cleanArray(val.filter((v: any) => typeof v === 'string'));
    if (typeof val === 'string') return val.trim() ? cleanArray([val]) : [];
    return [];
  };

  // Helper to ensure boolean
  const ensureBoolean = (val: any): boolean => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return false;
  };

  // Helper to ensure number
  const ensureNumber = (val: any, min: number, max: number, fallback: number): number => {
    const num = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (isNaN(num) || num < min || num > max) return fallback;
    return num;
  };

  return {
    brandName: formatBrandName(ensureString(data.brandName, 'None')),
    displayName: formatDisplayName(ensureString(data.displayName, drugName)),
    aliases: ensureArray(data.aliases).map(alias => cleanText(alias)),
    indications: ensureArray(data.indications).map(indication => cleanText(indication)),
    dosing: cleanText(ensureString(data.dosing)),
    mechanismDetailed: cleanText(ensureString(data.mechanismDetailed)),
    pharmacokinetics: {
      absorption: ensureString(data.pharmacokinetics?.absorption),
      distribution: ensureString(data.pharmacokinetics?.distribution),
      metabolism: ensureString(data.pharmacokinetics?.metabolism),
      elimination: ensureString(data.pharmacokinetics?.elimination),
      halfLife: ensureString(data.pharmacokinetics?.halfLife),
      bioavailability: ensureString(data.pharmacokinetics?.bioavailability)
    },
    absorption: ensureString(data.absorption),
    distribution: ensureString(data.distribution),
    metabolismDetail: ensureString(data.metabolismDetail),
    eliminationRoute: ensureString(data.eliminationRoute),
    halfLife: ensureString(data.halfLife),
    onsetOfAction: ensureString(data.onsetOfAction),
    peakEffect: ensureString(data.peakEffect),
    duration: ensureString(data.duration),
    bioavailability: ensureString(data.bioavailability),
    pregnancyCategory: ensureString(data.pregnancyCategory),
    pregnancyNotes: ensureString(data.pregnancyNotes),
    lactationSafety: ensureString(data.lactationSafety),
    lactationNotes: ensureString(data.lactationNotes),
    pediatricDosing: ensureString(data.pediatricDosing),
    pediatricNotes: ensureString(data.pediatricNotes),
    geriatricDosing: ensureString(data.geriatricDosing),
    geriatricNotes: ensureString(data.geriatricNotes),
    renalDosing: ensureString(data.renalDosing),
    hepaticDosing: ensureString(data.hepaticDosing),
    blackBoxWarnings: ensureArray(data.blackBoxWarnings),
    riskStrategies: ensureArray(data.riskStrategies),
    monitoringParams: ensureArray(data.monitoringParams),
    reversalAgent: ensureString(data.reversalAgent, 'None'),
    toxicity: ensureString(data.toxicity),
    maxDailyDose: ensureString(data.maxDailyDose),
    clinicalPearls: ensureArray(data.clinicalPearls),
    commonMistakes: ensureArray(data.commonMistakes),
    mnemonics: ensureArray(data.mnemonics),
    testQuestionTips: ensureArray(data.testQuestionTips),
    boardYieldFacts: ensureArray(data.boardYieldFacts),
    majorInteractions: Array.isArray(data.majorInteractions) 
      ? data.majorInteractions.map((i: any) => ({
          drug: capitalizeDrugName(ensureString(i.drug)),
          severity: ensureString(i.severity, 'moderate'),
          mechanism: ensureString(i.mechanism),
          clinicalEffect: ensureString(i.clinicalEffect),
          management: ensureString(i.management)
        }))
      : [],
    cyp450Effects: {
      inhibits: ensureArray(data.cyp450Effects?.inhibits),
      induces: ensureArray(data.cyp450Effects?.induces),
      substrates: ensureArray(data.cyp450Effects?.substrates)
    },
    foodInteractions: ensureArray(data.foodInteractions),
    routesOfAdmin: ensureArray(data.routesOfAdmin),
    formulations: ensureArray(data.formulations),
    administrationTips: ensureString(data.administrationTips),
    storageRequirements: ensureString(data.storageRequirements),
    genericAvailable: ensureBoolean(data.genericAvailable),
    typicalCost: ensureString(data.typicalCost, '$'),
    insuranceTier: ensureNumber(data.insuranceTier, 1, 4, 2),
    isFirstLine: ensureBoolean(data.isFirstLine),
    panceYield: ensureNumber(data.panceYield, 1, 3, 2)
  };
}

// ==================== QUALITY VALIDATION ====================

const REQUIRED_STRING_FIELDS = [
  'mechanismDetailed', 'absorption', 'distribution', 'metabolismDetail',
  'eliminationRoute', 'halfLife', 'onsetOfAction', 'administrationTips',
  'brandName', 'displayName', 'dosing', 'pediatricNotes', 'geriatricNotes'
];

const REQUIRED_ARRAY_FIELDS = [
  'monitoringParams', 'clinicalPearls', 'boardYieldFacts', 'routesOfAdmin',
  'indications', 'aliases', 'riskStrategies'
];

const MIN_STRING_LENGTH = 20;
const MIN_ARRAY_ITEMS = 2;

function validateDrugQuality(drug: any): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const drugName = drug.genericName || 'Unknown';

  // Check required string fields
  for (const field of REQUIRED_STRING_FIELDS) {
    const value = drug[field];
    if (!value || value === 'Not available' || value.trim().length < MIN_STRING_LENGTH) {
      issues.push({
        drugName,
        field,
        issue: !value ? 'Missing' : value === 'Not available' ? 'Placeholder' : 'Too short',
        severity: 'critical'
      });
    }
  }

  // Check required array fields
  for (const field of REQUIRED_ARRAY_FIELDS) {
    const value = drug[field];
    if (!Array.isArray(value) || value.length < MIN_ARRAY_ITEMS) {
      issues.push({
        drugName,
        field,
        issue: !Array.isArray(value) ? 'Not an array' : 'Too few items',
        severity: 'critical'
      });
    }
  }

  // Check capitalization
  if (drug.genericName) {
    const expected = capitalizeDrugName(drug.genericName);
    if (drug.genericName !== expected) {
      issues.push({
        drugName,
        field: 'genericName',
        issue: `Incorrect capitalization: "${drug.genericName}" should be "${expected}"`,
        severity: 'warning'
      });
    }
  }

  // Check for placeholder text
  const textFields = ['mechanismDetailed', 'absorption', 'distribution', 'toxicity'];
  for (const field of textFields) {
    const value = drug[field];
    if (value && typeof value === 'string') {
      const placeholders = ['TODO', 'TBD', 'Coming soon', 'Not yet documented'];
      if (placeholders.some(p => value.includes(p))) {
        issues.push({
          drugName,
          field,
          issue: 'Contains placeholder text',
          severity: 'warning'
        });
      }
    }
  }

  return issues;
}

// ==================== GAP ANALYSIS ====================

async function performGapAnalysis(): Promise<GapAnalysisReport> {
  console.log('\n🔍 PHASE 1: GAP ANALYSIS');
  console.log('=' .repeat(80));

  // Count total drugs first
  const totalDrugsCount = await prisma.drug.count();
  console.log(`\n📊 Analyzing ${totalDrugsCount} drugs...`);

  // Analyze in smaller batches to avoid 5MB response limit
  const BATCH_SIZE = 100;
  const allDrugs: any[] = [];
  
  for (let skip = 0; skip < totalDrugsCount; skip += BATCH_SIZE) {
    const batch = await prisma.drug.findMany({
      skip,
      take: BATCH_SIZE,
      select: {
        id: true,
        genericName: true,
        brandName: true,
        displayName: true,
        aliases: true,
        indications: true,
        dosing: true,
        mechanismDetailed: true,
        absorption: true,
        metabolismDetail: true,
        eliminationRoute: true,
        halfLife: true,
        onsetOfAction: true,
        administrationTips: true,
        monitoringParams: true,
        clinicalPearls: true,
        boardYieldFacts: true,
        routesOfAdmin: true,
        pediatricNotes: true,
        geriatricNotes: true,
        riskStrategies: true,
        panceYield: true
      }
    });
    allDrugs.push(...batch);
    process.stdout.write(`\r   Processed: ${Math.min(skip + BATCH_SIZE, totalDrugsCount)}/${totalDrugsCount}`);
  }
  console.log('\n');

  const emptyFields = new Map<string, number>();
  const qualityIssues: QualityIssue[] = [];
  const drugsNeedingUpdate: string[] = [];

  let totalFields = 0;
  let populatedFields = 0;

  // Analyze each drug
  for (const drug of allDrugs) {
    const issues = validateDrugQuality(drug);
    qualityIssues.push(...issues);

    if (issues.length > 0) {
      drugsNeedingUpdate.push(drug.genericName);
    }

    // Count empty/insufficient fields
    for (const [key, value] of Object.entries(drug)) {
      if (key === 'id' || key === 'genericName') continue;
      
      totalFields++;
      
      const isEmpty = !value || 
        value === 'Not available' ||
        (typeof value === 'string' && value.trim().length < MIN_STRING_LENGTH) ||
        (Array.isArray(value) && value.length < MIN_ARRAY_ITEMS);

      if (isEmpty) {
        emptyFields.set(key, (emptyFields.get(key) || 0) + 1);
      } else {
        populatedFields++;
      }
    }
  }

  const completionRate = (populatedFields / totalFields) * 100;

  // Print analysis
  console.log(`\n📊 Database Coverage:`);
  console.log(`   Total drugs: ${allDrugs.length}`);
  console.log(`   Completion rate: ${completionRate.toFixed(1)}%`);
  console.log(`   Drugs needing updates: ${drugsNeedingUpdate.length}`);

  console.log(`\n📋 Missing/Insufficient Fields (Top 15):`);
  const sortedFields = Array.from(emptyFields.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  
  for (const [field, count] of sortedFields) {
    const percentage = ((count / allDrugs.length) * 100).toFixed(1);
    console.log(`   ${field.padEnd(25)} ${count.toString().padStart(4)} drugs (${percentage}%)`);
  }

  console.log(`\n⚠️  Quality Issues by Severity:`);
  const criticalIssues = qualityIssues.filter(i => i.severity === 'critical').length;
  const warningIssues = qualityIssues.filter(i => i.severity === 'warning').length;
  console.log(`   Critical: ${criticalIssues}`);
  console.log(`   Warnings: ${warningIssues}`);

  return {
    totalDrugs: allDrugs.length,
    emptyFields,
    qualityIssues,
    drugsNeedingUpdate,
    completionRate
  };
}

// ==================== CONTENT GENERATION ====================

async function generateDrugEnhancement(drug: {
  genericName: string;
  drugClass: string[];
  mechanismOfAction?: string | null;
  indications: string[];
}): Promise<DrugEnhancement | null> {
  
  // CRITICAL VALIDATION: Check if this is actually a valid drug
  if (!isValidDrugName(drug.genericName)) {
    console.log(`  ⚠️  Skipping invalid drug name: "${drug.genericName}"`);
    return null;
  }
  
  const prompt = `You are a PA/NP pharmacology educator with expertise in identifying valid pharmaceutical drugs.

CRITICAL FIRST STEP - VALIDATION:
Before generating any content, you MUST determine if "${drug.genericName}" is a VALID PHARMACEUTICAL DRUG.

REJECT if it is any of the following:
- Route of administration (oral, IV, IM, PO, subcutaneous, topical, etc.)
- Dosage form (tablet, capsule, injection, solution, cream, ointment, etc.)
- Drug class only (antibiotic, NSAID, beta blocker, ACE inhibitor, etc.)
- Dosing instruction (once daily, twice daily, as needed, PRN, etc.)
- Medical term that is NOT a drug (hypertension, diabetes, infection, etc.)
- Measurement unit (mg, mL, units, etc.)
- Generic category without specific drug name
- Random words or fragments

ONLY PROCEED if "${drug.genericName}" is a specific pharmaceutical agent with a defined chemical structure.

If INVALID: Return exactly: {"isValid": false}
If VALID: Generate comprehensive PANCE-focused content with the following structure:

{
  "isValid": true,
  "brandName": "string: most common brand name (proper capitalization), or 'None' if no brand name",
  "displayName": "string: properly capitalized display name for UI (e.g., 'Acetaminophen', 'Lisinopril')",
  "aliases": ["array of strings: common alternative names, abbreviations, or other brand names"],
  "indications": ["array of strings: complete list of FDA-approved indications plus common off-label uses"],
  "dosing": "string: comprehensive dosing for ALL indications with specific routes, frequencies, and durations. Format as 'Indication: dose details; Next indication: dose details'",
  "mechanismDetailed": "string: 2-3 sentence detailed mechanism of action",
  "pharmacokinetics": {
    "absorption": "string: bioavailability, food effects, absorption characteristics",
    "distribution": "string: volume of distribution (Vd), protein binding percentage",
    "metabolism": "string: CYP enzymes involved, active/inactive metabolites",
    "elimination": "string: route with percentages (renal/hepatic/fecal)",
    "halfLife": "string: terminal half-life in hours",
    "bioavailability": "string: oral bioavailability percentage"
  },
  "absorption": "string: detailed oral absorption characteristics, timing",
  "distribution": "string: Vd value, protein binding %, tissue distribution",
  "metabolismDetail": "string: specific CYP450 enzymes, metabolites, drug-drug interactions",
  "eliminationRoute": "string: renal/hepatic/fecal with percentages",
  "halfLife": "string: half-life in hours with context",
  "onsetOfAction": "string: time to therapeutic effect",
  "peakEffect": "string: time to peak plasma concentration",
  "duration": "string: duration of therapeutic action",
  "bioavailability": "string: bioavailability percentage with influencing factors",
  "pregnancyCategory": "string: FDA category (A/B/C/D/X) or current labeling system",
  "pregnancyNotes": "string: specific pregnancy considerations, risks, alternatives",
  "lactationSafety": "string: Safe/Caution/Contraindicated with evidence level",
  "lactationNotes": "string: breastfeeding considerations, infant monitoring",
  "pediatricDosing": "string: weight-based or age-specific dosing with ranges",
  "pediatricNotes": "string: special pediatric considerations, safety concerns, monitoring needs",
  "geriatricDosing": "string: elderly dosing adjustments, special considerations",
  "geriatricNotes": "string: fall risk, cognitive effects, drug-drug interactions common in elderly, Beers Criteria considerations",
  "renalDosing": "string: CrCl-based dose adjustments with specific cutoffs",
  "hepaticDosing": "string: Child-Pugh class adjustments",
  "blackBoxWarnings": ["array of strings: FDA black box warnings, one per array item"],
  "riskStrategies": ["array of strings: REMS programs if applicable, or empty array"],
  "monitoringParams": ["array of strings: specific labs, vitals, or assessments to monitor"],
  "reversalAgent": "string: specific antidote with dosing, or 'None'",
  "toxicity": "string: overdose presentation, management, prognosis",
  "maxDailyDose": "string: maximum daily dose with units",
  "clinicalPearls": ["array of strings: 4-6 complete sentence clinical tips with rationale"],
  "commonMistakes": ["array of strings: 3-4 common prescribing errors to avoid"],
  "mnemonics": ["array of strings: memory aids if commonly used, or empty array"],
  "testQuestionTips": ["array of strings: 3-4 board exam high-yield facts"],
  "boardYieldFacts": ["array of strings: 4-6 PANCE-relevant facts"],
  "majorInteractions": [
    {
      "drug": "string: interacting drug name (lowercase generic)",
      "severity": "string: major/moderate/minor",
      "mechanism": "string: pharmacologic interaction mechanism",
      "clinicalEffect": "string: clinical consequence of interaction",
      "management": "string: how to manage or avoid interaction"
    }
  ],
  "cyp450Effects": {
    "inhibits": ["array of strings: CYP enzymes inhibited (e.g., '2D6', '3A4') or empty array"],
    "induces": ["array of strings: CYP enzymes induced or empty array"],
    "substrates": ["array of strings: CYP enzymes that metabolize this drug or empty array"]
  },
  "foodInteractions": ["array of strings: specific food/beverage interactions or empty array"],
  "routesOfAdmin": ["array of strings: PO, IV, IM, SQ, etc."],
  "formulations": ["array of strings: tablet, capsule, solution, suspension, etc."],
  "administrationTips": "string: how to take/administer properly, timing with meals",
  "storageRequirements": "string: temperature, light protection, reconstitution stability",
  "genericAvailable": boolean: true if generic exists, false if brand only,
  "typicalCost": "string: $ (low) or $$ (moderate) or $$$ (high) or $$$$ (very high)",
  "insuranceTier": number: 1 (preferred generic) or 2 (non-preferred generic) or 3 (preferred brand) or 4 (non-preferred brand),
  "isFirstLine": boolean: true if first-line therapy for any major indication,
  "panceYield": number: 1 (low yield) or 2 (medium yield) or 3 (high yield for PANCE)
}

FORMATTING & VALIDATION RULES:
- ALL string fields must be strings (never arrays)
- ALL array fields must be arrays (never strings)
- Empty arrays are [] not null
- Use "None", "N/A", or "Not applicable" for missing data
- Boolean fields must be true/false (not strings)
- Number fields must be numbers (not strings)
- Generic drug names: all lowercase (e.g., "acetaminophen", "lisinopril")
- Brand names: Proper capitalization (e.g., "Tylenol", "Zestril")
- Display name: Capitalize first letter (e.g., "Acetaminophen", "Lisinopril")
- Complete sentences with proper grammar and punctuation
- Use consistent formatting: "10-20 mg PO once daily" not "10-20mg po qd"
- No extra spaces before punctuation
- Single space after periods, commas
- Specific values with units (not vague descriptions like "varies")
- Medical accuracy is paramount
- PANCE-relevant focus
- Professional medical writing style`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(text);
  
  // Check if AI determined this is invalid
  if (parsed.isValid === false) {
    console.log(`  🚫 AI rejected as invalid: "${drug.genericName}"`);
    return null;
  }
  
  // Validate and sanitize the response
  return sanitizeDrugData(parsed, drug.genericName);
}

// ==================== FIX EXISTING DATA ====================

async function fixExistingDrugs(dryRun: boolean = false) {
  console.log('\n🔧 PHASE 2: FIXING EXISTING DATA');
  console.log('=' .repeat(80));

  const drugs = await prisma.drug.findMany({
    where: {
      OR: [
        { mechanismDetailed: { not: null } },
        { genericName: { not: null } }
      ]
    },
    take: 100 // Limit to avoid overwhelming
  });

  console.log(`Found ${drugs.length} drugs with existing data to check\n`);

  let fixed = 0;
  let skipped = 0;

  for (const drug of drugs) {
    const issues = validateDrugQuality(drug);
    
    if (issues.length === 0) {
      skipped++;
      continue;
    }

    console.log(`Fixing: ${drug.genericName} (${issues.length} issues)`);
    
    // Fix capitalization
    const correctName = capitalizeDrugName(drug.genericName);
    
    // Fix arrays and text formatting
    const updates: any = {};
    
    if (correctName !== drug.genericName) {
      updates.genericName = correctName;
      console.log(`  📝 Capitalization: ${drug.genericName} → ${correctName}`);
    }

    // Clean existing text fields
    if (drug.mechanismDetailed) {
      updates.mechanismDetailed = cleanText(drug.mechanismDetailed);
    }

    // Clean existing arrays
    if (drug.clinicalPearls) {
      updates.clinicalPearls = cleanArray(drug.clinicalPearls);
    }
    if (drug.monitoringParams) {
      updates.monitoringParams = cleanArray(drug.monitoringParams);
    }
    if (drug.boardYieldFacts) {
      updates.boardYieldFacts = cleanArray(drug.boardYieldFacts);
    }

    if (Object.keys(updates).length > 0 && !dryRun) {
      await prisma.drug.update({
        where: { id: drug.id },
        data: updates
      });
      fixed++;
      console.log(`  ✓ Fixed`);
    } else if (dryRun) {
      console.log(`  [DRY RUN] Would fix ${Object.keys(updates).length} fields`);
    }

    await new Promise(r => setTimeout(r, 100)); // Brief delay
  }

  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`⏭️  Skipped (clean): ${skipped}`);
}

// ==================== MAIN ENHANCEMENT ====================

async function enhanceDrugs(options: { limit?: number; dryRun?: boolean }) {
  console.log('\n📝 PHASE 3: CONTENT GENERATION');
  console.log('=' .repeat(80));
  
  const { limit = 10, dryRun = false } = options;

  // Get ALL drugs - we'll check each one for missing/insufficient fields
  // This ensures we process all 1043 drugs, not just ones with NULL values
  const drugs = await prisma.drug.findMany({
    take: limit,
    select: { 
      id: true, 
      genericName: true,
      brandName: true,
      displayName: true,
      aliases: true,
      drugClass: true, 
      mechanismOfAction: true, 
      indications: true,
      dosing: true,
      mechanismDetailed: true,
      absorption: true,
      metabolismDetail: true,
      eliminationRoute: true,
      halfLife: true,
      onsetOfAction: true,
      administrationTips: true,
      routesOfAdmin: true,
      monitoringParams: true,
      clinicalPearls: true,
      boardYieldFacts: true,
      peakEffect: true,
      duration: true,
      bioavailability: true,
      pregnancyCategory: true,
      lactationSafety: true,
      pediatricDosing: true,
      pediatricNotes: true,
      geriatricDosing: true,
      geriatricNotes: true,
      renalDosing: true,
      hepaticDosing: true,
      blackBoxWarnings: true,
      riskStrategies: true,
      commonMistakes: true,
      mnemonics: true,
      testQuestionTips: true,
      foodInteractions: true,
      formulations: true,
      storageRequirements: true,
      typicalCost: true,
      panceYield: true
    }
  });

  // Filter to only drugs that actually need enhancement (have quality issues)
  const drugsToEnhance = drugs.filter(drug => {
    const issues = validateDrugQuality(drug);
    return issues.length > 0;
  });

  console.log(`Found ${drugsToEnhance.length} drugs with missing/incomplete fields\n`);

  let enhanced = 0;
  let skipped = 0;
  let failed = 0;
  let invalid = 0;

  for (const drug of drugsToEnhance) {
    try {
      // Identify which fields are missing/insufficient for this specific drug
      const issues = validateDrugQuality(drug);
      const missingFields = [...new Set(issues.map(i => i.field))];
      
      console.log(`Enhancing: ${drug.genericName} (${missingFields.length} fields need improvement)`);
      const enhancement = await generateDrugEnhancement(drug);

      // Check if AI determined this is invalid
      if (enhancement === null) {
        console.log(`  🗑️  Marking for deletion: invalid entry`);
        if (!dryRun) {
          await prisma.drug.delete({ where: { id: drug.id } });
        }
        invalid++;
        continue;
      }

      // Verify data quality before saving
      if (!enhancement.mechanismDetailed || enhancement.mechanismDetailed === 'Not available') {
        console.log(`  ⚠️  Skipping: insufficient data generated`);
        skipped++;
        continue;
      }

      if (!dryRun) {
        // Fix capitalization before saving
        const correctName = capitalizeDrugName(drug.genericName);
        
        // Standardize drug classes
        const standardizedClasses = drug.drugClass && drug.drugClass.length > 0
          ? standardizeDrugClasses(drug.drugClass)
          : drug.drugClass;
        
        await prisma.drug.update({
          where: { id: drug.id },
          data: {
            genericName: correctName,
            drugClass: standardizedClasses,
            ...enhancement
          }
        });
        console.log(`  ✓ Enhanced (${correctName}) - filled ${missingFields.length} fields`);
        enhanced++;
      } else {
        console.log(`  [DRY RUN] Would enhance and fill ${missingFields.length} fields`);
      }

      // Rate limit - 3 seconds for 2.5-pro
      await new Promise(r => setTimeout(r, 3000));
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error(`  ✗ Failed: ${errorMsg.slice(0, 200)}`);
      failed++;
      
      // Handle rate limiting
      if (errorMsg.includes('RATE_LIMIT')) {
        console.log('  ⏸️  Rate limited, waiting 10 seconds...');
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Enhanced: ${enhanced}`);
  console.log(`   Invalid (deleted): ${invalid}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
}

// ==================== CLI ====================

async function main() {
  const args = process.argv.slice(2);
  const analyze = args.includes('--analyze');
  const fixExisting = args.includes('--fix-existing');
  const cleanup = args.includes('--cleanup');
  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');

  console.log('\n' + '='.repeat(80));
  console.log('🩺 DRUG DOCTOR ENHANCED - Comprehensive Pharmacology Content Generator');
  console.log('='.repeat(80));

  try {
    // Phase 0: Cleanup invalid entries (always run unless analyze-only)
    if (!analyze) {
      await cleanupInvalidDrugs(dryRun);
    }

    // Phase 1: Gap Analysis
    if (analyze || !fixExisting) {
      const report = await performGapAnalysis();
      
      if (analyze) {
        await prisma.$disconnect();
        return; // Stop after analysis
      }
    }

    // Phase 2: Fix Existing Data
    if (fixExisting) {
      await fixExistingDrugs(dryRun);
    }

    // Phase 3: Generate New Content
    if (!analyze && !fixExisting && !cleanup) {
      await enhanceDrugs({ limit, dryRun });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Drug Doctor Enhanced - Complete!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
