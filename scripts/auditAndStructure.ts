import fs from 'fs';
import path from 'path';
import { CONDITION_REGISTRY } from '../conditionRegistry';
import { BUZZWORD_BANK } from '../data/buzzwordBank';
import { FIRST_LINE_TREATMENTS } from '../data/firstLineTreatmentData';
import { GUIDELINES_DATABASE } from '../data/guidelinesData';

// Configuration
const INPUT_FILE = path.resolve("conditionContent.final.json");
const OUTPUT_FILE = path.resolve("conditionContent.final.json");
const MISSING_LOG = path.resolve("missing_registry_items.json");

// Load Local Data
const clinicalCasesPath = path.resolve("src/data/clinicalCases.json");
const labCasesPath = path.resolve("src/data/labCases.json");

const clinicalCases = fs.existsSync(clinicalCasesPath) ? JSON.parse(fs.readFileSync(clinicalCasesPath, 'utf8')) : [];
// const labCases = fs.existsSync(labCasesPath) ? JSON.parse(fs.readFileSync(labCasesPath, 'utf8')) : [];

// --- CRITICAL FIX: Correct Normalization ---
// Must match conditionRegistry.ts: lowercase, spaces->underscores, keep alphanumeric+_
function normalize(s: string): string {
  return s.toLowerCase().trim()
    .replace(/\s+/g, '_')           
    .replace(/[^a-z0-9_]/g, '');
}

function findConditionId(name: string): string | undefined {
  const normName = normalize(name);
  
  // 1. Exact ID Match (if passed an ID like "CV__ecg__afib")
  if (CONDITION_REGISTRY.some(c => `${c.system}__${normalize(c.subcategory)}__${normalize(c.condition)}` === name)) return name;

  // 2. Condition Name Match
  const exact = CONDITION_REGISTRY.find(c => normalize(c.condition) === normName);
  if (exact) return `${exact.system}__${normalize(exact.subcategory)}__${normalize(exact.condition)}`;

  // 3. Alias Match
  const aliasMatch = CONDITION_REGISTRY.find(c => c.aliases?.some(a => normalize(a) === normName));
  if (aliasMatch) return `${aliasMatch.system}__${normalize(aliasMatch.subcategory)}__${normalize(aliasMatch.condition)}`;

  return undefined;
}

// --- MAIN ---

async function main() {
  console.log("🚜 Starting Master Harvest (Fixed IDs)...");

  // 1. Load Content & Index by ID
  let rawContent: any[] = [];
  if (fs.existsSync(INPUT_FILE)) {
    const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    rawContent = Array.isArray(raw) ? raw : Object.values(raw);
  }
  
  const contentMap = new Map();
  // Index existing content
  rawContent.forEach((c: any) => contentMap.set(c.conditionId, c));
  
  console.log(`   - Loaded ${contentMap.size} existing conditions.`);

  // 2. Registry Alignment (Create Stubs)
  let addedCount = 0;
  for (const meta of CONDITION_REGISTRY) {
    const id = `${meta.system}__${normalize(meta.subcategory)}__${normalize(meta.condition)}`;
    if (!contentMap.has(id)) {
      contentMap.set(id, {
        conditionId: id,
        condition: meta.condition,
        content: {
          overview: "", diagnostics: "", etiologyPathophysiology: "",
          symptoms: [], treatment: [], examFindings: [], riskFactors: [], 
          management: [], complications: [], basicScienceLinks: []
        }
      });
      addedCount++;
    }
  }
  console.log(`   - Added ${addedCount} missing registry stubs.`);

  // 3. HARVEST DATA
  let txCount = 0, caseCount = 0, buzzCount = 0;

  // A. Treatments
  for (const tx of FIRST_LINE_TREATMENTS) {
    const id = findConditionId(tx.condition);
    if (id && contentMap.has(id)) {
      const entry = contentMap.get(id);
      const text = `**First-Line**: ${tx.firstLine}. ${tx.explanation} ${tx.pearl ? `\n* **Pearl**: ${tx.pearl}` : ''}`;
      
      if (!entry.content.treatment) entry.content.treatment = [];
      if (!JSON.stringify(entry.content.treatment).includes(tx.firstLine)) {
        entry.content.treatment.unshift(text);
        txCount++;
      }
    }
  }

  // B. Clinical Cases (Presentation)
  for (const cCase of clinicalCases) {
    // FIX: Use 'correctDiagnosis', not 'diagnosis'
    const id = findConditionId(cCase.correctDiagnosis);
    if (id && contentMap.has(id)) {
      const entry = contentMap.get(id);
      
      // Inject Presentation Clues
      const clueText = cCase.presentationClues.map((c: any) => `* ${c.description} (${c.type})`).join("\n");
      const fullText = `**Classic Case**: ${cCase.vignette}\n\n**Key Clues**:\n${clueText}`;
      
      if (!entry.content.clinicalPresentation) entry.content.clinicalPresentation = "";
      if (!entry.content.clinicalPresentation.includes(cCase.vignette.substring(0, 20))) {
        entry.content.clinicalPresentation = fullText + "\n\n" + entry.content.clinicalPresentation;
        caseCount++;
      }
    }
  }

  // C. Buzzwords
  for (const buzz of BUZZWORD_BANK) {
    const id = findConditionId(buzz.condition);
    if (id && contentMap.has(id)) {
      const entry = contentMap.get(id);
      const text = `**${buzz.buzzword}**: ${buzz.explanation || 'Classic finding'}`;
      
      if (!entry.content.examFindings) entry.content.examFindings = [];
      if (!JSON.stringify(entry.content.examFindings).includes(buzz.buzzword)) {
        entry.content.examFindings.push(text);
        buzzCount++;
      }
    }
  }

  // D. Guidelines
  for (const guide of GUIDELINES_DATABASE) {
    for (const [id, entry] of contentMap.entries()) {
      const condName = entry.condition.toLowerCase();
      // Fuzzy match guideline name to condition name
      if (guide.name.toLowerCase().includes(condName) || (guide.clinicalContext && guide.clinicalContext.toLowerCase().includes(condName))) {
         if (!entry.content.management) entry.content.management = [];
         const text = `**Guideline (${guide.name})**: ${guide.description}`;
         if (!JSON.stringify(entry.content.management).includes(guide.name)) {
           entry.content.management.push(text);
         }
      }
    }
  }

  console.log(`   - Harvested: ${txCount} treatments, ${caseCount} cases, ${buzzCount} buzzwords.`);

  // 4. Save
  const finalArray = Array.from(contentMap.values());
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalArray, null, 2));
  console.log(`✅ Harvest Complete! IDs fixed. Saved to ${OUTPUT_FILE}`);
}

main();