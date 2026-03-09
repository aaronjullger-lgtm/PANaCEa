#!/usr/bin/env npx tsx
/**
 * Enhancement Engine for Data Quality
 *
 * Uses PDF library and DeepSeek API to improve inadequate fields identified by the quality audit.
 * Processes records from MedicalContent, Drug, and other tables.
 */

import { prisma, disconnect } from '../_shared/db';
import { findPdfsForTerm, pickBestCandidate } from '../library-enrichment/file-discovery';
import { extractTextFromPdf, findKeywordContext } from '../library-enrichment/pdf-extraction';
import { extractMissingField } from '../library-enrichment/deepseek-extract';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Record representing an entity with inadequate fields.
 */
interface InadequateFieldRecord {
  entityType: 'Condition' | 'Drug' | 'Procedure' | 'AnatomyStructure' | 'Other';
  id: string;
  name: string;
  system?: string;
  panceYield: number | null;
  inadequateFields: Array<{
    field: string;
    value: any;
    reason: string;
  }>;
  existingValues: Record<string, any>;
}

/**
 * Log entry for each enhancement attempt.
 */
interface EnhancementLogEntry {
  timestamp: string;
  entityType: 'Condition' | 'Drug' | 'Procedure' | 'AnatomyStructure' | 'Other';
  entityId: string;
  entityName: string;
  field: string;
  reason: string;
  status: 'success' | 'failure' | 'skipped';
  pdfPath?: string;
  contextLength?: number;
  extractedValue?: any;
  existingValue?: any;
  conflictDetected?: boolean;
  similarityScore?: number;
  error?: string;
  rawResponse?: string;
}

const LOG_FILE = resolve(process.cwd(), 'data/quality-enhancement-log.json');

function loadLog(): EnhancementLogEntry[] {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const content = readFileSync(LOG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function appendLog(entry: EnhancementLogEntry) {
  const logs = loadLog();
  logs.push(entry);
  writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

/**
 * Compute similarity between two strings (0-1).
 * Simple Jaccard-like similarity using bigrams.
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const aWords = a.toLowerCase().split(/\s+/);
  const bWords = b.toLowerCase().split(/\s+/);
  const intersection = aWords.filter(w => bWords.includes(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Determine if extracted value conflicts with existing value.
 */
function detectConflict(
  field: string,
  extracted: any,
  existing: any
): { conflictDetected: boolean; similarityScore?: number } {
  if (existing === null || existing === undefined || existing === '') {
    return { conflictDetected: false };
  }
  if (typeof extracted === 'string' && typeof existing === 'string') {
    const similarity = stringSimilarity(extracted, existing);
    // If similarity > 0.7, consider them not conflicting
    return { conflictDetected: similarity < 0.7, similarityScore: similarity };
  }
  // For arrays, compare as strings for simplicity
  if (Array.isArray(extracted) && Array.isArray(existing)) {
    const extractedStr = JSON.stringify(extracted);
    const existingStr = JSON.stringify(existing);
    const similarity = stringSimilarity(extractedStr, existingStr);
    return { conflictDetected: similarity < 0.7, similarityScore: similarity };
  }
  // For other types, assume conflict if not equal
  return { conflictDetected: JSON.stringify(extracted) !== JSON.stringify(existing) };
}

/**
 * Field‑specific keywords for context extraction.
 */
const fieldKeywords: Record<string, string[]> = {
  // MedicalContent fields
  overview: ['overview', 'definition'],
  gold_standard_dx: ['gold standard', 'diagnosis', 'test'],
  first_line_rx: ['first-line', 'treatment', 'therapy'],
  best_initial_test: ['initial test', 'diagnostic'],
  complications: ['complications', 'adverse'],
  diagnostics: ['diagnostics', 'diagnosis', 'test'],
  differentialDiagnosis: ['differential', 'differential diagnosis'],
  epidemiology: ['epidemiology', 'incidence', 'prevalence'],
  etiology: ['etiology', 'cause'],
  pathophysiology: ['pathophysiology', 'mechanism'],
  physicalExam: ['physical exam', 'examination'],
  prognosis: ['prognosis', 'outcome'],
  riskFactors: ['risk factors'],
  symptoms: ['symptoms', 'presentation'],
  treatment: ['treatment', 'management'],
  classic_triad: ['classic triad', 'triad'],
  clinical_pearls: ['clinical pearl', 'pearl'],
  age_demographic: ['age', 'demographic'],
  classic_patient: ['classic patient', 'presentation'],
  differentials: ['differential', 'differentials'],
  disposition: ['disposition', 'discharge'],
  gender_bias: ['gender', 'bias'],
  guidelines: ['guidelines', 'recommendation'],
  image_query: ['image', 'imaging'],
  mnemonic: ['mnemonic'],
  patient_education: ['patient education'],
  prevention: ['prevention'],
  synonyms: ['synonyms', 'also known as'],
  // Drug fields
  mechanismOfAction: ['mechanism', 'action', 'works by'],
  dosing: ['dose', 'dosing', 'administration'],
  brandName: ['brand', 'trade name', 'proprietary'],
  sideEffects: ['side effect', 'adverse'],
  indications: ['indication', 'used for'],
  contraindications: ['contraindication', 'avoid'],
  drugClass: ['drug class', 'class'],
  clinicalNotes: ['clinical notes'],
  elimination: ['elimination'],
  metabolism: ['metabolism'],
  absorption: ['absorption'],
  administrationTips: ['administration tips'],
  bioavailability: ['bioavailability'],
  blackBoxWarnings: ['black box', 'warning'],
  boardYieldFacts: ['board yield', 'yield'],
  clinicalPearls: ['clinical pearl'],
  commonMistakes: ['common mistake'],
  cyp450Effects: ['CYP450', 'cytochrome'],
  distribution: ['distribution'],
  duration: ['duration'],
  eliminationRoute: ['elimination route'],
  foodInteractions: ['food interaction'],
  formulations: ['formulation'],
  genericAvailable: ['generic'],
  geriatricDosing: ['geriatric', 'elderly'],
  geriatricNotes: ['geriatric notes'],
  halfLife: ['half-life'],
  hepaticDosing: ['hepatic', 'liver'],
  insuranceTier: ['insurance tier'],
  isFirstLine: ['first-line'],
  lactationNotes: ['lactation'],
  lactationSafety: ['lactation safety'],
  majorInteractions: ['drug interaction'],
  maxDailyDose: ['maximum daily dose'],
  mechanismDetailed: ['detailed mechanism'],
  metabolismDetail: ['metabolism detail'],
  mnemonics: ['mnemonic'],
  monitoringParams: ['monitoring'],
  onsetOfAction: ['onset'],
  peakEffect: ['peak effect'],
  pediatricDosing: ['pediatric', 'child'],
  pediatricNotes: ['pediatric notes'],
  pharmacokinetics: ['pharmacokinetics'],
  pregnancyCategory: ['pregnancy category'],
  pregnancyNotes: ['pregnancy notes'],
  renalDosing: ['renal', 'kidney'],
  reversalAgent: ['reversal agent'],
  riskStrategies: ['risk strategy'],
  routesOfAdmin: ['route of administration'],
  storageRequirements: ['storage'],
  testQuestionTips: ['test question'],
  toxicity: ['toxicity'],
  typicalCost: ['cost'],
  // Generic fallback
  default: ['information', 'details'],
};

/**
 * Enhance a single inadequate field for a given record.
 */
export async function enhanceInadequateField(
  record: InadequateFieldRecord,
  inadequateField: { field: string; value: any; reason: string }
): Promise<EnhancementLogEntry> {
  const startTime = new Date().toISOString();
  const logEntry: EnhancementLogEntry = {
    timestamp: startTime,
    entityType: record.entityType,
    entityId: record.id,
    entityName: record.name,
    field: inadequateField.field,
    reason: inadequateField.reason,
    status: 'skipped',
    existingValue: inadequateField.value,
  };

  try {
    // 1. Find relevant PDFs
    console.log(`🔍 Searching PDFs for "${record.name}"...`);
    const system = record.entityType === 'Drug' ? 'DRUG' : record.system;
    const pdfs = await findPdfsForTerm(record.name, 10, system);
    if (pdfs.length === 0) {
      logEntry.status = 'skipped';
      logEntry.error = 'No PDFs found';
      appendLog(logEntry);
      console.log(`   ⏭️ No PDFs found, skipping.`);
      return logEntry;
    }

    // 2. Pick best candidate
    const bestPdf = pickBestCandidate(pdfs, record.name);
    if (!bestPdf) {
      logEntry.status = 'skipped';
      logEntry.error = 'Could not pick a PDF candidate';
      appendLog(logEntry);
      console.log(`   ⏭️ No suitable PDF candidate.`);
      return logEntry;
    }
    logEntry.pdfPath = bestPdf;
    console.log(`   📄 Selected PDF: ${bestPdf}`);

    // 3. Extract context around relevant keywords
    const keywords = [record.name, inadequateField.field];
    const extraKeywords = fieldKeywords[inadequateField.field] || fieldKeywords.default;
    const searchTerms = [...keywords, ...extraKeywords];

    let contextText = '';
    for (const term of searchTerms) {
      const contexts = await findKeywordContext(bestPdf, term, 15); // 15 lines before/after
      if (contexts.length > 0) {
        contextText = contexts.slice(0, 3).join('\n---\n'); // Take up to 3 occurrences
        break;
      }
    }
    if (!contextText) {
      // Fallback: extract first 2000 characters of the PDF
      console.log(`   📝 No keyword matches, extracting general text...`);
      const fullText = await extractTextFromPdf(bestPdf);
      contextText = fullText.substring(0, 2000);
    }
    logEntry.contextLength = contextText.length;
    console.log(`   📖 Context length: ${contextText.length} chars`);

    // 4. Call DeepSeek API
    console.log(`   🧠 Calling DeepSeek for "${inadequateField.field}"...`);
    const extractionResult = await extractMissingField({
      entityType: record.entityType === 'Condition' ? 'Condition' : 'Drug',
      entityName: record.name,
      missingField: inadequateField.field,
      contextText,
      existingValues: record.existingValues,
    });

    if (!extractionResult.success) {
      logEntry.status = 'failure';
      logEntry.error = extractionResult.error;
      logEntry.rawResponse = extractionResult.rawResponse;
      appendLog(logEntry);
      console.log(`   ❌ Extraction failed: ${extractionResult.error}`);
      return logEntry;
    }

    const extractedValue = extractionResult.extractedValue;
    if (extractedValue === null) {
      logEntry.status = 'skipped';
      logEntry.error = 'NOT_FOUND in context';
      appendLog(logEntry);
      console.log(`   ⏭️ Field not found in context.`);
      return logEntry;
    }

    logEntry.extractedValue = extractedValue;
    logEntry.rawResponse = extractionResult.rawResponse;

    // 5. Conflict detection
    const existing = inadequateField.value;
    const { conflictDetected, similarityScore } = detectConflict(inadequateField.field, extractedValue, existing);
    logEntry.conflictDetected = conflictDetected;
    logEntry.similarityScore = similarityScore;

    if (conflictDetected) {
      console.log(`   ⚠️  Conflict detected (similarity ${similarityScore?.toFixed(2)})`);
      // For now, we'll still update because the existing value is inadequate.
    }

    // 6. Update database
    console.log(`   💾 Updating database...`);
    if (record.entityType === 'Condition') {
      // Update MedicalContent
      await prisma.medicalContent.update({
        where: { id: record.id },
        data: { [inadequateField.field]: extractedValue },
      });
    } else if (record.entityType === 'Drug') {
      // Update Drug
      await prisma.drug.update({
        where: { id: record.id },
        data: { [inadequateField.field]: extractedValue },
      });
    } else {
      // Other tables not yet supported
      logEntry.status = 'skipped';
      logEntry.error = 'Unsupported entity type';
      appendLog(logEntry);
      console.log(`   ⏭️ Unsupported entity type.`);
      return logEntry;
    }

    logEntry.status = 'success';
    appendLog(logEntry);
    console.log(`   ✅ Enhancement successful.`);
    return logEntry;
  } catch (error: any) {
    logEntry.status = 'failure';
    logEntry.error = error.message || String(error);
    appendLog(logEntry);
    console.log(`   ❌ Unexpected error: ${error.message}`);
    return logEntry;
  }
}

/**
 * Enhance all inadequate fields for a given record (process each field sequentially).
 */
export async function enhanceRecord(record: InadequateFieldRecord): Promise<EnhancementLogEntry[]> {
  const logs: EnhancementLogEntry[] = [];
  for (const field of record.inadequateFields) {
    console.log(`\n🎯 Enhancing ${record.entityType} "${record.name}" - ${field.field} (reason: ${field.reason})`);
    const log = await enhanceInadequateField(record, field);
    logs.push(log);
    // Rate limiting: wait a bit between fields to avoid API rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return logs;
}

/**
 * Load priority list from quality audit output and process a subset.
 * Usage: npx tsx scripts/data-quality/enhancement-engine.ts --input ./data/quality-priority.json --limit 5
 */
async function main() {
  const args = process.argv.slice(2);
  const inputArg = args.find(arg => arg.startsWith('--input='));
  const inputPath = inputArg ? inputArg.split('=')[1] : './data/quality-priority.json';
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  if (!existsSync(inputPath)) {
    console.error(`❌ Priority list not found at ${inputPath}. Run audit script first.`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const records: InadequateFieldRecord[] = data.records || [];
  if (records.length === 0) {
    console.log('No records to enhance.');
    return;
  }

  console.log(`🧠 Starting enhancement of up to ${limit} records...`);
  let processed = 0;
  for (const record of records) {
    if (processed >= limit) break;
    console.log(`\n--- Processing ${record.entityType} "${record.name}" (${record.inadequateFields.length} inadequate fields) ---`);
    const logs = await enhanceRecord(record);
    processed++;
    // Wait between records to avoid overwhelming API
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n✅ Enhancement batch complete. ${processed} records processed.`);
  console.log(`   Logs saved to ${LOG_FILE}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch(console.error)
    .finally(() => disconnect());
}