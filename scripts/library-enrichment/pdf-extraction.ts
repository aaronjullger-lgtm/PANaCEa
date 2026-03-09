#!/usr/bin/env npx tsx
/**
 * PDF Text Extraction for Library Enrichment
 *
 * Extracts text from a PDF file, optionally splitting by pages or searching for keywords.
 * Reuses the same pdf‑parse library as the refinery pipeline.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

/**
 * Convert a Readable stream to Buffer (copied from refinery script)
 */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Extract plain text from a PDF buffer.
 * @param buffer PDF file contents
 * @param filename For error messages
 * @returns Extracted text, cleaned and normalized
 */
export async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  const text = (data?.text ?? '').trim();
  if (!text) {
    throw new Error(`No text extracted from PDF: ${filename}`);
  }
  return text
    .replaceAll(/\r\n/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract text from a PDF file on disk.
 * @param filePath Absolute or relative path to PDF
 * @returns Extracted text
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return extractTextFromBuffer(buffer, filePath);
}

/**
 * Extract text per page from a PDF.
 * @param filePath Path to PDF
 * @returns Array of page texts (1‑indexed)
 */
export async function extractTextByPage(filePath: string): Promise<string[]> {
  const buffer = await readFile(filePath);
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  // pdf-parse's data.pages is an array of text per page (starting at 1)
  const pages = data?.pages ?? [];
  return pages.map((p: any) => (p?.text ?? '').trim()).filter(Boolean);
}

/**
 * Search for a keyword in the PDF and return surrounding context.
 * @param filePath Path to PDF
 * @param keyword Keyword to find (case‑insensitive)
 * @param contextLines Number of lines before/after to include (default 10)
 * @returns Array of context strings (one per occurrence)
 */
export async function findKeywordContext(
  filePath: string,
  keyword: string,
  contextLines = 10
): Promise<string[]> {
  const pages = await extractTextByPage(filePath);
  const lowerKeyword = keyword.toLowerCase();
  const results: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const lines = pages[i].split('\n');
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].toLowerCase().includes(lowerKeyword)) {
        const start = Math.max(0, j - contextLines);
        const end = Math.min(lines.length, j + contextLines + 1);
        const context = lines.slice(start, end).join('\n');
        results.push(`[Page ${i + 1}] ${context}`);
      }
    }
  }
  return results;
}

/**
 * Simple test: extract text from a sample PDF (if any).
 */
async function test() {
  const samplePdf = process.argv[2];
  if (!samplePdf) {
    console.log('Usage: npx tsx scripts/library-enrichment/pdf-extraction.ts <path-to-pdf>');
    console.log('No sample PDF provided, skipping test.');
    return;
  }
  try {
    console.log(`📄 Extracting text from ${samplePdf}...`);
    const text = await extractTextFromPdf(samplePdf);
    console.log(`✅ Extracted ${text.length} characters. First 500 chars:`);
    console.log(text.slice(0, 500) + (text.length > 500 ? '...' : ''));
  } catch (error: any) {
    console.error('❌ Extraction failed:', error.message);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  test().catch(console.error);
}