#!/usr/bin/env npx tsx
/**
 * File Discovery for Library Enrichment
 *
 * Searches the local Google Drive sync folder for PDFs matching a condition/drug name.
 * Uses `find` command for fast filename‑based search (no content scanning).
 *
 * Usage:
 *   import { findPdfsForTerm } from './file-discovery';
 *   const pdfs = await findPdfsForTerm('Urinary Retention');
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

/**
 * Root path of the medical library (Google Drive sync).
 * Defaults to the user's Google Drive folder; can be overridden via env MEDICAL_LIBRARY_PATH.
 */
const LIBRARY_ROOT =
  process.env.MEDICAL_LIBRARY_PATH ||
  '/Users/aaronullger/Library/CloudStorage/GoogleDrive-aaronjullger@gmail.com';

/**
 * Mapping from system codes to search keywords for fallback PDF discovery.
 */
const SYSTEM_KEYWORDS: Record<string, string[]> = {
  CV: ['Cardiovascular', 'Cardio', 'Heart', 'Vascular'],
  PULM: ['Pulmonary', 'Respiratory', 'Lung'],
  GI: ['Gastrointestinal', 'GI', 'Digestive', 'Liver'],
  MSK: ['Musculoskeletal', 'Orthopedic', 'Bone', 'Joint'],
  GU: ['Genitourinary', 'Renal', 'Urinary', 'Kidney', 'GU'],
  ENDO: ['Endocrine', 'Thyroid', 'Diabetes', 'Hormone'],
  HEME: ['Hematology', 'Blood', 'Anemia', 'Coagulation'],
  ID: ['Infectious', 'Infection', 'Microbiology', 'Antibiotic'],
  NEURO: ['Neurology', 'Neuro', 'Brain', 'Spinal'],
  PSYCH: ['Psychiatry', 'Mental', 'Behavioral'],
  DERM: ['Dermatology', 'Skin', 'Rash'],
  ONC: ['Oncology', 'Cancer', 'Tumor'],
  DRUG: ['pharmacology', 'drug', 'medication', 'pharmacokinetics', 'pharmacodynamics', 'chart', 'table', 'EOR', 'clinical medicine'],
  OTHER: ['General', 'Medical', 'Clinical'],
};

/**
 * Search for PDF files whose filename contains the given term (case‑insensitive).
 * Returns an array of absolute paths to matching PDFs.
 *
 * @param term Condition or drug name (e.g., "Urinary Retention")
 * @param limit Max number of results (default 20)
 * @param system Optional system code (e.g., "GU") for fallback search
 * @returns Promise<string[]> full paths to PDFs
 */
export async function findPdfsForTerm(
  term: string,
  limit = 20,
  system?: string
): Promise<string[]> {
  // Sanitize term for shell safety: keep only alphanumerics, spaces, hyphens, underscores
  const safeTerm = term.replace(/[^a-zA-Z0-9 _-]/g, '');
  if (!safeTerm) {
    throw new Error(`Invalid search term: ${term}`);
  }

  // Helper: run find with a single pattern
  const searchWithPattern = async (pattern: string): Promise<string[]> => {
    const command = `find "${LIBRARY_ROOT}" \
      -type f \
      -iname "*${pattern}*.pdf" \
      ! -path "*/\.*" \
      -print | head -${limit}`;
    try {
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      if (stderr) {
        console.warn('find stderr:', stderr);
      }
      const lines = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.endsWith('.pdf'));
      return lines;
    } catch (error: any) {
      if (error.code === 1 && !error.stderr) {
        return [];
      }
      console.error(`Failed to search for pattern "${pattern}":`, error.message);
      throw new Error(`File discovery failed: ${error.message}`);
    }
  };

  // 1. Try exact phrase
  let results = await searchWithPattern(safeTerm);
  if (results.length > 0) {
    return results;
  }

  // 2. Split term into words and try each word individually (OR)
  const words = safeTerm.split(/[\s_-]+/).filter(w => w.length > 1);
  const seen = new Set<string>();
  for (const word of words) {
    const wordResults = await searchWithPattern(word);
    for (const path of wordResults) {
      if (!seen.has(path)) {
        results.push(path);
        seen.add(path);
      }
    }
    if (results.length >= limit) break;
  }
  if (results.length > 0) {
    return results.slice(0, limit);
  }

  // 3. Fallback to system keywords
  if (system && SYSTEM_KEYWORDS[system]) {
    const keywords = SYSTEM_KEYWORDS[system];
    for (const keyword of keywords) {
      const keywordResults = await searchWithPattern(keyword);
      for (const path of keywordResults) {
        if (!seen.has(path)) {
          results.push(path);
          seen.add(path);
        }
      }
      if (results.length >= limit) break;
    }
    if (results.length > 0) {
      return results.slice(0, limit);
    }
  }

  // 4. No matches
  return [];
}

/**
 * Given multiple PDF paths, attempt to pick the most relevant one based on:
 * - Filename similarity (prefer exact match over partial)
 * - Directory depth (shallower may indicate a dedicated folder)
 * - Presence of keywords like "textbook", "review", "high‑yield"
 *
 * This is a heuristic; when multiple strong candidates exist, the caller should
 * prompt the user for selection.
 *
 * @param pdfs Array of PDF paths
 * @param term Original search term
 * @returns Best candidate path, or null if array empty
 */
export function pickBestCandidate(pdfs: string[], term: string): string | null {
  if (pdfs.length === 0) return null;
  if (pdfs.length === 1) return pdfs[0];

  const scored = pdfs.map((file) => {
    const filename = path.basename(file, '.pdf').toLowerCase();
    const termLower = term.toLowerCase();
    let score = 0;

    // Exact filename match (excluding extension) gets highest score
    if (filename === termLower) score += 100;
    // Contains term as whole word
    if (filename.includes(` ${termLower} `) || filename.startsWith(`${termLower} `)) score += 50;
    // Contains term as substring
    if (filename.includes(termLower)) score += 30;
    // Prefer shorter path (shallower depth)
    const depth = file.split('/').length;
    score += (20 - Math.min(depth, 20));
    // Boost for high‑yield indicators
    const boostWords = ['textbook', 'review', 'high yield', 'essential', 'core', 'brs', 'first aid'];
    if (boostWords.some(word => filename.includes(word))) score += 15;

    return { file, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].file;
}

const __filename = fileURLToPath(import.meta.url);

/**
 * Test function: run a quick search for a sample term and log results.
 */
async function test() {
  console.log('🔍 Testing file discovery...');
  const term = 'Urinary Retention';
  const pdfs = await findPdfsForTerm(term, 5);
  console.log(`Found ${pdfs.length} PDF(s) for "${term}":`);
  pdfs.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  const best = pickBestCandidate(pdfs, term);
  console.log(`Best candidate: ${best || '(none)'}`);
}

if (process.argv[1] === __filename) {
  test().catch(console.error);
}