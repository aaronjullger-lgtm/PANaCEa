import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.resolve('conditionContent.generated.json');
const OUTPUT_FILE = path.resolve('conditionContent.scrubbed.json');
const REPORT_FILE = path.resolve('scrub_report.json');

const REQUIRED_SECTIONS = [
  'overview',
  'diagnostics',
  'etiologyPathophysiology',
  'epidemiology',
  'riskFactors',
  'clinicalPresentation',
  'symptoms',
  'examFindings',
  'treatment',
  'management',
  'complications',
  'prognosis',
];

function isValidContent(val: any): boolean {
  if (!val) return false;

  if (Array.isArray(val)) {
    // Fixed: Check if 's' is a string before calling .includes()
    return (
      val.length > 0 &&
      !val.every((s) => typeof s === 'string' && (s.includes('--') || s.includes('populated')))
    );
  }

  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return (
      s.length > 5 &&
      s !== '--' &&
      !s.includes('to be populated') &&
      !s.includes('content to be generated')
    );
  }

  return typeof val === 'object' && Object.keys(val).length > 0;
}

function mergeConditions(existing: any, incoming: any): any {
  const merged = { ...existing, ...incoming };
  merged.content = { ...(existing.content || {}) };

  const incomingContent = incoming.content || {};
  for (const section of REQUIRED_SECTIONS) {
    if (isValidContent(incomingContent[section])) {
      const existingSection = merged.content[section];
      // If incoming is valid and (existing is invalid OR incoming is larger/better), take incoming
      if (
        !isValidContent(existingSection) ||
        JSON.stringify(existingSection).length < JSON.stringify(incomingContent[section]).length
      ) {
        merged.content[section] = incomingContent[section];
      }
    }
  }
  return merged;
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('File not found');
    return;
  }

  console.log('Reading file...');
  let raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  if (!Array.isArray(raw)) raw = Object.values(raw); // Handle dictionary format if present

  console.log(`Processing ${raw.length} entries...`);
  const uniqueMap = new Map();

  for (const entry of raw) {
    if (!entry.conditionId) continue;
    if (uniqueMap.has(entry.conditionId)) {
      uniqueMap.set(entry.conditionId, mergeConditions(uniqueMap.get(entry.conditionId), entry));
    } else {
      uniqueMap.set(entry.conditionId, entry);
    }
  }

  const cleaned = Array.from(uniqueMap.values());
  const incomplete = cleaned
    .filter((c) => REQUIRED_SECTIONS.some((s) => !isValidContent(c.content?.[s])))
    .map((c) => c.conditionId);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cleaned, null, 2));
  fs.writeFileSync(REPORT_FILE, JSON.stringify(incomplete, null, 2));

  console.log(`✅ Scrubbed! Reduced to ${cleaned.length} unique conditions.`);
  console.log(
    `⚠️  ${incomplete.length} conditions still missing sections (saved to scrub_report.json).`
  );
}

main();
