#!/usr/bin/env npx tsx

/**
 * Enrichment Engine for Targeted RAG
 *
 * Orchestrates file discovery, PDF extraction, DeepSeek API call, and database update.
 */

import { prisma, disconnect } from '../_shared/db';
import { findPdfsForTerm, pickBestCandidate } from './file-discovery';
import { extractTextFromPdf, findKeywordContext } from './pdf-extraction';
import { extractMissingField } from './deepseek-extract';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface MissingFieldRecord {
  entityType: 'Condition' | 'Drug';
  id: string;
  name: string;
  system?: string;
  panceYield: number | null;
  missingFields: string[];
  existingValues: Record<string, any>;
}

interface EnrichmentLogEntry {
  timestamp: string;
  entityType: 'Condition' | 'Drug';
  entityId: string;
  entityName: string;
  missingField: string;
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

const LOG_FILE = resolve(process.cwd(), 'data/library-enrichment-log.json');

function loadLog(): EnrichmentLogEntry[] {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const content = readFileSync(LOG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function appendLog(entry: EnrichmentLogEntry) {
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
 * Enrich a single missing field for a given record.
 */
export async function enrichMissingField(
  record: MissingFieldRecord,
  missingField: string
): Promise<EnrichmentLogEntry> {
  const startTime = new Date().toISOString();
  const logEntry: EnrichmentLogEntry = {
    timestamp: startTime,
    entityType: record.entityType,
    entityId: record.id,
    entityName: record.name,
    missingField,
    status: 'skipped',
    existingValue: record.existingValues[missingField],
  };

  try {
    // 1. Find relevant PDFs
    console.log(`🔍 Searching PDFs for "${record.name}"...`);
    const pdfs = await findPdfsForTerm(record.name, 10, record.system);
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
    const keywords = [record.name, missingField];
    // For field-specific keywords, add synonyms
    const fieldKeywords: Record<string, string[]> = {
      gold_standard_dx: ['gold standard', 'diagnosis', 'test'],
      first_line_rx: ['first-line', 'treatment', 'therapy'],
      best_initial_test: ['initial test', 'diagnostic'],
      overview: ['overview', 'definition'],
      mechanismOfAction: ['mechanism', 'action', 'works by'],
      dosing: ['dose', 'dosing', 'administration'],
      brandName: ['brand', 'trade name', 'proprietary'],
      sideEffects: ['side effect', 'adverse'],
      indications: ['indication', 'used for'],
    };
    const extraKeywords = fieldKeywords[missingField] || [];
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
    console.log(`   🧠 Calling DeepSeek for "${missingField}"...`);
    const extractionResult = await extractMissingField({
      entityType: record.entityType,
      entityName: record.name,
      missingField,
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
    const existing = record.existingValues[missingField];
    const { conflictDetected, similarityScore } = detectConflict(missingField, extractedValue, existing);
    logEntry.conflictDetected = conflictDetected;
    logEntry.similarityScore = similarityScore;

    if (conflictDetected) {
      console.log(`   ⚠️  Conflict detected (similarity ${similarityScore?.toFixed(2)})`);
      // For now, we'll still update but log the conflict.
      // In future, could prompt for manual review.
    }

    // 6. Update database
    console.log(`   💾 Updating database...`);
    if (record.entityType === 'Condition') {
      // Update MedicalContent
      await prisma.medicalContent.update({
        where: { conditionId: record.id },
        data: { [missingField]: extractedValue },
      });
    } else {
      // Update Drug
      await prisma.drug.update({
        where: { id: record.id },
        data: { [missingField]: extractedValue },
      });
    }

    logEntry.status = 'success';
    appendLog(logEntry);
    console.log(`   ✅ Enrichment successful.`);
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
 * Enrich all missing fields for a given record (process each missing field sequentially).
 */
export async function enrichRecord(record: MissingFieldRecord): Promise<EnrichmentLogEntry[]> {
  const logs: EnrichmentLogEntry[] = [];
  for (const field of record.missingFields) {
    console.log(`\n🎯 Enriching ${record.entityType} "${record.name}" - ${field}`);
    const log = await enrichMissingField(record, field);
    logs.push(log);
    // Rate limiting: wait a bit between fields to avoid API rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return logs;
}

/**
 * Test function: enrich the first record from the priority list.
 */
async function test() {
  const priorityPath = resolve(process.cwd(), 'data/library-enrichment-priority.json');
  if (!existsSync(priorityPath)) {
    console.error('Priority list not found. Run audit script first.');
    return;
  }
  const data = JSON.parse(readFileSync(priorityPath, 'utf-8'));
  const records = data.priorityList as MissingFieldRecord[];
  if (records.length === 0) {
    console.log('No records to enrich.');
    return;
  }
  const firstRecord = records[0];
  console.log(`Testing enrichment on: ${firstRecord.name}`);
  const logs = await enrichRecord(firstRecord);
  console.log('Test complete. Logs:', logs);
}

if (process.argv[1] === import.meta.url) {
  test()
    .catch(console.error)
    .finally(() => disconnect());
}