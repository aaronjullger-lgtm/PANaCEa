/**
 * Drug Doctor Enhanced v3
 *
 * A comprehensive drug database curator that:
 * 1. Gap Analysis - Reports missing/inadequate fields
 * 2. Non-Pharm Cleanup - AI validates and removes non-drug entries
 * 3. Fuzzy Duplicate Detection - Finds similar drug names with AI verification
 * 4. Content Generation - Fills missing fields with AI
 * 5. Content Enhancement - Improves subpar content
 * 6. Name Formatting - Ensures proper capitalization
 * 7. PANCE Gap Discovery - Finds missing high-yield drugs for PANCE
 *
 * Model: Gemini 2.5 Flash STRICTLY (temp 0.1, JSON output)
 *
 * Usage:
 *   npx tsx scripts/generators/drug-doctor-enhanced.ts [options]
 *
 * Options:
 *   --dry-run          Preview changes without modifying database
 *   --analyze-only     Run gap analysis and duplicate check only
 *   --skip-dedup       Skip duplicate detection phase
 *   --skip-enhance     Skip content enhancement phase
 *   --skip-cleanup     Skip non-pharm cleanup phase
 *   --skip-discovery   Skip PANCE drug discovery phase
 *   --limit=N          Process only N drugs
 *   --batch=N          Batch size (default: 50)
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Graceful shutdown
process.once('SIGINT', async () => {
  console.log('\n🛑 Caught SIGINT - disconnecting...');
  await prisma.$disconnect();
  process.exit(0);
});

// ==================== Gemini Setup ====================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable required');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    temperature: 0.1,
    responseMimeType: 'application/json',
  },
});

// ==================== Token Bucket Rate Limiter ====================

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillPerSecond: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    let backoff = 500;
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await sleep(backoff);
      backoff = Math.min(backoff * 1.5, 8000);
    }
  }
}

const tokenBucket = new TokenBucket(5, 0.5); // ~30 req/min

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== Field Definitions ====================

const STRING_FIELDS = [
  'genericName',
  'brandName',
  'displayName',
  'mechanismOfAction',
  'mechanismDetailed',
  'dosing',
  'clinicalNotes',
  'pregnancyCategory',
  'pregnancyNotes',
  'lactationSafety',
  'lactationNotes',
  'pediatricDosing',
  'pediatricNotes',
  'geriatricDosing',
  'geriatricNotes',
  'renalDosing',
  'hepaticDosing',
  'elimination',
  'metabolism',
  'metabolismDetail',
  'absorption',
  'distribution',
  'eliminationRoute',
  'halfLife',
  'onsetOfAction',
  'peakEffect',
  'duration',
  'bioavailability',
  'reversalAgent',
  'antidote',
  'toxicity',
  'maxDailyDose',
  'administrationTips',
  'storageRequirements',
  'typicalCost',
] as const;

const ARRAY_FIELDS = [
  'drugClass',
  'aliases',
  'tags',
  'indications',
  'contraindications',
  'blackBoxWarnings',
  'riskStrategies',
  'monitoringParams',
  'clinicalPearls',
  'commonMistakes',
  'mnemonics',
  'testQuestionTips',
  'boardYieldFacts',
  'foodInteractions',
  'routesOfAdmin',
  'formulations',
  'sideEffects',
  'interactions',
] as const;

const BOOLEAN_FIELDS = ['genericAvailable', 'isFirstLine', 'isHighYield'] as const;
const NUMBER_FIELDS = ['insuranceTier', 'panceYield'] as const;
const JSON_FIELDS = ['pharmacokinetics', 'cyp450Effects', 'majorInteractions'] as const;

// Fields that must have actual content (not just "None")
const REQUIRED_CONTENT_FIELDS = [
  'mechanismOfAction',
  'indications',
  'contraindications',
  'dosing',
  'sideEffects',
  'drugClass',
  'clinicalPearls',
  'monitoringParams',
] as const;

// ==================== Placeholders & Invalid Names ====================

const PLACEHOLDER_VALUES = new Set([
  'none',
  'n/a',
  'not available',
  'unknown',
  'na',
  '-',
  '--',
  '...',
  'tbd',
  'to be determined',
  'pending',
  'not specified',
  'unspecified',
  '',
]);

const INVALID_DRUG_NAMES = new Set([
  'oral',
  'po',
  'iv',
  'im',
  'sq',
  'subcutaneous',
  'topical',
  'intravenous',
  'intramuscular',
  'tablet',
  'capsule',
  'injection',
  'solution',
  'suspension',
  'cream',
  'ointment',
  'gel',
  'spray',
  'inhaler',
  'suppository',
  'patch',
  'drops',
  'lotion',
  'powder',
  'syrup',
  'elixir',
  'antibiotic',
  'antiviral',
  'antifungal',
  'analgesic',
  'nsaid',
  'steroid',
  'vaccine',
  'corticosteroid',
  'beta blocker',
  'ace inhibitor',
  'arb',
  'ssri',
  'snri',
  'maoi',
  'diuretic',
  'anticoagulant',
  'antiplatelet',
  'statin',
  'immunosuppressant',
  'chemotherapy',
  'opioid',
  'benzodiazepine',
  'antidepressant',
  'antipsychotic',
  'medication',
  'drug',
  'agent',
  'therapy',
  'treatment',
  'once daily',
  'twice daily',
  'bid',
  'tid',
  'qid',
  'prn',
  'mg',
  'mcg',
  'ml',
  'unit',
  'units',
]);

// ==================== Drug Class Standardization ====================

const STANDARD_DRUG_CLASSES: Record<string, string> = {
  'ace inhibitor': 'ACE Inhibitor',
  'ace-inhibitor': 'ACE Inhibitor',
  arb: 'ARB',
  'angiotensin receptor blocker': 'ARB',
  'beta blocker': 'Beta Blocker',
  'beta-blocker': 'Beta Blocker',
  'calcium channel blocker': 'Calcium Channel Blocker',
  ccb: 'Calcium Channel Blocker',
  diuretic: 'Diuretic',
  'loop diuretic': 'Loop Diuretic',
  'thiazide diuretic': 'Thiazide Diuretic',
  ssri: 'SSRI',
  'selective serotonin reuptake inhibitor': 'SSRI',
  snri: 'SNRI',
  'serotonin-norepinephrine reuptake inhibitor': 'SNRI',
  maoi: 'MAOI',
  'monoamine oxidase inhibitor': 'MAOI',
  'tricyclic antidepressant': 'Tricyclic Antidepressant',
  tca: 'Tricyclic Antidepressant',
  benzodiazepine: 'Benzodiazepine',
  antipsychotic: 'Antipsychotic',
  antibiotic: 'Antibiotic',
  penicillin: 'Penicillin',
  cephalosporin: 'Cephalosporin',
  macrolide: 'Macrolide',
  fluoroquinolone: 'Fluoroquinolone',
  tetracycline: 'Tetracycline',
  aminoglycoside: 'Aminoglycoside',
  antiviral: 'Antiviral',
  antifungal: 'Antifungal',
  nsaid: 'NSAID',
  'nonsteroidal anti-inflammatory drug': 'NSAID',
  opioid: 'Opioid',
  narcotic: 'Opioid',
  analgesic: 'Analgesic',
  insulin: 'Insulin',
  sulfonylurea: 'Sulfonylurea',
  biguanide: 'Biguanide',
  'glp-1 agonist': 'GLP-1 Agonist',
  'dpp-4 inhibitor': 'DPP-4 Inhibitor',
  'sglt2 inhibitor': 'SGLT2 Inhibitor',
  corticosteroid: 'Corticosteroid',
  'proton pump inhibitor': 'Proton Pump Inhibitor',
  ppi: 'Proton Pump Inhibitor',
  'h2 blocker': 'H2 Receptor Antagonist',
  antihistamine: 'Antihistamine',
  anticonvulsant: 'Anticonvulsant',
  antiepileptic: 'Antiepileptic',
  bronchodilator: 'Bronchodilator',
  'inhaled corticosteroid': 'Inhaled Corticosteroid',
  anticoagulant: 'Anticoagulant',
  antiplatelet: 'Antiplatelet',
  statin: 'Statin',
  biologic: 'Biologic',
  'monoclonal antibody': 'Monoclonal Antibody',
};

// ==================== Utility Functions ====================

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const prev = matrix[i - 1]?.[j - 1] ?? 0;
      const left = matrix[i]?.[j - 1] ?? 0;
      const top = matrix[i - 1]?.[j] ?? 0;
      matrix[i]![j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? prev
          : Math.min(prev + 1, left + 1, top + 1);
    }
  }
  return matrix[b.length]?.[a.length] ?? 0;
}

function similarityScore(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(na, nb) / maxLen;
}

function isMeaningfulString(val: unknown): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim().toLowerCase();
  return !PLACEHOLDER_VALUES.has(trimmed) && trimmed.length > 2;
}

function isMeaningfulArray(val: unknown): boolean {
  if (!Array.isArray(val) || val.length === 0) return false;
  return val.some((item) => {
    if (typeof item === 'string') return isMeaningfulString(item);
    if (typeof item === 'object' && item !== null) return Object.keys(item).length > 0;
    return false;
  });
}

function isFieldAdequate(field: string, value: unknown): boolean {
  if (STRING_FIELDS.includes(field as any)) {
    return isMeaningfulString(value);
  }
  if (ARRAY_FIELDS.includes(field as any)) {
    return isMeaningfulArray(value);
  }
  if (BOOLEAN_FIELDS.includes(field as any)) {
    return typeof value === 'boolean';
  }
  if (NUMBER_FIELDS.includes(field as any)) {
    return typeof value === 'number' && !Number.isNaN(value);
  }
  if (JSON_FIELDS.includes(field as any)) {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === 'object' && Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

function isValidDrugName(name: string): boolean {
  if (!name || name.trim().length < 3) return false;
  const norm = name.toLowerCase().trim();
  if (INVALID_DRUG_NAMES.has(norm)) return false;
  if (/^\d+\s*(mg|g|mcg|ml|unit|iu)s?$/i.test(norm)) return false;
  return true;
}

// ==================== Name Formatting ====================

const SPECIAL_CASES: Record<string, string> = {
  hctz: 'HCTZ',
  nsaid: 'NSAID',
  nsaids: 'NSAIDs',
  ace: 'ACE',
  arb: 'ARB',
  ssri: 'SSRI',
  snri: 'SNRI',
  maoi: 'MAOI',
  tnf: 'TNF',
  iv: 'IV',
  po: 'PO',
  im: 'IM',
  dtap: 'DTaP',
  mmr: 'MMR',
  tdap: 'Tdap',
  hpv: 'HPV',
  cana2edta: 'CaNa2EDTA',
  hiv: 'HIV',
  aids: 'AIDS',
};

function capitalizeWord(word: string): string {
  const lower = word.toLowerCase();
  if (SPECIAL_CASES[lower]) return SPECIAL_CASES[lower];
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatGenericName(name: string): string {
  if (!name) return name;
  // Generic names are typically lowercase except certain acronyms
  const lower = name.toLowerCase().trim();
  if (SPECIAL_CASES[lower]) return SPECIAL_CASES[lower];
  return lower;
}

function formatBrandName(name: string): string {
  if (!name || PLACEHOLDER_VALUES.has(name.toLowerCase().trim())) return 'No brand name available.';
  return name
    .split(/[-/\s]+/)
    .map(capitalizeWord)
    .join(name.includes('-') ? '-' : name.includes('/') ? '/' : ' ');
}

function formatDisplayName(name: string): string {
  if (!name) return name;
  return name
    .split(/[-/\s]+/)
    .map(capitalizeWord)
    .join(name.includes('-') ? '-' : name.includes('/') ? '/' : ' ');
}

function standardizeDrugClasses(classes: string[]): string[] {
  if (!Array.isArray(classes)) return [];
  const seen = new Set<string>();
  return classes
    .map((cls) => {
      const norm = cls.toLowerCase().trim();
      return STANDARD_DRUG_CLASSES[norm] || capitalizeWord(cls.trim());
    })
    .filter((cls) => {
      if (seen.has(cls)) return false;
      seen.add(cls);
      return true;
    });
}

function cleanText(text: string): string {
  if (!text) return text;
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function cleanArray(arr: unknown[], placeholder: string): string[] {
  if (!Array.isArray(arr)) return [placeholder];
  const cleaned = arr
    .filter((item): item is string => typeof item === 'string' && isMeaningfulString(item))
    .map((item) => cleanText(item));
  return cleaned.length > 0 ? cleaned : [placeholder];
}

// ==================== Gap Analysis ====================

interface GapReport {
  drugId: string;
  genericName: string;
  missingFields: string[];
  inadequateFields: string[];
  totalIssues: number;
}

// Batch size to stay under 5MB response limit
const BATCH_SIZE = 100;

async function runGapAnalysis(): Promise<GapReport[]> {
  console.log('\n' + '═'.repeat(70));
  console.log('📊 PHASE 1: GAP ANALYSIS');
  console.log('═'.repeat(70));

  const allFields = [
    ...STRING_FIELDS,
    ...ARRAY_FIELDS,
    ...BOOLEAN_FIELDS,
    ...NUMBER_FIELDS,
    ...JSON_FIELDS,
  ];
  const reports: GapReport[] = [];

  // Get total count first
  const totalCount = await prisma.drug.count();
  console.log(`\nAnalyzing ${totalCount} drugs in batches of ${BATCH_SIZE}...\n`);

  let totalMissing = 0;
  let totalInadequate = 0;
  let drugsProcessed = 0;
  const fieldMissingCounts: Record<string, number> = {};

  // Process in batches using cursor-based pagination
  let cursor: string | undefined;

  while (true) {
    const drugs = await prisma.drug.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    });

    if (drugs.length === 0) break;

    for (const drug of drugs) {
      const missing: string[] = [];
      const inadequate: string[] = [];

      for (const field of allFields) {
        const value = (drug as any)[field];
        if (value === null || value === undefined) {
          missing.push(field);
          fieldMissingCounts[field] = (fieldMissingCounts[field] || 0) + 1;
        } else if (!isFieldAdequate(field, value)) {
          inadequate.push(field);
          fieldMissingCounts[field] = (fieldMissingCounts[field] || 0) + 1;
        }
      }

      if (missing.length > 0 || inadequate.length > 0) {
        reports.push({
          drugId: drug.id,
          genericName: drug.genericName,
          missingFields: missing,
          inadequateFields: inadequate,
          totalIssues: missing.length + inadequate.length,
        });
        totalMissing += missing.length;
        totalInadequate += inadequate.length;
      }
      drugsProcessed++;
    }

    const lastDrug = drugs[drugs.length - 1];
    if (lastDrug) cursor = lastDrug.id;
    process.stdout.write(`\r   Processed: ${drugsProcessed}/${totalCount}`);
  }

  console.log(''); // New line after progress

  // Summary
  console.log('\n📋 GAP ANALYSIS SUMMARY');
  console.log(`   Total drugs: ${drugsProcessed}`);
  console.log(`   Drugs with issues: ${reports.length}`);
  console.log(`   Total missing fields: ${totalMissing}`);
  console.log(`   Total inadequate fields: ${totalInadequate}`);

  console.log('\n📈 MOST COMMONLY MISSING FIELDS:');
  const sorted = Object.entries(fieldMissingCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);
  for (const [field, count] of sorted) {
    const pct = ((count / drugsProcessed) * 100).toFixed(1);
    console.log(`   ${field}: ${count} (${pct}%)`);
  }

  return reports;
}

// ==================== Non-Pharm Cleanup ====================

interface ValidationResult {
  isValidDrug: boolean;
  reasoning: string;
  suggestedAction: 'keep' | 'delete' | 'rename';
  correctedName?: string;
}

async function validateDrugWithAI(name: string): Promise<ValidationResult> {
  const prompt = `You are a clinical pharmacist reviewing a drug database. Determine if this entry is a VALID pharmaceutical agent:

Entry: "${name}"

INVALID entries include:
- Routes of administration (oral, IV, IM, topical, etc.)
- Dosage forms (tablet, capsule, injection, solution, etc.)
- Drug classes only (antibiotic, NSAID, beta blocker, etc.) without specific drug
- Dosing instructions (BID, TID, PRN, once daily, etc.)
- Units or measurements (mg, mL, units, etc.)
- Medical conditions or procedures
- Generic medical terms
- Gibberish or malformed entries

VALID entries are:
- Specific pharmaceutical agents (aspirin, metformin, lisinopril, etc.)
- Brand names of specific drugs (Tylenol, Lipitor, etc.)
- Combination products with specific drugs (lisinopril-hydrochlorothiazide)
- Vaccines with specific names (MMR, Tdap, Gardasil, etc.)

Return JSON only:
{
  "isValidDrug": true/false,
  "reasoning": "brief explanation",
  "suggestedAction": "keep" | "delete" | "rename",
  "correctedName": "if rename, provide correct spelling/formatting"
}`;

  try {
    await tokenBucket.acquire();
    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json\n?|```/g, '')
      .trim();
    return JSON.parse(text);
  } catch {
    return {
      isValidDrug: true,
      reasoning: 'AI validation failed - keeping entry',
      suggestedAction: 'keep',
    };
  }
}

async function cleanupNonPharmEntries(
  dryRun: boolean
): Promise<{ deleted: number; renamed: number }> {
  console.log('\n' + '═'.repeat(70));
  console.log('🧹 PHASE 1B: NON-PHARM CLEANUP');
  console.log('═'.repeat(70));

  let deleted = 0;
  let renamed = 0;
  let cursor: string | undefined;

  // First pass: check entries that look suspicious
  const suspiciousEntries: Array<{ id: string; genericName: string }> = [];

  while (true) {
    const drugs = await prisma.drug.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
      select: { id: true, genericName: true },
    });

    if (drugs.length === 0) break;

    for (const drug of drugs) {
      const name = drug.genericName.toLowerCase().trim();

      // Quick heuristic check for suspicious entries
      const isSuspicious =
        name.length < 4 ||
        name.length > 50 ||
        INVALID_DRUG_NAMES.has(name) ||
        /^\d+/.test(name) ||
        /\b(mg|ml|mcg|units?|tablets?|capsules?|injection|solution|oral|iv|im|bid|tid|qid|prn)\b/i.test(
          name
        ) ||
        !/[a-z]{3,}/i.test(name);

      if (isSuspicious) {
        suspiciousEntries.push(drug);
      }
    }

    const lastDrug = drugs[drugs.length - 1];
    if (lastDrug) cursor = lastDrug.id;
  }

  console.log(`\n   Found ${suspiciousEntries.length} suspicious entries to verify with AI...\n`);

  // AI verification of suspicious entries
  for (const entry of suspiciousEntries) {
    console.log(`   Checking: "${entry.genericName}"...`);

    const validation = await validateDrugWithAI(entry.genericName);

    if (validation.suggestedAction === 'delete') {
      console.log(`     🗑️ DELETE: ${validation.reasoning}`);
      if (!dryRun) {
        await prisma.drug.delete({ where: { id: entry.id } });
      }
      deleted++;
    } else if (validation.suggestedAction === 'rename' && validation.correctedName) {
      console.log(
        `     ✏️ RENAME: "${entry.genericName}" → "${validation.correctedName}" (${validation.reasoning})`
      );
      if (!dryRun) {
        try {
          await prisma.drug.update({
            where: { id: entry.id },
            data: {
              genericName: validation.correctedName.toLowerCase(),
              displayName: formatDisplayName(validation.correctedName),
            },
          });
          renamed++;
        } catch (e) {
          // Might fail if corrected name already exists
          console.log(`       ⚠️ Rename failed (duplicate?), deleting instead`);
          await prisma.drug.delete({ where: { id: entry.id } });
          deleted++;
        }
      }
    } else {
      console.log(`     ✓ KEEP: ${validation.reasoning}`);
    }
  }

  console.log(`\n   Cleanup complete: ${deleted} deleted, ${renamed} renamed`);
  return { deleted, renamed };
}

// ==================== Fuzzy Duplicate Detection ====================

interface DuplicateGroup {
  drugs: Array<{ id: string; genericName: string; score: number }>;
  similarity: number;
}

// AI-powered duplicate verification
async function verifyDuplicatesWithAI(
  drug1: string,
  drug2: string
): Promise<{ areDuplicates: boolean; reasoning: string }> {
  const prompt = `You are a clinical pharmacist. Determine if these two entries refer to the SAME pharmaceutical agent (true duplicates):

Entry 1: "${drug1}"
Entry 2: "${drug2}"

Consider:
- Are they the same generic drug (just different spellings/abbreviations)?
- Is one a brand name and the other generic of the SAME drug?
- Are they different salts/formulations of the SAME active ingredient?

DO NOT consider them duplicates if:
- They are different drugs entirely (even if in the same class)
- They are different active ingredients
- They are combination products with different components

Return JSON only: {"areDuplicates": true/false, "reasoning": "brief explanation"}`;

  try {
    await tokenBucket.acquire();
    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json\n?|```/g, '')
      .trim();
    return JSON.parse(text);
  } catch {
    return { areDuplicates: false, reasoning: 'AI verification failed' };
  }
}

async function findFuzzyDuplicates(
  threshold = 0.8,
  verifyWithAI = true
): Promise<DuplicateGroup[]> {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 PHASE 2: FUZZY DUPLICATE DETECTION');
  console.log('═'.repeat(70));
  console.log(`   Similarity threshold: ${(threshold * 100).toFixed(0)}%`);
  console.log(`   AI verification: ${verifyWithAI ? 'enabled' : 'disabled'}\n`);

  // Fetch only id and genericName in batches to stay under 5MB
  const allDrugs: Array<{ id: string; genericName: string }> = [];
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.drug.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
      select: { id: true, genericName: true },
    });

    if (batch.length === 0) break;
    allDrugs.push(...batch);
    const lastBatch = batch[batch.length - 1];
    if (lastBatch) cursor = lastBatch.id;
  }

  console.log(`   Loaded ${allDrugs.length} drug names for comparison\n`);

  const duplicateGroups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < allDrugs.length; i++) {
    const drugI = allDrugs[i];
    if (!drugI || processed.has(drugI.id)) continue;

    const group: DuplicateGroup = {
      drugs: [{ id: drugI.id, genericName: drugI.genericName, score: 0 }],
      similarity: 1,
    };

    for (let j = i + 1; j < allDrugs.length; j++) {
      const drugJ = allDrugs[j];
      if (!drugJ || processed.has(drugJ.id)) continue;

      const sim = similarityScore(drugI.genericName, drugJ.genericName);
      if (sim >= threshold) {
        group.drugs.push({ id: drugJ.id, genericName: drugJ.genericName, score: sim });
        group.similarity = Math.min(group.similarity, sim);
        processed.add(drugJ.id);
      }
    }

    if (group.drugs.length > 1) {
      duplicateGroups.push(group);
      processed.add(drugI.id);
    }
  }

  // AI verification for suspected duplicates
  if (verifyWithAI && duplicateGroups.length > 0) {
    console.log(`\n🤖 AI-verifying ${duplicateGroups.length} potential duplicate groups...\n`);
    const verifiedGroups: DuplicateGroup[] = [];

    for (const group of duplicateGroups) {
      // Compare first drug against all others in group
      const baseDrug = group.drugs[0];
      if (!baseDrug) continue;
      const verifiedDrugs: { id: string; genericName: string; score: number }[] = [baseDrug];

      for (let i = 1; i < group.drugs.length; i++) {
        const candidate = group.drugs[i];
        if (!candidate) continue;
        console.log(`   Checking: "${baseDrug.genericName}" vs "${candidate.genericName}"...`);

        const verification = await verifyDuplicatesWithAI(
          baseDrug.genericName,
          candidate.genericName
        );

        if (verification.areDuplicates) {
          console.log(`     ✓ CONFIRMED duplicate: ${verification.reasoning}`);
          verifiedDrugs.push(candidate);
        } else {
          console.log(`     ✗ NOT duplicate: ${verification.reasoning}`);
        }
      }

      if (verifiedDrugs.length > 1) {
        verifiedGroups.push({ drugs: verifiedDrugs, similarity: group.similarity });
      }
    }

    console.log(
      `\n   AI verified ${verifiedGroups.length} actual duplicate groups (from ${duplicateGroups.length} candidates)`
    );
    return verifiedGroups;
  }

  // Report
  console.log(`Found ${duplicateGroups.length} potential duplicate groups:\n`);
  for (const group of duplicateGroups.slice(0, 20)) {
    console.log(`  📦 Group (${(group.similarity * 100).toFixed(0)}% similar):`);
    for (const drug of group.drugs) {
      console.log(`     - ${drug.genericName} (ID: ${drug.id.slice(0, 8)}...)`);
    }
  }

  if (duplicateGroups.length > 20) {
    console.log(`  ... and ${duplicateGroups.length - 20} more groups`);
  }

  return duplicateGroups;
}

// ==================== Merge Duplicates ====================

function countPopulatedFields(drug: Record<string, any>): number {
  let score = 0;
  for (const field of STRING_FIELDS) if (isMeaningfulString(drug[field])) score++;
  for (const field of ARRAY_FIELDS) if (isMeaningfulArray(drug[field])) score++;
  for (const field of BOOLEAN_FIELDS) if (typeof drug[field] === 'boolean') score++;
  for (const field of NUMBER_FIELDS) if (typeof drug[field] === 'number') score++;
  for (const field of JSON_FIELDS) if (drug[field] && typeof drug[field] === 'object') score++;
  return score;
}

async function mergeDuplicateGroup(group: DuplicateGroup, dryRun: boolean): Promise<number> {
  // Fetch full drug records
  const fullDrugs = await prisma.drug.findMany({
    where: { id: { in: group.drugs.map((d) => d.id) } },
  });

  // Sort by populated field count (highest first), then by creation date (oldest first)
  fullDrugs.sort((a, b) => {
    const diff = countPopulatedFields(b as any) - countPopulatedFields(a as any);
    if (diff !== 0) return diff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const survivor = fullDrugs[0];
  if (!survivor) return 0;
  const victims = fullDrugs.slice(1);

  console.log(`  🔄 Merging ${fullDrugs.length} records into "${survivor.genericName}"`);

  // Harvest fields from victims
  const updates: Record<string, any> = {};

  for (const victim of victims) {
    for (const field of STRING_FIELDS) {
      if (
        !isMeaningfulString((survivor as any)[field]) &&
        isMeaningfulString((victim as any)[field])
      ) {
        updates[field] = (victim as any)[field];
      }
    }
    for (const field of ARRAY_FIELDS) {
      const survivorArr = (survivor as any)[field] || [];
      const victimArr = (victim as any)[field] || [];
      if (!isMeaningfulArray(survivorArr) && isMeaningfulArray(victimArr)) {
        updates[field] = victimArr;
      } else if (isMeaningfulArray(victimArr)) {
        // Merge arrays
        const combined = [...survivorArr];
        for (const item of victimArr) {
          if (typeof item === 'string' && !combined.includes(item)) combined.push(item);
        }
        if (combined.length > survivorArr.length) updates[field] = combined;
      }
    }
    for (const field of BOOLEAN_FIELDS) {
      if (
        typeof (survivor as any)[field] !== 'boolean' &&
        typeof (victim as any)[field] === 'boolean'
      ) {
        updates[field] = (victim as any)[field];
      }
    }
    for (const field of NUMBER_FIELDS) {
      if (
        typeof (survivor as any)[field] !== 'number' &&
        typeof (victim as any)[field] === 'number'
      ) {
        updates[field] = (victim as any)[field];
      }
    }
    for (const field of JSON_FIELDS) {
      if (!(survivor as any)[field] && (victim as any)[field]) {
        updates[field] = (victim as any)[field];
      }
    }
  }

  if (!dryRun) {
    if (Object.keys(updates).length > 0) {
      await prisma.drug.update({ where: { id: survivor.id }, data: updates });
      console.log(`     ✓ Harvested ${Object.keys(updates).length} fields`);
    }
    for (const victim of victims) {
      await prisma.drug.delete({ where: { id: victim.id } });
      console.log(`     🗑️ Deleted duplicate: ${victim.genericName}`);
    }
  } else {
    console.log(
      `     [DRY RUN] Would harvest ${Object.keys(updates).length} fields and delete ${victims.length} duplicates`
    );
  }

  return victims.length;
}

// ==================== Content Generation with AI ====================

interface DrugGenerationResult {
  isValid: boolean;
  genericName: string;
  brandName: string;
  displayName: string;
  drugClass: string[];
  mechanismOfAction: string;
  mechanismDetailed: string;
  indications: string[];
  contraindications: string[];
  sideEffects: string[];
  dosing: string;
  aliases: string[];
  tags: string[];
  isHighYield: boolean;
  panceYield: number;
  isFirstLine: boolean;
  genericAvailable: boolean;
  insuranceTier: number;
  clinicalNotes: string;
  clinicalPearls: string[];
  boardYieldFacts: string[];
  testQuestionTips: string[];
  commonMistakes: string[];
  mnemonics: string[];
  monitoringParams: string[];
  blackBoxWarnings: string[];
  riskStrategies: string[];
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
  absorption: string;
  distribution: string;
  metabolism: string;
  metabolismDetail: string;
  elimination: string;
  eliminationRoute: string;
  halfLife: string;
  onsetOfAction: string;
  peakEffect: string;
  duration: string;
  bioavailability: string;
  pharmacokinetics: {
    absorption: string;
    distribution: string;
    metabolism: string;
    elimination: string;
    halfLife: string;
    bioavailability: string;
  };
  cyp450Effects: {
    inhibits: string[];
    induces: string[];
    substrates: string[];
  };
  majorInteractions: Array<{
    drug: string;
    severity: string;
    mechanism: string;
    clinicalEffect: string;
    management: string;
  }>;
  interactions: string[];
  foodInteractions: string[];
  routesOfAdmin: string[];
  formulations: string[];
  administrationTips: string;
  storageRequirements: string;
  reversalAgent: string;
  antidote: string;
  toxicity: string;
  maxDailyDose: string;
  typicalCost: string;
}

async function generateDrugContent(
  drugName: string,
  existingData?: Partial<DrugGenerationResult>
): Promise<DrugGenerationResult | null> {
  const prompt = `You are a PA/NP pharmacology educator for the PANCE exam. Generate comprehensive drug information for "${drugName}".

VALIDATION FIRST:
- If this is NOT a specific pharmaceutical agent (e.g., it's a route like "oral", a dosage form like "tablet", a class only like "antibiotic", or any non-drug term), respond ONLY with: {"isValid": false}
- Only continue if this is a real, specific drug/medication.

If VALID, return this EXACT JSON structure with ALL fields populated. For any field where there is truly no information, use "No [field description] available." for strings or ["No [field description] available."] for arrays. NEVER leave fields empty or null.

{
  "isValid": true,
  "genericName": "lowercase generic name",
  "brandName": "Capitalized Brand Name or 'No brand name available.'",
  "displayName": "Properly Capitalized Display Name",
  "drugClass": ["Primary Class", "Secondary Class if applicable"],
  "mechanismOfAction": "Clear, concise MOA for PA students",
  "mechanismDetailed": "Detailed mechanism with receptor/pathway specifics",
  "indications": ["FDA-approved indication 1", "Off-label use if common"],
  "contraindications": ["Absolute contraindication", "Relative contraindication"],
  "sideEffects": ["Common side effect 1", "Serious side effect 2"],
  "dosing": "Standard adult dosing with route, frequency, and common adjustments",
  "aliases": ["Alternative name 1", "Abbreviation"] or ["No aliases available."],
  "tags": ["category1", "high-yield", "board-favorite"],
  "isHighYield": true,
  "panceYield": 2,
  "isFirstLine": true,
  "genericAvailable": true,
  "insuranceTier": 2,
  "clinicalNotes": "Key clinical pearls and practical prescribing tips",
  "clinicalPearls": ["Pearl 1 with clinical reasoning", "Pearl 2"],
  "boardYieldFacts": ["High-yield fact for boards", "Classic association"],
  "testQuestionTips": ["How this appears on PANCE", "Common question stems"],
  "commonMistakes": ["Prescribing error to avoid", "Monitoring mistake"],
  "mnemonics": ["Memory aid if exists"] or ["No mnemonics available."],
  "monitoringParams": ["Lab to monitor", "Clinical parameter"],
  "blackBoxWarnings": ["FDA warning text"] or ["No black box warnings."],
  "riskStrategies": ["REMS requirement"] or ["No REMS requirements."],
  "pregnancyCategory": "Category X/D/C/B/A or 'See labeling'",
  "pregnancyNotes": "Specific pregnancy considerations",
  "lactationSafety": "Safe/Caution/Avoid",
  "lactationNotes": "Breastfeeding considerations",
  "pediatricDosing": "Weight-based dosing or age restrictions",
  "pediatricNotes": "Pediatric-specific considerations",
  "geriatricDosing": "Elderly dosing adjustments",
  "geriatricNotes": "Geriatric-specific considerations",
  "renalDosing": "CrCl-based adjustments",
  "hepaticDosing": "Hepatic impairment adjustments",
  "absorption": "Oral absorption characteristics",
  "distribution": "Volume of distribution, protein binding",
  "metabolism": "Primary metabolic pathway",
  "metabolismDetail": "CYP enzymes, active metabolites",
  "elimination": "Primary elimination route",
  "eliminationRoute": "Renal/Hepatic/Fecal percentage",
  "halfLife": "Terminal half-life",
  "onsetOfAction": "Time to initial effect",
  "peakEffect": "Time to peak effect",
  "duration": "Duration of action",
  "bioavailability": "Oral bioavailability percentage",
  "pharmacokinetics": {
    "absorption": "details",
    "distribution": "details",
    "metabolism": "details",
    "elimination": "details",
    "halfLife": "details",
    "bioavailability": "details"
  },
  "cyp450Effects": {
    "inhibits": ["CYP enzyme"] or ["No significant inhibition."],
    "induces": ["CYP enzyme"] or ["No significant induction."],
    "substrates": ["CYP enzyme"] or ["Not significantly metabolized by CYP450."]
  },
  "majorInteractions": [
    {
      "drug": "Interacting Drug",
      "severity": "major/moderate/minor",
      "mechanism": "How interaction occurs",
      "clinicalEffect": "What happens clinically",
      "management": "How to manage"
    }
  ],
  "interactions": ["Drug 1 - effect", "Drug 2 - effect"],
  "foodInteractions": ["Food interaction"] or ["No significant food interactions."],
  "routesOfAdmin": ["PO", "IV"],
  "formulations": ["Tablet", "Solution"],
  "administrationTips": "How to properly take/give the medication",
  "storageRequirements": "Storage conditions",
  "reversalAgent": "Reversal agent if exists or 'No specific reversal agent.'",
  "antidote": "Antidote if exists or 'No specific antidote.'",
  "toxicity": "Overdose presentation and management",
  "maxDailyDose": "Maximum safe daily dose",
  "typicalCost": "$/$$/$$$/$$$$"
}

RULES:
- ALL fields must have meaningful content. Never return empty strings, empty arrays, null, or undefined.
- For truly unavailable info, use descriptive placeholders like "No [field] available." or "Not applicable."
- panceYield: 1=Low, 2=Medium, 3=High
- insuranceTier: 1-4 (1=generic/preferred, 4=specialty)
- Return ONLY valid JSON, no markdown, no explanation.`;

  let attempts = 0;
  const maxAttempts = 4;
  let delay = 2000;

  while (attempts < maxAttempts) {
    try {
      await tokenBucket.acquire();
      const result = await model.generateContent(prompt);
      const text = result.response
        .text()
        .replace(/```json\n?|```/g, '')
        .trim();
      const parsed = JSON.parse(text) as DrugGenerationResult;

      if (parsed.isValid === false) {
        console.log(`  🚫 AI marked as invalid: ${drugName}`);
        return null;
      }

      return parsed;
    } catch (err: any) {
      attempts++;
      const msg = err?.message || String(err);

      if (msg.includes('RECITATION')) {
        console.log(`  ⚠️ Recitation blocked for ${drugName}`);
        return null;
      }

      if (attempts >= maxAttempts) {
        console.log(`  ❌ Failed after ${maxAttempts} attempts: ${drugName}`);
        return null;
      }

      console.log(
        `  🔄 Retry ${attempts}/${maxAttempts} after ${delay}ms (${msg.slice(0, 50)}...)`
      );
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }

  return null;
}

function sanitizeAndFormat(data: DrugGenerationResult, originalName: string): Record<string, any> {
  const ensureString = (val: unknown, placeholder: string): string => {
    if (typeof val === 'string' && isMeaningfulString(val)) return cleanText(val);
    return placeholder;
  };

  const ensureArray = (val: unknown, placeholder: string): string[] => {
    if (Array.isArray(val)) {
      const cleaned = cleanArray(val, placeholder);
      return cleaned;
    }
    return [placeholder];
  };

  return {
    genericName: formatGenericName(data.genericName || originalName),
    brandName: formatBrandName(data.brandName),
    displayName: formatDisplayName(data.displayName || originalName),
    drugClass: standardizeDrugClasses(data.drugClass || []),
    mechanismOfAction: ensureString(data.mechanismOfAction, 'Mechanism of action not available.'),
    mechanismDetailed: ensureString(data.mechanismDetailed, 'Detailed mechanism not available.'),
    indications: ensureArray(data.indications, 'No indications available.'),
    contraindications: ensureArray(data.contraindications, 'No contraindications available.'),
    sideEffects: ensureArray(data.sideEffects, 'No side effects documented.'),
    dosing: ensureString(data.dosing, 'Dosing information not available.'),
    aliases: ensureArray(data.aliases, 'No aliases available.'),
    tags: ensureArray(data.tags, 'general'),
    isHighYield: typeof data.isHighYield === 'boolean' ? data.isHighYield : false,
    panceYield:
      typeof data.panceYield === 'number' && data.panceYield >= 1 && data.panceYield <= 3
        ? data.panceYield
        : 2,
    isFirstLine: typeof data.isFirstLine === 'boolean' ? data.isFirstLine : false,
    genericAvailable: typeof data.genericAvailable === 'boolean' ? data.genericAvailable : true,
    insuranceTier:
      typeof data.insuranceTier === 'number' && data.insuranceTier >= 1 && data.insuranceTier <= 4
        ? data.insuranceTier
        : 2,
    clinicalNotes: ensureString(data.clinicalNotes, 'No clinical notes available.'),
    clinicalPearls: ensureArray(data.clinicalPearls, 'No clinical pearls available.'),
    boardYieldFacts: ensureArray(data.boardYieldFacts, 'No board yield facts available.'),
    testQuestionTips: ensureArray(data.testQuestionTips, 'No test tips available.'),
    commonMistakes: ensureArray(data.commonMistakes, 'No common mistakes documented.'),
    mnemonics: ensureArray(data.mnemonics, 'No mnemonics available.'),
    monitoringParams: ensureArray(data.monitoringParams, 'No specific monitoring required.'),
    blackBoxWarnings: ensureArray(data.blackBoxWarnings, 'No black box warnings.'),
    riskStrategies: ensureArray(data.riskStrategies, 'No REMS requirements.'),
    pregnancyCategory: ensureString(data.pregnancyCategory, 'Not categorized.'),
    pregnancyNotes: ensureString(data.pregnancyNotes, 'No pregnancy information available.'),
    lactationSafety: ensureString(data.lactationSafety, 'Safety not established.'),
    lactationNotes: ensureString(data.lactationNotes, 'No lactation information available.'),
    pediatricDosing: ensureString(data.pediatricDosing, 'Pediatric dosing not established.'),
    pediatricNotes: ensureString(data.pediatricNotes, 'No pediatric notes available.'),
    geriatricDosing: ensureString(data.geriatricDosing, 'No specific geriatric adjustments.'),
    geriatricNotes: ensureString(data.geriatricNotes, 'No geriatric notes available.'),
    renalDosing: ensureString(data.renalDosing, 'No renal adjustments documented.'),
    hepaticDosing: ensureString(data.hepaticDosing, 'No hepatic adjustments documented.'),
    absorption: ensureString(data.absorption, 'Absorption data not available.'),
    distribution: ensureString(data.distribution, 'Distribution data not available.'),
    metabolism: ensureString(data.metabolism, 'Metabolism data not available.'),
    metabolismDetail: ensureString(data.metabolismDetail, 'Detailed metabolism not available.'),
    elimination: ensureString(data.elimination, 'Elimination data not available.'),
    eliminationRoute: ensureString(data.eliminationRoute, 'Elimination route not specified.'),
    halfLife: ensureString(data.halfLife, 'Half-life not available.'),
    onsetOfAction: ensureString(data.onsetOfAction, 'Onset data not available.'),
    peakEffect: ensureString(data.peakEffect, 'Peak effect data not available.'),
    duration: ensureString(data.duration, 'Duration data not available.'),
    bioavailability: ensureString(data.bioavailability, 'Bioavailability data not available.'),
    pharmacokinetics:
      data.pharmacokinetics && typeof data.pharmacokinetics === 'object'
        ? {
            absorption: ensureString(data.pharmacokinetics.absorption, 'Not available'),
            distribution: ensureString(data.pharmacokinetics.distribution, 'Not available'),
            metabolism: ensureString(data.pharmacokinetics.metabolism, 'Not available'),
            elimination: ensureString(data.pharmacokinetics.elimination, 'Not available'),
            halfLife: ensureString(data.pharmacokinetics.halfLife, 'Not available'),
            bioavailability: ensureString(data.pharmacokinetics.bioavailability, 'Not available'),
          }
        : {
            absorption: 'Not available',
            distribution: 'Not available',
            metabolism: 'Not available',
            elimination: 'Not available',
            halfLife: 'Not available',
            bioavailability: 'Not available',
          },
    cyp450Effects:
      data.cyp450Effects && typeof data.cyp450Effects === 'object'
        ? {
            inhibits: ensureArray(data.cyp450Effects.inhibits, 'No significant inhibition.'),
            induces: ensureArray(data.cyp450Effects.induces, 'No significant induction.'),
            substrates: ensureArray(
              data.cyp450Effects.substrates,
              'Not significantly metabolized by CYP450.'
            ),
          }
        : {
            inhibits: ['No significant inhibition.'],
            induces: ['No significant induction.'],
            substrates: ['Not significantly metabolized by CYP450.'],
          },
    majorInteractions:
      Array.isArray(data.majorInteractions) && data.majorInteractions.length > 0
        ? data.majorInteractions.map((i) => ({
            drug: formatDisplayName(String(i.drug || 'Unknown')),
            severity: String(i.severity || 'moderate'),
            mechanism: String(i.mechanism || 'Not specified'),
            clinicalEffect: String(i.clinicalEffect || 'Not specified'),
            management: String(i.management || 'Monitor closely'),
          }))
        : [
            {
              drug: 'None',
              severity: 'none',
              mechanism: 'No significant interactions',
              clinicalEffect: 'None',
              management: 'None',
            },
          ],
    interactions: ensureArray(data.interactions, 'No significant interactions.'),
    foodInteractions: ensureArray(data.foodInteractions, 'No significant food interactions.'),
    routesOfAdmin: ensureArray(data.routesOfAdmin, 'Route not specified.'),
    formulations: ensureArray(data.formulations, 'Formulation not specified.'),
    administrationTips: ensureString(data.administrationTips, 'No specific administration tips.'),
    storageRequirements: ensureString(data.storageRequirements, 'Store at room temperature.'),
    reversalAgent: ensureString(data.reversalAgent, 'No specific reversal agent.'),
    antidote: ensureString(data.antidote, 'No specific antidote.'),
    toxicity: ensureString(data.toxicity, 'Toxicity information not available.'),
    maxDailyDose: ensureString(data.maxDailyDose, 'Maximum dose not specified.'),
    typicalCost: ensureString(data.typicalCost, '$$'),
  };
}

// ==================== Content Enhancement ====================

async function enhanceDrugs(options: {
  limit?: number;
  dryRun?: boolean;
  batchSize?: number;
  gapReports?: GapReport[];
}): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('🔧 PHASE 3: CONTENT GENERATION & ENHANCEMENT');
  console.log('═'.repeat(70));

  const { limit, dryRun = false, batchSize = 50, gapReports } = options;

  // Use gap reports if available, otherwise process all drugs
  const drugsToProcess =
    gapReports && gapReports.length > 0
      ? gapReports.filter((r) => r.totalIssues > 0)
      : await runGapAnalysis();

  console.log(
    `\nProcessing ${limit ? Math.min(limit, drugsToProcess.length) : drugsToProcess.length} drugs with issues...\n`
  );

  let processed = 0;
  let enhanced = 0;
  let invalid = 0;
  let failed = 0;

  for (const report of drugsToProcess) {
    if (limit && processed >= limit) break;

    const drug = await prisma.drug.findUnique({ where: { id: report.drugId } });
    if (!drug) continue;

    if (!isValidDrugName(drug.genericName)) {
      console.log(`\n🚫 Invalid drug name: "${drug.genericName}" - deleting...`);
      if (!dryRun) {
        await prisma.drug.delete({ where: { id: drug.id } });
      }
      invalid++;
      processed++;
      continue;
    }

    console.log(`\n📝 [${processed + 1}] ${drug.genericName}`);
    console.log(
      `   Missing: ${report.missingFields.length}, Inadequate: ${report.inadequateFields.length}`
    );

    const generated = await generateDrugContent(drug.genericName);

    if (!generated) {
      console.log(`   ❌ Generation failed or marked invalid`);
      if (!dryRun && !generated) {
        // Check if AI specifically marked as invalid (non-drug term)
        await prisma.drug.delete({ where: { id: drug.id } });
        console.log(`   🗑️ Deleted invalid entry`);
        invalid++;
      } else {
        failed++;
      }
      processed++;
      continue;
    }

    const sanitized = sanitizeAndFormat(generated, drug.genericName);

    // Build update data - only update fields that are missing or inadequate
    const updateData: Record<string, any> = {};
    const allIssueFields = [...report.missingFields, ...report.inadequateFields];

    for (const field of allIssueFields) {
      if (sanitized[field] !== undefined) {
        updateData[field] = sanitized[field];
      }
    }

    // Always update name formatting
    updateData.genericName = sanitized.genericName;
    updateData.brandName = sanitized.brandName;
    updateData.displayName = sanitized.displayName;

    if (Object.keys(updateData).length > 0) {
      if (!dryRun) {
        try {
          // 1. Try to update normally
          await prisma.drug.update({ where: { id: drug.id }, data: updateData });
          console.log(`   ✅ Updated ${Object.keys(updateData).length} fields`);
          enhanced++;
        } catch (error: any) {
          // 2. CATCH COLLISION: If renaming fails because the name exists
          if (error.code === 'P2002' && error.meta?.target?.includes('genericName')) {
            const targetName = updateData.genericName;
            console.log(`   ⚠️ Collision detected: "${targetName}" already exists.`);

            // Find the record that is blocking us
            const targetDrug = await prisma.drug.findUnique({
              where: { genericName: targetName },
            });

            if (targetDrug) {
              console.log(
                `   🔄 JIT Merge: Moving data to ID ${targetDrug.id} and deleting duplicate.`
              );

              // Remove the name change (since target already has that name)
              delete updateData.genericName;

              // Apply the AI-generated content to the TARGET record instead
              if (Object.keys(updateData).length > 0) {
                await prisma.drug.update({
                  where: { id: targetDrug.id },
                  data: updateData,
                });
                console.log(`   ✓ Data merged into target.`);
              }

              // Delete the current record (the duplicate)
              await prisma.drug.delete({ where: { id: drug.id } });
              console.log(`   ❌ Deleted duplicate source ID ${drug.id.slice(0, 8)}...`);
              enhanced++;
            }
          } else {
            // Re-throw if it's a different error
            throw error;
          }
        }
      } else {
        console.log(`   [DRY RUN] Would update ${Object.keys(updateData).length} fields`);
        enhanced++;
      }
    }

    processed++;

    // Rate limit between drugs
    if (processed % batchSize === 0) {
      console.log(`\n   ⏳ Batch complete. Brief pause...`);
      await sleep(2000);
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log('📊 ENHANCEMENT SUMMARY');
  console.log(`   Processed: ${processed}`);
  console.log(`   Enhanced: ${enhanced}`);
  console.log(`   Invalid (deleted): ${invalid}`);
  console.log(`   Failed: ${failed}`);
}

// ==================== Final Name Formatting Pass ====================

async function formatAllNames(dryRun: boolean): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('✨ PHASE 4: NAME FORMATTING');
  console.log('═'.repeat(70));

  let updated = 0;
  let cursor: string | undefined;

  while (true) {
    const drugs = await prisma.drug.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
      select: { id: true, genericName: true, brandName: true, displayName: true, drugClass: true },
    });

    if (drugs.length === 0) break;

    for (const drug of drugs) {
      const updates: Record<string, any> = {};

      const newGeneric = formatGenericName(drug.genericName);
      if (newGeneric !== drug.genericName) updates.genericName = newGeneric;

      const newBrand = formatBrandName(drug.brandName || '');
      if (newBrand !== drug.brandName) updates.brandName = newBrand;

      const newDisplay = formatDisplayName(drug.displayName || drug.genericName);
      if (newDisplay !== drug.displayName) updates.displayName = newDisplay;

      const newClasses = standardizeDrugClasses(drug.drugClass || []);
      if (JSON.stringify(newClasses) !== JSON.stringify(drug.drugClass))
        updates.drugClass = newClasses;

      if (Object.keys(updates).length > 0) {
        if (!dryRun) {
          try {
            await prisma.drug.update({ where: { id: drug.id }, data: updates });
            updated++;
            console.log(`  ✓ ${drug.genericName} → ${updates.displayName || drug.displayName}`);
          } catch (error: any) {
            // Handle collision if renaming to existing name
            if (error.code === 'P2002' && error.meta?.target?.includes('genericName')) {
              const targetName = updates.genericName;
              console.log(`  ⚠️ Collision: "${targetName}" exists. Merging...`);
              const targetDrug = await prisma.drug.findUnique({
                where: { genericName: targetName },
              });
              if (targetDrug) {
                delete updates.genericName;
                if (Object.keys(updates).length > 0) {
                  await prisma.drug.update({ where: { id: targetDrug.id }, data: updates });
                }
                await prisma.drug.delete({ where: { id: drug.id } });
                console.log(`  🔄 Merged into ${targetName}, deleted duplicate`);
                updated++;
              }
            } else {
              throw error;
            }
          }
        } else {
          updated++;
          console.log(`  ✓ ${drug.genericName} → ${updates.displayName || drug.displayName}`);
        }
      }
    }

    const lastDrug = drugs[drugs.length - 1];
    if (lastDrug) cursor = lastDrug.id;
  }

  console.log(`\n   Formatted ${updated} drug names.`);
}

// ==================== PANCE Drug Gap Discovery (Enhanced) ====================

interface MissingDrugSuggestion {
  genericName: string;
  brandName: string;
  drugClass: string;
  panceYield: number;
  reasoning: string;
}

/**
 * PANCE Blueprint-Aligned Drug Categories (2024)
 * Organized by PANCE content areas with specific subcategories
 * Based on NCCPA PANCE Content Blueprint percentages
 */
const PANCE_BLUEPRINT_CATEGORIES = {
  // Cardiovascular (16% of PANCE)
  cardiovascular: [
    'Hypertension: ACE inhibitors, ARBs, calcium channel blockers, thiazides, beta-blockers, alpha-blockers, direct vasodilators',
    'Heart Failure: Loop diuretics, potassium-sparing diuretics, ACE inhibitors, ARBs, ARNIs (sacubitril-valsartan), beta-blockers, digoxin, SGLT2 inhibitors for HF',
    'Arrhythmias: Class I-IV antiarrhythmics, adenosine, amiodarone, sotalol, dronedarone, flecainide, propafenone, dofetilide',
    'Coronary Artery Disease: Antiplatelets (aspirin, clopidogrel, ticagrelor, prasugrel), statins, ezetimibe, PCSK9 inhibitors, fibrates, niacin, nitrates, ranolazine',
    'Anticoagulation: Warfarin, heparins (UFH, LMWH), DOACs (rivaroxaban, apixaban, dabigatran, edoxaban), reversal agents (vitamin K, protamine, idarucizumab, andexanet alfa)',
    'Peripheral Vascular: Cilostazol, pentoxifylline, antiplatelet therapy',
    'Shock/Critical Care: Vasopressors (norepinephrine, epinephrine, dopamine, dobutamine, vasopressin, phenylephrine), inotropes',
  ],

  // Pulmonary (12% of PANCE)
  pulmonary: [
    'Asthma: SABAs (albuterol, levalbuterol), LABAs (salmeterol, formoterol, vilanterol), ICS (fluticasone, budesonide, mometasone, beclomethasone), ICS-LABA combos, LAMAs, leukotriene modifiers (montelukast, zafirlukast), theophylline, biologics (omalizumab, mepolizumab, benralizumab, dupilumab)',
    'COPD: Tiotropium, umeclidinium, glycopyrrolate, aclidinium, triple therapy inhalers, roflumilast, systemic corticosteroids',
    'Pneumonia: Community-acquired (amoxicillin, azithromycin, doxycycline, fluoroquinolones, beta-lactams), hospital-acquired (piperacillin-tazobactam, cefepime, meropenem, vancomycin, linezolid)',
    'Pulmonary Embolism: Anticoagulants, thrombolytics (alteplase, tenecteplase)',
    'Tuberculosis: RIPE therapy (rifampin, isoniazid, pyrazinamide, ethambutol), pyridoxine prophylaxis',
    'Pulmonary Fibrosis: Pirfenidone, nintedanib',
    'Allergic Rhinitis: Intranasal corticosteroids, antihistamines (cetirizine, loratadine, fexofenadine, diphenhydramine), decongestants',
  ],

  // Gastrointestinal (10% of PANCE)
  gastrointestinal: [
    'GERD/PUD: PPIs (omeprazole, esomeprazole, pantoprazole, lansoprazole, rabeprazole), H2RAs (famotidine, ranitidine), sucralfate, misoprostol, H. pylori therapy (clarithromycin, amoxicillin, metronidazole, bismuth)',
    'IBD: 5-ASAs (mesalamine, sulfasalazine, balsalazide), immunomodulators (azathioprine, 6-MP, methotrexate), biologics (infliximab, adalimumab, vedolizumab, ustekinumab), budesonide, prednisone',
    'IBS: Antispasmodics (dicyclomine, hyoscyamine), lubiprostone, linaclotide, plecanatide, rifaximin, eluxadoline, alosetron',
    'Nausea/Vomiting: Ondansetron, granisetron, promethazine, prochlorperazine, metoclopramide, scopolamine, dronabinol, aprepitant',
    'Constipation: Osmotic laxatives (PEG, lactulose, magnesium), stimulant laxatives (bisacodyl, senna), stool softeners (docusate), methylnaltrexone, naloxegol',
    'Diarrhea: Loperamide, diphenoxylate-atropine, bismuth subsalicylate, cholestyramine',
    'Hepatic: Lactulose for hepatic encephalopathy, rifaximin, ursodiol, cholestyramine for pruritus',
    'Pancreatic: Pancreatic enzyme replacement (pancrelipase)',
  ],

  // Musculoskeletal (10% of PANCE)
  musculoskeletal: [
    'NSAIDs: Ibuprofen, naproxen, celecoxib, meloxicam, diclofenac, ketorolac, indomethacin, piroxicam',
    'Gout: Colchicine, allopurinol, febuxostat, probenecid, pegloticase',
    'Rheumatoid Arthritis: Methotrexate, hydroxychloroquine, sulfasalazine, leflunomide, biologics (etanercept, adalimumab, infliximab, tocilizumab, abatacept, tofacitinib, baricitinib)',
    'Osteoporosis: Bisphosphonates (alendronate, risedronate, ibandronate, zoledronic acid), denosumab, teriparatide, romosozumab, raloxifene, calcium, vitamin D',
    'Muscle Relaxants: Cyclobenzaprine, methocarbamol, baclofen, tizanidine, carisoprodol, dantrolene',
    'Fibromyalgia: Pregabalin, duloxetine, milnacipran, amitriptyline',
    'Osteoarthritis: Acetaminophen, topical NSAIDs, topical capsaicin, intra-articular corticosteroids, hyaluronic acid',
  ],

  // Endocrine (9% of PANCE)
  endocrine: [
    'Type 2 Diabetes: Metformin, sulfonylureas (glipizide, glyburide, glimepiride), DPP-4 inhibitors (sitagliptin, saxagliptin, linagliptin), GLP-1 agonists (liraglutide, semaglutide, dulaglutide, exenatide), SGLT2 inhibitors (empagliflozin, dapagliflozin, canagliflozin), thiazolidinediones (pioglitazone), alpha-glucosidase inhibitors (acarbose)',
    'Type 1 Diabetes/Insulin: Rapid-acting (lispro, aspart, glulisine), short-acting (regular), intermediate (NPH), long-acting (glargine, detemir, degludec), premixed insulins',
    'Thyroid: Levothyroxine, liothyronine, methimazole, propylthiouracil, potassium iodide, propranolol for thyroid storm',
    'Adrenal: Hydrocortisone, prednisone, dexamethasone, fludrocortisone, spironolactone for hyperaldosteronism',
    'Pituitary: Desmopressin, octreotide, lanreotide, bromocriptine, cabergoline',
    'Calcium/Bone: Calcitonin, cinacalcet, sevelamer, calcium carbonate/acetate',
    'Hypoglycemia Treatment: Glucagon, dextrose, diazoxide',
  ],

  // Neurologic (6% of PANCE)
  neurologic: [
    'Seizures: Phenytoin, carbamazepine, valproic acid, levetiracetam, lamotrigine, topiramate, oxcarbazepine, lacosamide, brivaracetam, phenobarbital, ethosuximide, clobazam, benzodiazepines (for status)',
    'Parkinson Disease: Carbidopa-levodopa, dopamine agonists (pramipexole, ropinirole, rotigotine), MAO-B inhibitors (selegiline, rasagiline, safinamide), COMT inhibitors (entacapone, tolcapone), amantadine, anticholinergics (benztropine, trihexyphenidyl)',
    'Migraine: Triptans (sumatriptan, rizatriptan, eletriptan, zolmitriptan), gepants (rimegepant, ubrogepant), ditans (lasmiditan), ergotamines, prophylaxis (propranolol, topiramate, valproate, amitriptyline, CGRP inhibitors - erenumab, fremanezumab, galcanezumab)',
    'Multiple Sclerosis: Interferons, glatiramer, dimethyl fumarate, fingolimod, teriflunomide, natalizumab, ocrelizumab, siponimod',
    'Alzheimer/Dementia: Cholinesterase inhibitors (donepezil, rivastigmine, galantamine), memantine',
    'Neuropathic Pain: Gabapentin, pregabalin, duloxetine, amitriptyline, nortriptyline, capsaicin topical',
    'Myasthenia Gravis: Pyridostigmine, immunosuppressants',
    'Restless Legs: Dopamine agonists, gabapentin enacarbil',
  ],

  // Psychiatry (6% of PANCE)
  psychiatry: [
    'Depression: SSRIs (sertraline, fluoxetine, paroxetine, citalopram, escitalopram), SNRIs (venlafaxine, duloxetine, desvenlafaxine), TCAs (amitriptyline, nortriptyline, desipramine), bupropion, mirtazapine, trazodone, vilazodone, vortioxetine, MAOIs (phenelzine, tranylcypromine, selegiline patch)',
    'Anxiety: Buspirone, benzodiazepines (alprazolam, lorazepam, clonazepam, diazepam), hydroxyzine, propranolol for performance anxiety',
    'Bipolar Disorder: Lithium, valproate, lamotrigine, carbamazepine, atypical antipsychotics (quetiapine, olanzapine, aripiprazole, lurasidone, cariprazine)',
    'Schizophrenia: First-gen antipsychotics (haloperidol, chlorpromazine, fluphenazine), second-gen (risperidone, olanzapine, quetiapine, aripiprazole, ziprasidone, clozapine, paliperidone, lurasidone, brexpiprazole, cariprazine)',
    'ADHD: Stimulants (methylphenidate, amphetamine salts, lisdexamfetamine), non-stimulants (atomoxetine, guanfacine, clonidine, viloxazine)',
    'Insomnia: Z-drugs (zolpidem, eszopiclone, zaleplon), ramelteon, suvorexant, lemborexant, doxepin, trazodone',
    'OCD: High-dose SSRIs, clomipramine',
    'PTSD: Sertraline, paroxetine, prazosin for nightmares',
    'Substance Use: Naltrexone, acamprosate, disulfiram (alcohol); buprenorphine, methadone, naltrexone (opioid); varenicline, bupropion, nicotine replacement (tobacco)',
  ],

  // Infectious Disease (9% of PANCE)
  infectiousDisease: [
    'Penicillins: Amoxicillin, amoxicillin-clavulanate, ampicillin, ampicillin-sulbactam, piperacillin-tazobactam, penicillin G, penicillin VK, nafcillin, oxacillin, dicloxacillin',
    'Cephalosporins: 1st (cephalexin, cefazolin), 2nd (cefuroxime, cefaclor), 3rd (ceftriaxone, cefotaxime, ceftazidime, cefdinir, cefpodoxime), 4th (cefepime), 5th (ceftaroline)',
    'Carbapenems/Monobactams: Meropenem, imipenem-cilastatin, ertapenem, aztreonam',
    'Fluoroquinolones: Ciprofloxacin, levofloxacin, moxifloxacin',
    'Macrolides: Azithromycin, clarithromycin, erythromycin',
    'Tetracyclines: Doxycycline, minocycline, tetracycline, tigecycline',
    'Other Antibiotics: Trimethoprim-sulfamethoxazole, nitrofurantoin, fosfomycin, metronidazole, clindamycin, vancomycin, linezolid, daptomycin, gentamicin, tobramycin',
    'Antifungals: Fluconazole, itraconazole, voriconazole, posaconazole, isavuconazole, amphotericin B, micafungin, caspofungin, anidulafungin, terbinafine, nystatin, griseofulvin',
    'Antivirals: Oseltamivir, baloxavir, acyclovir, valacyclovir, famciclovir, ganciclovir, valganciclovir',
    'HIV: NRTIs (tenofovir, emtricitabine, abacavir, lamivudine), NNRTIs (efavirenz, rilpivirine, doravirine), protease inhibitors (darunavir, atazanavir), integrase inhibitors (dolutegravir, bictegravir, raltegravir)',
    'Parasitic: Ivermectin, albendazole, mebendazole, praziquantel, metronidazole, nitazoxanide, pyrimethamine, atovaquone, primaquine, chloroquine, hydroxychloroquine, mefloquine, permethrin',
  ],

  // Dermatology (5% of PANCE)
  dermatology: [
    'Topical Corticosteroids: Low (hydrocortisone), medium (triamcinolone), high (fluocinonide, betamethasone), super high (clobetasol)',
    'Acne: Benzoyl peroxide, topical retinoids (tretinoin, adapalene, tazarotene), topical antibiotics (clindamycin, erythromycin), oral antibiotics (doxycycline, minocycline), isotretinoin, spironolactone',
    'Psoriasis: Topical vitamin D (calcipotriene), topical retinoids (tazarotene), methotrexate, cyclosporine, apremilast, biologics (secukinumab, ixekizumab, guselkumab, risankizumab, upadacitinib)',
    'Eczema/Dermatitis: Topical calcineurin inhibitors (tacrolimus, pimecrolimus), dupilumab, ruxolitinib topical',
    'Infections: Mupirocin, retapamulin, topical antifungals (clotrimazole, ketoconazole, terbinafine, ciclopirox), oral antifungals',
    'Rosacea: Metronidazole topical, azelaic acid, ivermectin topical, brimonidine, oxymetazoline',
  ],

  // Renal/Genitourinary (6% of PANCE)
  renal: [
    'Diuretics: Loop (furosemide, bumetanide, torsemide), thiazide (hydrochlorothiazide, chlorthalidone, metolazone), potassium-sparing (spironolactone, eplerenone, amiloride, triamterene), carbonic anhydrase inhibitors (acetazolamide)',
    'UTI: Nitrofurantoin, trimethoprim-sulfamethoxazole, fosfomycin, ciprofloxacin, cephalosporins',
    'BPH: Alpha blockers (tamsulosin, alfuzosin, silodosin, terazosin, doxazosin), 5-alpha reductase inhibitors (finasteride, dutasteride), tadalafil',
    'Erectile Dysfunction: PDE5 inhibitors (sildenafil, tadalafil, vardenafil, avanafil), alprostadil',
    'Overactive Bladder: Antimuscarinics (oxybutynin, tolterodine, solifenacin, darifenacin, fesoterodine, trospium), beta-3 agonist (mirabegron, vibegron)',
    'CKD Management: Phosphate binders, erythropoiesis-stimulating agents (epoetin, darbepoetin), vitamin D analogs (calcitriol, paricalcitol), sodium bicarbonate',
    'Kidney Stones: Tamsulosin, potassium citrate, thiazides, allopurinol',
  ],

  // EENT (9% of PANCE)
  eent: [
    'Glaucoma: Prostaglandin analogs (latanoprost, bimatoprost, travoprost), beta blockers (timolol, betaxolol), alpha agonists (brimonidine, apraclonidine), carbonic anhydrase inhibitors (dorzolamide, brinzolamide), rho kinase inhibitors (netarsudil)',
    'Allergic Conjunctivitis: Antihistamine drops (ketotifen, olopatadine, azelastine), mast cell stabilizers',
    'Infectious Conjunctivitis: Erythromycin ophthalmic, ciprofloxacin ophthalmic, moxifloxacin ophthalmic, tobramycin ophthalmic',
    'Dry Eye: Cyclosporine ophthalmic, lifitegrast, artificial tears',
    'Otitis: Amoxicillin, amoxicillin-clavulanate, otic fluoroquinolones (ofloxacin, ciprofloxacin), otic corticosteroids',
    'Sinusitis: Intranasal corticosteroids, saline irrigation, amoxicillin, amoxicillin-clavulanate, doxycycline',
    'Vertigo/Vestibular: Meclizine, dimenhydrinate, scopolamine, promethazine, ondansetron, betahistine',
  ],

  // Hematology/Oncology (5% of PANCE)
  hematology: [
    'Anemia: Iron supplements (ferrous sulfate, ferrous gluconate, iron sucrose, ferric carboxymaltose), vitamin B12, folate, erythropoietin',
    'Anticoagulation Management: Warfarin monitoring, DOAC selection, bridging therapy, reversal agents',
    'Antiplatelet Therapy: Aspirin, clopidogrel, ticagrelor, prasugrel, dipyridamole, cilostazol',
    'Thrombocytopenia: Eltrombopag, romiplostim, avatrombopag, fostamatinib',
    'Neutropenia: G-CSF (filgrastim, pegfilgrastim)',
    'Sickle Cell: Hydroxyurea, voxelotor, crizanlizumab, L-glutamine',
    'VTE Prophylaxis: LMWH (enoxaparin, dalteparin), fondaparinux, mechanical prophylaxis',
  ],

  // Reproductive/OB-GYN (8% of PANCE)
  reproductive: [
    'Contraception: Combined hormonal (ethinyl estradiol + various progestins), progestin-only (norethindrone, desogestrel), IUDs (levonorgestrel, copper), implants (etonogestrel), injections (medroxyprogesterone), emergency (levonorgestrel, ulipristal)',
    'Hormone Therapy: Estrogen (conjugated estrogens, estradiol), progestins (medroxyprogesterone, norethindrone, progesterone), testosterone',
    'Menstrual Disorders: Tranexamic acid, NSAIDs, hormonal therapy, GnRH agonists (leuprolide, goserelin), GnRH antagonists (elagolix)',
    'Infertility: Clomiphene, letrozole, gonadotropins (FSH, hCG)',
    'STIs: Ceftriaxone, azithromycin, doxycycline, metronidazole, penicillin G for syphilis, antiretrovirals',
    'Pregnancy: Prenatal vitamins, folic acid, antiemetics, tocolytics (nifedipine, indomethacin, magnesium sulfate), corticosteroids for fetal lung maturity (betamethasone, dexamethasone), oxytocin, misoprostol, methylergonovine',
    'Postpartum: Methylergonovine, oxytocin, carboprost, misoprostol for hemorrhage',
  ],

  // Emergency/Toxicology (3% of PANCE)
  emergency: [
    'ACLS Drugs: Epinephrine, amiodarone, lidocaine, atropine, vasopressin, calcium, sodium bicarbonate, magnesium',
    'Antidotes: Naloxone (opioids), flumazenil (benzodiazepines), N-acetylcysteine (acetaminophen), fomepizole (methanol/ethylene glycol), hydroxocobalamin (cyanide), digoxin immune fab, calcium gluconate (calcium channel blockers/HF), glucagon (beta blockers), pralidoxime (organophosphates), deferoxamine (iron), succimer (lead), physostigmine (anticholinergic)',
    'Anaphylaxis: Epinephrine, antihistamines (diphenhydramine, cetirizine), corticosteroids, bronchodilators',
    'Sedation/Analgesia: Ketamine, propofol, etomidate, midazolam, fentanyl, morphine',
    'Local Anesthetics: Lidocaine, bupivacaine, epinephrine for vasoconstriction',
    'Rapid Sequence Intubation: Succinylcholine, rocuronium, etomidate, propofol, ketamine',
  ],

  // Pediatric-Specific (varies)
  pediatric: [
    'Pediatric Antibiotics: Amoxicillin (preferred for AOM, strep pharyngitis), azithromycin, cephalosporins, weight-based dosing',
    'Pediatric Vaccines: DTaP, IPV, MMR, varicella, Hib, PCV13, rotavirus, hepatitis A/B, HPV, meningococcal, influenza',
    'Pediatric Asthma: SABA rescue, ICS controllers, montelukast',
    'Pediatric ADHD: Methylphenidate formulations, amphetamines, atomoxetine, guanfacine',
    'Pediatric Fever/Pain: Acetaminophen, ibuprofen (NOT aspirin due to Reye syndrome)',
    'Neonatal: Erythromycin eye prophylaxis, vitamin K, hepatitis B vaccine, surfactant, caffeine citrate',
  ],

  // Geriatric-Specific (varies)
  geriatric: [
    'Beers Criteria High-Risk Drugs: Avoid/minimize anticholinergics, benzodiazepines, certain antipsychotics, NSAIDs long-term, sliding scale insulin',
    'Fall Prevention: Review of diuretics, antihypertensives, sedatives, antidepressants',
    'Polypharmacy Management: Deprescribing strategies, drug-drug interactions',
    'Dementia Medications: Cholinesterase inhibitors, memantine, avoiding deliriogenic drugs',
    'Pain in Elderly: Prefer acetaminophen, topical NSAIDs, caution with opioids',
  ],
};

async function discoverMissingPANCEDrugs(
  existingDrugs: string[],
  dryRun: boolean
): Promise<number> {
  console.log('\n' + '═'.repeat(70));
  console.log('🔬 PHASE 5: ENHANCED PANCE DRUG GAP DISCOVERY');
  console.log('═'.repeat(70));
  console.log(`   📊 Existing database: ${existingDrugs.length} drugs`);
  console.log(
    `   📋 Analyzing ${Object.keys(PANCE_BLUEPRINT_CATEGORIES).length} PANCE blueprint categories`
  );
  console.log(`   🔍 Multiple subcategories per system for thorough coverage\n`);

  let totalAdded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Create normalized set for faster lookup
  const normalizedExisting = new Set(existingDrugs.map((d) => d.toLowerCase().trim()));

  // Process each main category
  for (const [systemName, subcategories] of Object.entries(PANCE_BLUEPRINT_CATEGORIES)) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🏥 SYSTEM: ${systemName.toUpperCase()}`);
    console.log(`${'─'.repeat(60)}`);

    for (const subcategory of subcategories) {
      console.log(`\n   📋 Subcategory: ${subcategory.slice(0, 60)}...`);

      // Build context of what we already have in this category
      const prompt = `You are a PANCE pharmacology expert. Your task is to identify ESSENTIAL drugs that PA students MUST know for the PANCE exam.

SYSTEM: ${systemName}
SUBCATEGORY: ${subcategory}

DRUGS ALREADY IN DATABASE (FULL LIST - ${existingDrugs.length} total):
${existingDrugs.join(', ')}

Your task:
1. Analyze the subcategory description above - it lists key drug classes and specific drugs
2. Identify drugs from that description that are NOT in the existing database
3. Also identify any other HIGH-YIELD drugs in this subcategory that every PA student must know

Return ONLY drugs that:
- Are NOT already in the database (check carefully - case insensitive match)
- Are HIGH-YIELD for PANCE (commonly tested, first-line treatments)
- Have a clear clinical indication every PA should know
- Are currently used in clinical practice (not obsolete)

Return JSON array (no markdown, no code blocks):
[
  {
    "genericName": "lowercase generic drug name",
    "brandName": "Common Brand Name",
    "drugClass": "Specific drug class (e.g., 'SGLT2 Inhibitor' not just 'Diabetes medication')",
    "panceYield": 3,
    "reasoning": "Brief PANCE-relevant reason (e.g., 'First-line for HFrEF, commonly tested mechanism')"
  }
]

CRITICAL RULES:
- genericName MUST be lowercase (e.g., "metformin" not "Metformin")
- panceYield: 1=mentioned, 2=important, 3=essential/high-yield
- Return EMPTY ARRAY [] if all important drugs in this subcategory already exist
- Do NOT return drugs that are already in the existing list (even slight variations)
- Maximum 5 drugs per subcategory to ensure quality over quantity`;

      try {
        await tokenBucket.acquire();
        const result = await model.generateContent(prompt);
        const text = result.response
          .text()
          .replace(/```json\n?|```/g, '')
          .trim();

        let suggestions: MissingDrugSuggestion[];
        try {
          suggestions = JSON.parse(text);
        } catch {
          console.log(`      ⚠️ Invalid JSON response, skipping`);
          continue;
        }

        if (!Array.isArray(suggestions) || suggestions.length === 0) {
          console.log(`      ✓ Complete - no gaps found`);
          continue;
        }

        console.log(`      🆕 Found ${suggestions.length} potential additions`);

        for (const suggestion of suggestions) {
          // Skip if no valid generic name
          if (!suggestion.genericName || suggestion.genericName.length < 2) {
            continue;
          }

          const normalizedGeneric = suggestion.genericName.toLowerCase().trim();
          const normalizedBrand = suggestion.brandName?.toLowerCase().trim() || '';

          // Check if drug already exists (multiple variations)
          if (
            normalizedExisting.has(normalizedGeneric) ||
            normalizedExisting.has(normalizedBrand) ||
            normalizedExisting.has(normalizedGeneric.replace(/-/g, '')) ||
            normalizedExisting.has(normalizedGeneric.replace(/ /g, '-'))
          ) {
            console.log(`         ⏭️ ${suggestion.genericName} - already exists`);
            totalSkipped++;
            continue;
          }

          // Additional database check (catches case variations)
          const existsInDb = await prisma.drug.findFirst({
            where: {
              OR: [
                { genericName: { equals: suggestion.genericName, mode: 'insensitive' } },
                { genericName: { equals: suggestion.brandName, mode: 'insensitive' } },
                { brandName: { equals: suggestion.brandName, mode: 'insensitive' } },
                { brandName: { equals: suggestion.genericName, mode: 'insensitive' } },
              ],
            },
          });

          if (existsInDb) {
            console.log(`         ⏭️ ${suggestion.genericName} - found in DB`);
            totalSkipped++;
            // Add to our local set to avoid future duplicates
            normalizedExisting.add(normalizedGeneric);
            continue;
          }

          console.log(
            `         🆕 ${suggestion.genericName} (${suggestion.brandName || 'no brand'}) [Yield: ${suggestion.panceYield}]`
          );
          console.log(`            → ${suggestion.reasoning}`);

          if (!dryRun) {
            try {
              // Generate full content for the new drug
              const fullContent = await generateDrugContent(suggestion.genericName);

              if (fullContent && fullContent.isValid !== false) {
                const sanitized = sanitizeAndFormat(fullContent, suggestion.genericName);

                await prisma.drug.create({
                  data: {
                    id: uuidv4(),
                    genericName: sanitized.genericName,
                    brandName: sanitized.brandName || suggestion.brandName || null,
                    displayName: sanitized.displayName,
                    drugClass: sanitized.drugClass || [suggestion.drugClass],
                    mechanismOfAction: sanitized.mechanismOfAction,
                    indications: sanitized.indications,
                    contraindications: sanitized.contraindications,
                    sideEffects: sanitized.sideEffects,
                    dosing: sanitized.dosing,
                    aliases: sanitized.aliases,
                    tags: sanitized.tags,
                    isHighYield: suggestion.panceYield >= 2,
                    panceYield: suggestion.panceYield,
                    isFirstLine: sanitized.isFirstLine,
                    genericAvailable: sanitized.genericAvailable,
                    insuranceTier: sanitized.insuranceTier,
                    clinicalNotes: sanitized.clinicalNotes,
                    clinicalPearls: sanitized.clinicalPearls,
                    boardYieldFacts: sanitized.boardYieldFacts,
                    testQuestionTips: sanitized.testQuestionTips,
                    commonMistakes: sanitized.commonMistakes,
                    mnemonics: sanitized.mnemonics,
                    monitoringParams: sanitized.monitoringParams,
                    blackBoxWarnings: sanitized.blackBoxWarnings,
                    riskStrategies: sanitized.riskStrategies,
                    pregnancyCategory: sanitized.pregnancyCategory,
                    pregnancyNotes: sanitized.pregnancyNotes,
                    lactationSafety: sanitized.lactationSafety,
                    lactationNotes: sanitized.lactationNotes,
                    pediatricDosing: sanitized.pediatricDosing,
                    pediatricNotes: sanitized.pediatricNotes,
                    geriatricDosing: sanitized.geriatricDosing,
                    geriatricNotes: sanitized.geriatricNotes,
                    renalDosing: sanitized.renalDosing,
                    hepaticDosing: sanitized.hepaticDosing,
                    absorption: sanitized.absorption,
                    distribution: sanitized.distribution,
                    metabolism: sanitized.metabolism,
                    metabolismDetail: sanitized.metabolismDetail,
                    elimination: sanitized.elimination,
                    eliminationRoute: sanitized.eliminationRoute,
                    halfLife: sanitized.halfLife,
                    onsetOfAction: sanitized.onsetOfAction,
                    peakEffect: sanitized.peakEffect,
                    duration: sanitized.duration,
                    bioavailability: sanitized.bioavailability,
                    pharmacokinetics: sanitized.pharmacokinetics,
                    cyp450Effects: sanitized.cyp450Effects,
                    majorInteractions: sanitized.majorInteractions,
                    interactions: sanitized.interactions,
                    foodInteractions: sanitized.foodInteractions,
                    routesOfAdmin: sanitized.routesOfAdmin,
                    formulations: sanitized.formulations,
                    administrationTips: sanitized.administrationTips,
                    storageRequirements: sanitized.storageRequirements,
                    reversalAgent: sanitized.reversalAgent,
                    antidote: sanitized.antidote,
                    toxicity: sanitized.toxicity,
                    maxDailyDose: sanitized.maxDailyDose,
                    typicalCost: sanitized.typicalCost,
                  } as any,
                });

                totalAdded++;
                normalizedExisting.add(normalizedGeneric); // Prevent duplicates in same run
                console.log(`            ✅ Created successfully`);
              } else {
                console.log(`            ⚠️ AI could not generate valid content`);
                totalErrors++;
              }
            } catch (e: any) {
              if (e.code === 'P2002') {
                console.log(`            ⏭️ Duplicate detected during creation, skipping`);
                normalizedExisting.add(normalizedGeneric);
                totalSkipped++;
              } else {
                console.log(`            ❌ Error: ${e.message}`);
                totalErrors++;
              }
            }
          }
        }
      } catch (err: any) {
        console.log(`      ❌ API error: ${err.message}`);
        if (err.message?.includes('429') || err.message?.includes('quota')) {
          console.log('      ⏳ Rate limited, waiting 30 seconds...');
          await new Promise((r) => setTimeout(r, 30000));
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 PANCE DRUG DISCOVERY SUMMARY`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`   ✅ New drugs added: ${totalAdded}`);
  console.log(`   ⏭️  Already existed: ${totalSkipped}`);
  console.log(`   ❌ Errors: ${totalErrors}`);
  console.log(`   📊 Final database size: ${existingDrugs.length + totalAdded} drugs`);

  return totalAdded;
}

// ==================== Main ====================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const analyzeOnly = args.includes('--analyze-only');
  const skipDedup = args.includes('--skip-dedup');
  const skipEnhance = args.includes('--skip-enhance');
  const skipCleanup = args.includes('--skip-cleanup');
  const skipDiscovery = args.includes('--skip-discovery');
  const discoveryOnly = args.includes('--discovery-only');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '', 10) : undefined;
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1] ?? '50', 10) || 50 : 50;

  console.log('\n' + '═'.repeat(70));
  console.log('🩺 DRUG DOCTOR ENHANCED v3');
  console.log('═'.repeat(70));
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Analyze Only: ${analyzeOnly}`);
  console.log(`   Discovery Only: ${discoveryOnly}`);
  console.log(`   Skip Cleanup: ${skipCleanup || discoveryOnly}`);
  console.log(`   Skip Dedup: ${skipDedup || discoveryOnly}`);
  console.log(`   Skip Enhance: ${skipEnhance || discoveryOnly}`);
  console.log(`   Skip Discovery: ${skipDiscovery}`);
  console.log(`   Limit: ${limit || 'none'}`);
  console.log(`   Batch Size: ${batchSize}`);

  try {
    // If discovery-only, skip directly to Phase 5
    if (discoveryOnly) {
      console.log('\n🚀 Discovery-only mode - skipping to Phase 5');

      // Get existing drug names for comparison
      const existingDrugs: string[] = [];
      let discoveryCursor: string | undefined;

      while (true) {
        const batch = await prisma.drug.findMany({
          take: BATCH_SIZE,
          skip: discoveryCursor ? 1 : 0,
          cursor: discoveryCursor ? { id: discoveryCursor } : undefined,
          orderBy: { id: 'asc' },
          select: { id: true, genericName: true },
        });
        if (batch.length === 0) break;
        existingDrugs.push(...batch.map((d) => d.genericName));
        const lastBatch = batch[batch.length - 1];
        discoveryCursor = lastBatch?.id;
      }

      await discoverMissingPANCEDrugs(existingDrugs, dryRun);

      console.log('\n' + '═'.repeat(70));
      console.log('✅ DRUG DOCTOR ENHANCED v3 - DISCOVERY COMPLETE');
      console.log('═'.repeat(70) + '\n');
      return;
    }

    // Phase 1: Gap Analysis
    const gapReports = await runGapAnalysis();

    // Phase 1B: Non-Pharm Cleanup (AI validates suspicious entries)
    if (!skipCleanup) {
      await cleanupNonPharmEntries(dryRun);
    }

    // Phase 2: Fuzzy Duplicate Detection with AI Verification
    if (!skipDedup) {
      const duplicates = await findFuzzyDuplicates(0.8, true); // Lower threshold, AI verification

      if (duplicates.length > 0 && !analyzeOnly) {
        console.log('\n🔄 Merging verified duplicate groups...');
        let totalMerged = 0;
        for (const group of duplicates) {
          totalMerged += await mergeDuplicateGroup(group, dryRun);
        }
        console.log(`   Total duplicates merged: ${totalMerged}`);
      }
    }

    if (analyzeOnly) {
      console.log('\n📋 Analysis complete. Use without --analyze-only to apply changes.');
      return;
    }

    // Phase 3: Content Enhancement
    if (!skipEnhance) {
      await enhanceDrugs({ limit, dryRun, batchSize, gapReports });
    }

    // Phase 4: Final Name Formatting
    await formatAllNames(dryRun);

    // Phase 5: PANCE Drug Gap Discovery
    if (!skipDiscovery) {
      // Get existing drug names for comparison
      const existingDrugs: string[] = [];
      let discoveryCursor: string | undefined;

      while (true) {
        const batch = await prisma.drug.findMany({
          take: BATCH_SIZE,
          skip: discoveryCursor ? 1 : 0,
          cursor: discoveryCursor ? { id: discoveryCursor } : undefined,
          orderBy: { id: 'asc' },
          select: { id: true, genericName: true },
        });
        if (batch.length === 0) break;
        existingDrugs.push(...batch.map((d) => d.genericName));
        const lastBatch = batch[batch.length - 1];
        discoveryCursor = lastBatch?.id;
      }

      await discoverMissingPANCEDrugs(existingDrugs, dryRun);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ DRUG DOCTOR ENHANCED v3 - COMPLETE');
    console.log('═'.repeat(70) + '\n');
  } catch (err) {
    console.error('\n❌ Fatal error:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main();
