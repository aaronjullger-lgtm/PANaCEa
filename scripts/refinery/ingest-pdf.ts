/**
 * PDF Refinery Pipeline — Transform raw PDFs into structured MedicalContent drafts
 *
 * Usage:
 *   npx tsx scripts/refinery/ingest-pdf.ts --file ./path/to/chapter.pdf --sourceName "PANCE Prep Pearls"
 *
 * Requires: GEMINI_API_KEY, DATABASE_URL (or DIRECT_DATABASE_URL) in .env
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma, disconnect } from '../_shared/db';
import { SourceMaterialType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

type Args = Record<string, string | undefined>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    }
  }
  return args;
}

async function extractTextFromPdf(filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  const text = (data?.text ?? '').trim();
  if (!text) {
    throw new Error(`No text extracted from PDF: ${filePath}`);
  }
  return text.replaceAll(/\r\n/g, '\n').replaceAll(/\n{3,}/g, '\n\n').trim();
}

const REFINERY_SYSTEM_PROMPT = `You are a medical data structurer. Your task is to read the provided text (from a textbook or reference) and extract structured data that matches our MedicalContent schema for PA/NP education.

Output a single JSON object with exactly these keys (use null for missing values):
- condition (string, required): The condition/disease name
- system (string, required): Organ system code, e.g. CV, PULM, GI, RENAL, HEME, ENDO, DERM, MSK, NEURO, PSYCH, OB, PEDS, EENT, OTHER
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
1. Set "status" to "draft" in your output.
2. Set "needsHumanReview" to true in your output.
3. Output only valid JSON with no markdown code fences or extra text.`;

async function extractStructuredContent(rawText: string, sourceName: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required. Set it in .env');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const userPrompt = `Source: ${sourceName}\n\nExtract medical content from the following text into the JSON schema. Remember: status must be "draft" and needsHumanReview must be true.\n\n---\n\n${rawText.slice(0, 120000)}`;

  const result = await model.generateContent([REFINERY_SYSTEM_PROMPT, userPrompt]);
  const response = result.response;
  const text = response.text();
  if (!text) {
    throw new Error('Gemini returned no text');
  }

  const cleaned = text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1').trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  if (!parsed.condition || typeof parsed.condition !== 'string') {
    throw new Error('Gemini output missing required field: condition');
  }
  if (!parsed.system || typeof parsed.system !== 'string') {
    parsed.system = 'OTHER';
  }
  if (!parsed.subcategory || typeof parsed.subcategory !== 'string') {
    parsed.subcategory = 'General';
  }
  parsed.status = 'draft';
  parsed.needsHumanReview = true;
  return parsed;
}

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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const filePath = args.file;
  const sourceName = args.sourceName ?? 'Unknown Source';

  if (!filePath) {
    console.error('Usage: npx tsx scripts/refinery/ingest-pdf.ts --file <path-to-pdf> [--sourceName "Source Name"]');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  try {
    await fs.access(resolvedPath);
  } catch {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log('Extracting text from PDF...');
  const rawText = await extractTextFromPdf(resolvedPath);
  console.log(`Extracted ${rawText.length} characters. Sending to Gemini...`);

  const extracted = await extractStructuredContent(rawText, sourceName);
  const conditionName = String(extracted.condition);
  const system = String(extracted.system ?? 'OTHER').toUpperCase();
  const subcategory = String(extracted.subcategory ?? 'General');

  console.log('Creating SourceMaterial and Condition/MedicalContent...');

  const sourceMaterial = await prisma.sourceMaterial.create({
    data: {
      sourceType: SourceMaterialType.TEXTBOOK,
      sourceName,
      processed: true,
    },
  });

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

  const mcPayload = toPrismaMedicalContent(extracted, condition.id, sourceMaterial.id);
  const medicalContent = await prisma.medicalContent.create({
    data: mcPayload as any,
  });

  console.log('');
  console.log('Draft created for', conditionName, `(ID: ${medicalContent.id}). Review in Admin Dashboard.`);
}

main()
  .then(() => disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
