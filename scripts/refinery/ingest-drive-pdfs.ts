/**
 * Drive PDF Batch Ingestion — Download PDFs from curated Google Drive subfolders,
 * extract text, structure via Gemini, and create MedicalContent drafts.
 *
 * Usage:
 *   npx tsx scripts/refinery/ingest-drive-pdfs.ts --folderId=DRIVE_FOLDER_ID [--sourceName="Drive PDF Import"] [--dryRun]
 *
 * Flags:
 *   --folderId     Google Drive root folder ID (required)
 *   --sourceName   Label for the SourceMaterial records (default: "Drive PDF Import")
 *   --dryRun       List curated PDFs without processing (just count & show names)
 *
 * Requires: GOOGLE_SERVICE_ACCOUNT_JSON, GEMINI_API_KEY, DATABASE_URL in .env
 */

import { config } from 'dotenv';
config();

import { Readable } from 'node:stream';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { listFilesInFolder, downloadFileStream, DriveFileInfo } from '../../lib/google-drive';
import { prisma, disconnect } from '../_shared/db';
import { SourceMaterialType } from '@prisma/client';

/* ─────────────── CLI Arg Parsing ─────────────── */

type Args = { folderId: string | null; sourceName: string; dryRun: boolean };

function parseArgs(argv: string[]): Args {
  const get = (key: string, def: string): string => {
    const arg = argv.find((a) => a.startsWith(`--${key}=`));
    if (!arg) return def;
    return arg.split('=').slice(1).join('=')?.trim() ?? def;
  };
  return {
    folderId: get('folderId', '') || null,
    sourceName: get('sourceName', 'Drive PDF Import'),
    dryRun: argv.includes('--dryRun'),
  };
}

/* ─────────────── Curation: Folder Allowlist ─────────────── */

/**
 * Only these top-level folder prefixes (case-insensitive startsWith) will be
 * recursively scanned for PDFs. Everything else is skipped.
 */
const CURATED_FOLDER_PREFIXES = [
  'UWorld Step 1 Qbook',
  'Board Review Series',
  'Osmosis (Videos)/High Yield Notes & Slides/Books/Osmosis High Yield Pathology',
  'Osmosis (Videos)/High Yield Notes & Slides/Books/Osmosis High Yield Physiology',
  'E-Coach Becker Pharmacology/Table of Contents',
];

/**
 * When multiple editions exist, keep only the highest edition number.
 * e.g. "BRS Physiology, 7e" and "BRS Physiology, 8e" → keep 8e only.
 */
function deduplicateEditions(files: DriveFileWithPath[]): DriveFileWithPath[] {
  // Group by base name (strip edition suffix)
  const groups = new Map<string, DriveFileWithPath[]>();

  for (const f of files) {
    // Extract base: "BRS Pathology" from "BRS Pathology 5e.pdf" or "BRS Pathology, 6e.pdf"
    const base = f.name
      .replace(/\.pdf$/i, '')
      .replace(/,?\s*\d+e$/i, '')
      .trim()
      .toLowerCase();
    const group = groups.get(base) ?? [];
    group.push(f);
    groups.set(base, group);
  }

  const result: DriveFileWithPath[] = [];
  for (const [, group] of groups) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // Extract edition numbers and pick highest
    const withEdition = group.map((f) => {
      const match = f.name.match(/(\d+)e\.pdf$/i);
      return { file: f, edition: match ? parseInt(match[1], 10) : 0 };
    });
    withEdition.sort((a, b) => b.edition - a.edition);
    result.push(withEdition[0].file);
  }
  return result;
}

/**
 * Deduplicate by exact filename — keep first occurrence only.
 * Handles duplicated files across multiple Osmosis subfolders.
 */
function deduplicateByFilename(files: DriveFileWithPath[]): DriveFileWithPath[] {
  const seen = new Set<string>();
  const result: DriveFileWithPath[] = [];
  for (const f of files) {
    const key = f.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(f);
  }
  return result;
}

/* ─────────────── Recursive Drive Scan ─────────────── */

interface DriveFileWithPath extends DriveFileInfo {
  folderPath: string;
}

/**
 * Recursively list PDFs in a Drive folder, respecting the curated allowlist.
 * Only descends into subfolders whose path matches CURATED_FOLDER_PREFIXES.
 */
async function scanCurated(
  folderId: string,
  folderPath: string,
  results: DriveFileWithPath[],
  depth = 0
): Promise<void> {
  if (depth > 5) return;

  const files = await listFilesInFolder(folderId);

  for (const f of files) {
    const childPath = folderPath ? `${folderPath}/${f.name}` : f.name;

    if (f.mimeType === 'application/vnd.google-apps.folder') {
      // At depth 0, only enter folders that match our curated prefixes.
      // At deeper depths, we're already inside a curated subtree — keep going.
      if (depth === 0) {
        const shouldEnter = CURATED_FOLDER_PREFIXES.some(
          (prefix) =>
            childPath.toLowerCase().startsWith(prefix.toLowerCase()) ||
            prefix.toLowerCase().startsWith(childPath.toLowerCase())
        );
        if (!shouldEnter) continue;
      }
      // Check if we're inside a curated prefix subtree or on the path to one
      const insideCurated = CURATED_FOLDER_PREFIXES.some(
        (prefix) =>
          childPath.toLowerCase().startsWith(prefix.toLowerCase()) ||
          prefix.toLowerCase().startsWith(childPath.toLowerCase())
      );
      if (!insideCurated && depth > 0) continue;

      console.log(`  📁 ${childPath}/`);
      await scanCurated(f.id, childPath, results, depth + 1);
    } else if (f.mimeType === 'application/pdf') {
      // Only collect PDFs if we're inside (or at the root of) a curated prefix
      const insideCurated = CURATED_FOLDER_PREFIXES.some((prefix) =>
        childPath.toLowerCase().startsWith(prefix.toLowerCase())
      );
      // Also collect if the folder itself matches
      const folderMatchesCurated = CURATED_FOLDER_PREFIXES.some((prefix) =>
        folderPath.toLowerCase().startsWith(prefix.toLowerCase())
      );
      if (insideCurated || folderMatchesCurated) {
        results.push({ ...f, folderPath });
      }
    }
  }
}

/* ─────────────── PDF Text Extraction ─────────────── */

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  const text = (data?.text ?? '').trim();
  if (!text) {
    throw new Error(`No text extracted from PDF: ${filename}`);
  }
  return text.replaceAll(/\r\n/g, '\n').replaceAll(/\n{3,}/g, '\n\n').trim();
}

/* ─────────────── Gemini Structuring ─────────────── */

const REFINERY_SYSTEM_PROMPT = `You are a medical data structurer for a PA/NP board-review study app. Your task is to read the provided text (from a textbook or reference) and extract structured data for every distinct medical condition or topic covered.

IMPORTANT: Most PDFs cover MANY conditions. You MUST output a JSON **array** of objects—one object per distinct condition/disease/topic. Extract as many as you can find in the text.

Each object must have exactly these keys (use null for missing values):
- condition (string, required): The condition/disease name
- system (string, required): Organ system code — one of: CV, PULM, GI, RENAL, HEME, ENDO, DERM, MSK, NEURO, PSYCH, OB, PEDS, EENT, IMMUNO, MICRO, BIOCHEM, PHARM, OTHER
- subcategory (string, required): e.g. "General", "Heart Failure", "Arrhythmia"
- overview (string or null)
- symptoms (string or null; can be bullet points or paragraph)
- treatment (string or null)
- first_line_rx (string or null): First-line treatment summary
- diagnostics (string or null)
- gold_standard_dx (string or null): Gold standard diagnostic test
- epidemiology (string or null)
- etiology (string or null)
- riskFactors (string or null)
- physicalExam (string or null)
- complications (string or null)
- prognosis (string or null)
- differentialDiagnosis (string or null)
- classic_triad (string or null, or JSON array of 3–5 items)
- clinical_pearls (JSON array of strings or null)
- buzzwords (JSON array of strings or null)
- demographics (string or null): age/gender patterns if mentioned
- patient_education (string or null)
- prevention (string or null)

Critical rules:
1. Set "status" to "draft" in every object.
2. Set "needsHumanReview" to true in every object.
3. Output ONLY a valid JSON array. No markdown code fences, no explanatory text.
4. Extract EVERY condition you can identify from the text. Do not summarize or skip conditions.`;

async function extractStructuredContent(
  rawText: string,
  sourceName: string,
  filename: string
): Promise<Record<string, unknown>[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required. Set it in .env');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // For large PDFs, process in chunks to maximize condition extraction
  const MAX_CHARS = 900_000; // Gemini 2.0 Flash supports ~1M tokens
  const textToProcess = rawText.slice(0, MAX_CHARS);

  const userPrompt = `Source: ${sourceName}
File: ${filename}

Extract ALL medical conditions/topics from the following text into the JSON array schema. Each condition gets its own object. Remember: status must be "draft" and needsHumanReview must be true.

---

${textToProcess}`;

  const result = await model.generateContent([REFINERY_SYSTEM_PROMPT, userPrompt]);
  const response = result.response;
  const text = response.text();
  if (!text) {
    throw new Error('Gemini returned no text');
  }

  // Strip markdown fences if present, then parse
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  // Try to extract the outermost JSON structure
  const jsonMatch = cleaned.match(/^(\[[\s\S]*\]|\{[\s\S]*\})$/);
  const jsonStr = jsonMatch ? jsonMatch[1] : cleaned;

  const parsed = JSON.parse(jsonStr);
  const items: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];

  // Validate each item
  for (const item of items) {
    if (!item.condition || typeof item.condition !== 'string') {
      console.warn('    ⚠ Skipping entry with missing condition field');
      continue;
    }
    if (!item.system || typeof item.system !== 'string') {
      item.system = 'OTHER';
    }
    if (!item.subcategory || typeof item.subcategory !== 'string') {
      item.subcategory = 'General';
    }
    item.status = 'draft';
    item.needsHumanReview = true;
  }

  return items.filter((i) => i.condition && typeof i.condition === 'string');
}

/* ─────────────── DB Helpers ─────────────── */

function toPrismaMedicalContent(
  extracted: Record<string, unknown>,
  conditionId: string,
  sourceMaterialId: string
): Record<string, unknown> {
  const now = new Date();
  const id = uuidv4();
  const contentMeta = {
    _refinery: {
      sourceMaterialId,
      isAiGenerated: true,
      needsHumanReview: true,
    },
  };

  return {
    id,
    conditionId,
    system: String(extracted.system ?? 'OTHER'),
    subcategory: String(extracted.subcategory ?? 'General'),
    condition: String(extracted.condition),
    status: 'draft',
    version: 1,
    createdBy: 'refinery-ingest',
    updatedAt: now,
    updatedBy: 'refinery-ingest',
    overview: extracted.overview ?? null,
    symptoms: extracted.symptoms ?? null,
    treatment: extracted.treatment ?? null,
    first_line_rx: extracted.first_line_rx ?? null,
    diagnostics: extracted.diagnostics ?? null,
    gold_standard_dx: extracted.gold_standard_dx ?? null,
    epidemiology: extracted.epidemiology ?? null,
    etiology: extracted.etiology ?? null,
    riskFactors: extracted.riskFactors ?? null,
    physicalExam: extracted.physicalExam ?? null,
    complications: extracted.complications ?? null,
    prognosis: extracted.prognosis ?? null,
    differentialDiagnosis: extracted.differentialDiagnosis ?? null,
    patient_education: extracted.patient_education ?? null,
    prevention: extracted.prevention ?? null,
    classic_triad: extracted.classic_triad ?? null,
    clinical_pearls: Array.isArray(extracted.clinical_pearls) ? extracted.clinical_pearls : null,
    buzzwords: Array.isArray(extracted.buzzwords) ? extracted.buzzwords : [],
    content: contentMeta,
    relatedSystems: [],
  };
}

async function upsertConditionAndContent(
  items: Record<string, unknown>[],
  sourceMaterialId: string
): Promise<number> {
  let created = 0;

  for (const extracted of items) {
    const conditionName = String(extracted.condition);
    const system = String(extracted.system ?? 'OTHER').toUpperCase();
    const subcategory = String(extracted.subcategory ?? 'General');

    let condition = await prisma.condition.findFirst({
      where: {
        name: { equals: conditionName, mode: 'insensitive' },
        system: { equals: system, mode: 'insensitive' },
      },
    });

    if (!condition) {
      const conditionId = uuidv4();
      condition = await prisma.condition.create({
        data: {
          id: conditionId,
          name: conditionName,
          system,
          subcategory,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    const mcPayload = toPrismaMedicalContent(extracted, condition.id, sourceMaterialId);
    await prisma.medicalContent.create({ data: mcPayload as any });
    created++;
    console.log(`    ✓ ${conditionName} (${system} / ${subcategory})`);
  }

  return created;
}

/* ─────────────── Main Pipeline ─────────────── */

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.folderId) {
    console.error(
      'Usage: npx tsx scripts/refinery/ingest-drive-pdfs.ts --folderId=DRIVE_FOLDER_ID [--sourceName="Source Name"] [--dryRun]'
    );
    process.exit(1);
  }

  const { folderId, sourceName, dryRun } = args;

  /* Step 1 — Recursively scan curated folders */
  console.log(`\n📂 Scanning curated folders in Drive...\n`);
  console.log('Curated folder targets:');
  for (const prefix of CURATED_FOLDER_PREFIXES) {
    console.log(`  • ${prefix}`);
  }
  console.log('');

  const allPdfs: DriveFileWithPath[] = [];
  await scanCurated(folderId, '', allPdfs, 0);

  console.log(`\nFound ${allPdfs.length} raw PDFs in curated folders.`);

  /* Step 2 — Deduplicate */
  let pdfs = deduplicateByFilename(allPdfs);
  console.log(`After filename dedup: ${pdfs.length} PDFs.`);

  pdfs = deduplicateEditions(pdfs);
  console.log(`After edition dedup: ${pdfs.length} PDFs.\n`);

  if (pdfs.length === 0) {
    console.log('No PDFs to ingest.');
    return;
  }

  console.log('Final curated PDF list:');
  for (let i = 0; i < pdfs.length; i++) {
    const f = pdfs[i];
    const path = f.folderPath ? `${f.folderPath}/${f.name}` : f.name;
    console.log(`  ${String(i + 1).padStart(2)}. ${path}`);
  }
  console.log('');

  if (dryRun) {
    console.log(`🏁 Dry run complete. ${pdfs.length} PDFs would be processed.`);
    return;
  }

  /* Step 3 — Create SourceMaterial */
  const sourceUrl = `https://drive.google.com/drive/folders/${folderId}`;
  let sourceMaterial = await prisma.sourceMaterial.findFirst({
    where: { sourceName, sourceUrl },
  });
  if (!sourceMaterial) {
    sourceMaterial = await prisma.sourceMaterial.create({
      data: {
        sourceType: SourceMaterialType.TEXTBOOK,
        sourceName,
        sourceUrl,
        processed: false,
      },
    });
    console.log(`Created SourceMaterial: ${sourceMaterial.id}\n`);
  } else {
    console.log(`Using existing SourceMaterial: ${sourceMaterial.id}\n`);
  }

  /* Step 4 — Process each PDF */
  let totalConditions = 0;
  let processedPdfs = 0;
  let failedPdfs = 0;
  const startTime = Date.now();

  for (let i = 0; i < pdfs.length; i++) {
    const file = pdfs[i];
    const label = `[${i + 1}/${pdfs.length}]`;
    const filePath = file.folderPath ? `${file.folderPath}/${file.name}` : file.name;

    console.log(`${label} 📄 Processing: ${filePath}`);

    try {
      // Download
      console.log(`${label}   ⬇ Downloading from Drive...`);
      const stream = await downloadFileStream(file.id);
      const buffer = await streamToBuffer(stream);
      console.log(`${label}   Downloaded ${(buffer.length / 1024).toFixed(0)} KB`);

      // Extract text
      console.log(`${label}   📝 Extracting text...`);
      const rawText = await extractTextFromBuffer(buffer, file.name);
      console.log(`${label}   Extracted ${rawText.length.toLocaleString()} characters`);

      if (rawText.length < 200) {
        console.log(`${label}   ⚠ Too little text extracted, skipping (likely image-only PDF).`);
        failedPdfs++;
        continue;
      }

      // Gemini structuring
      console.log(`${label}   🧠 Sending to Gemini for structuring...`);
      const items = await extractStructuredContent(rawText, sourceName, file.name);
      console.log(`${label}   Gemini returned ${items.length} condition(s)`);

      // DB inserts
      const count = await upsertConditionAndContent(items, sourceMaterial.id);
      totalConditions += count;
      processedPdfs++;

      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.log(`${label} ✅ Done — ${count} condition(s) created. [${elapsed}m elapsed]\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${label} ❌ Failed: ${msg}\n`);
      failedPdfs++;
    }

    // Delay between files to respect Gemini rate limits
    if (i < pdfs.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  /* Step 5 — Mark source as processed */
  await prisma.sourceMaterial.update({
    where: { id: sourceMaterial.id },
    data: { processed: true },
  });

  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  /* Summary */
  console.log('═══════════════════════════════════════════');
  console.log(`📊 Batch Complete (${totalElapsed} minutes)`);
  console.log(`   PDFs processed:     ${processedPdfs}`);
  console.log(`   PDFs failed:        ${failedPdfs}`);
  console.log(`   Conditions created: ${totalConditions}`);
  console.log(`   Source Material ID: ${sourceMaterial.id}`);
  console.log('═══════════════════════════════════════════\n');
}

main()
  .then(() => disconnect())
  .catch((err) => {
    console.error(err);
    disconnect().finally(() => process.exit(1));
  });
