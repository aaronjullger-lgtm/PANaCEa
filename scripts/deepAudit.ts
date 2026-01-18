import fs from 'fs';
import path from 'path';

const contentPath = path.resolve('conditionContent.generated.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

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

const PLACEHOLDER_INDICATORS = ['To be populated', 'Content to be generated', 'PLACEHOLDER'];

// Regex to catch standalone dashes or "To be populated" variations
const BAD_PATTERNS = [/^--$/, /To be populated/i, /Content to be generated/i, /PLACEHOLDER/i];

let incompleteCount = 0;
const incompleteItems: any[] = [];

content.forEach((item: any) => {
  const missing: string[] = [];
  const placeholders: string[] = [];

  if (!item.content) {
    missing.push('ALL_CONTENT');
  } else {
    REQUIRED_SECTIONS.forEach((section) => {
      const val = item.content[section];

      // Check for missing keys
      if (val === undefined || val === null) {
        missing.push(section);
        return;
      }

      // Check strings
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '' || BAD_PATTERNS.some((p) => p.test(trimmed))) {
          placeholders.push(section);
        }
      }

      // Check arrays
      else if (Array.isArray(val)) {
        if (val.length === 0) {
          placeholders.push(`${section} (empty array)`);
        } else {
          const hasBadContent = val.some(
            (v) =>
              typeof v === 'string' &&
              (v.trim() === '' || BAD_PATTERNS.some((p) => p.test(v.trim())))
          );
          if (hasBadContent) placeholders.push(`${section} (contains placeholder)`);
        }
      }

      // Check objects (diagnostics)
      else if (typeof val === 'object') {
        if (Object.keys(val).length === 0) {
          placeholders.push(`${section} (empty object)`);
        } else if (val.notes) {
          if (BAD_PATTERNS.some((p) => p.test(val.notes.trim()))) {
            placeholders.push(`${section}.notes`);
          }
        }
      }
    });
  }

  if (missing.length > 0 || placeholders.length > 0) {
    incompleteCount++;
    incompleteItems.push({
      id: item.conditionId,
      name: item.condition,
      missing,
      placeholders,
    });
  }
});

console.log(`Total items: ${content.length}`);
console.log(`Incomplete items: ${incompleteCount}`);
if (incompleteCount > 0) {
  console.log('First 10 incomplete items:');
  console.log(JSON.stringify(incompleteItems.slice(0, 10), null, 2));
}
