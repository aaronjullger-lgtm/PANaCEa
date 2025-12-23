/**
 * scripts/content-doctor.ts
 * 
 * 🩺 PANaCEa Content Doctor - Autonomous Medical Director for the Database
 * 
 * This script acts as an intelligent content curator that:
 * 1. Phase 1: PANCE Gap Analysis - Identifies missing high-yield conditions
 * 2. Phase 2: Reference Grade Content Generation - Fills content gaps with AI
 * 
 * Architecture:
 * - Registry: Condition table (Prisma)
 * - Content: MedicalContent table (Prisma)
 * - AI: Google Gemini API
 * 
 * Usage: npx ts-node scripts/content-doctor.ts [--phase1] [--phase2] [--system CV]
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

// Load environment variables
config();

const prisma = new PrismaClient();

// Initialize Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Use Gemini 2.5 Pro for highest-quality medical content generation
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

// System codes and labels
const SYSTEM_CODES = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'] as const;
type SystemCode = typeof SYSTEM_CODES[number];

const SYSTEM_LABELS: Record<string, string> = {
  CV: 'Cardiovascular',
  PULM: 'Pulmonary',
  GI: 'Gastrointestinal',
  NEURO: 'Neurology',
  MSK: 'Musculoskeletal',
  DERM: 'Dermatology',
  HEME: 'Hematology/Oncology',
  ENDO: 'Endocrinology',
  HEENT: 'HEENT (Eyes, Ears, Nose, Throat)',
  RENAL: 'Renal/Nephrology',
  REPRO: 'Reproductive/Obstetrics/Gynecology',
  PSYCH: 'Psychiatry/Behavioral',
  ID: 'Infectious Disease',
  GU: 'Genitourinary',
};

// Rate limiting with exponential backoff
let backoffMs = 2000;
const MAX_BACKOFF_MS = 60000;
const MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiWithRetry(prompt: string, retries = 0): Promise<string> {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    backoffMs = 2000; // Reset backoff on success
    return response.text();
  } catch (error: any) {
    if (error?.status === 429 && retries < MAX_RETRIES) {
      console.log(`  ⏳ Rate limited. Waiting ${backoffMs / 1000}s before retry...`);
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      return callGeminiWithRetry(prompt, retries + 1);
    }
    throw error;
  }
}

/**
 * Generate a stable condition ID
 */
function generateConditionId(system: string, subcategory: string, name: string): string {
  const sanitize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${system}__${sanitize(subcategory || 'general')}__${sanitize(name)}`;
}

/**
 * Parse JSON from Gemini response, handling markdown code blocks
 */
function parseGeminiJson<T>(text: string): T | null {
  try {
    // Remove markdown code blocks if present
    let cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    return null;
  }
}

/**
 * Generate content for a single condition
 */
async function generateContentForCondition(
  condition: any,
  missingFields?: string[],
  existingContent?: any
): Promise<void> {
  console.log(`\n📝 Generating content for: ${condition.name} (${condition.system})`);

  const prompt = `You are an expert medical educator creating PANCE/PANRE study content for PA students.

Generate comprehensive, high-yield medical content for:
CONDITION: ${condition.name}
SYSTEM: ${SYSTEM_LABELS[condition.system] || condition.system}
SUBCATEGORY: ${condition.subcategory || 'General'}

Return ONLY a JSON object (no markdown, no explanation):
{
  "overview": "2-3 sentence clinical overview emphasizing what every PA must know",
  "etiology": "Primary cause(s) and pathogen(s) with **bolded key terms**",
  "epidemiology": "Prevalence, demographics, risk populations with **key stats bolded**",
  "pathophysiology": "Disease mechanism with **bolded pathophysiologic terms**",
  "riskFactors": ["**Modifiable**: Smoking, obesity", "**Non-modifiable**: Age >65, family history"],
  "symptoms": ["**Cardinal**: Primary symptom", "Secondary symptom", "Associated finding"],
  "physicalExam": ["**Inspection**: Finding", "**Auscultation**: Finding", "**Palpation**: Finding"],
  "diagnostics": "Workup approach with **best initial test** and **gold standard** clearly marked",
  "differentialDiagnosis": ["Most likely alternative", "Must rule-out", "Consider if atypical"],
  "treatment": ["**First-line**: Specific treatment with dose if applicable", "**Alternative**: Second option", "**Refractory**: Escalation pathway"],
  "complications": ["**Acute**: Immediate risk", "**Chronic**: Long-term sequela"],
  "prognosis": "Expected clinical course with **key prognostic factors bolded**",
  
  "buzzwords": ["term1", "term2", "term3"],
  "classic_triad": ["Sign 1", "Sign 2", "Sign 3"],
  "clinical_pearls": ["Full sentence pearl with clinical rationale.", "Another complete teaching point.", "Third actionable pearl."],
  "gold_standard_dx": "Single definitive diagnostic test or finding",
  "first_line_rx": "Specific first-line treatment",
  
  "synonyms": ["Alternative Name 1", "Abbreviation"],
  "classic_patient": "Demographic snapshot in <15 words",
  "mnemonic": "Memory aid if one exists, else null",
  "guidelines": "Relevant guideline (e.g., '2023 AHA Guidelines') or null",
  
  "differentials": [
    { "condition": "Similar Condition 1", "rule_out": "Key differentiating feature" },
    { "condition": "Similar Condition 2", "rule_out": "How to distinguish" },
    { "condition": "Similar Condition 3", "rule_out": "Distinguishing test or finding" }
  ],
  
  "pance_yield": 3,
  "image_query": "educational image search term for this condition",
  "best_initial_test": "First test to order in workup",
  
  "rx_mechanism": "MOA of first-line treatment",
  "rx_side_effects": "Top adverse effects to monitor",
  
  "age_demographic": ["Adult", "Elderly"],
  "gender_bias": "Female > Male (3:1) or 'No significant bias'",
  
  "patient_education": "Key counseling points for patients",
  "disposition": "Admission criteria vs outpatient management",
  "prevention": "Screening recommendations or preventive measures",
  
  "relatedSystems": ["OTHER_SYSTEM_CODE"]
}

CRITICAL FORMATTING RULES:
1. **buzzwords**: <5 words each, NO punctuation, trigger-words that immediately suggest diagnosis (e.g., "currant jelly sputum", "splinter hemorrhages", "target lesions")
2. **clinical_pearls**: FULL SENTENCES with rationale - these teach the "why" (e.g., "Obtain ECG in all chest pain patients because silent MI is common in diabetics and elderly.")
3. **classic_triad/classic_patient**: Brief badges for quick recognition, <8 words each
4. **Markdown**: Use **bold** for key terms within prose fields (etiology, pathophysiology, diagnostics, treatment, prognosis)
5. **Arrays**: Format array items with category prefixes like "**First-line**: detail" or "**Acute**: complication"
6. **pance_yield**: 1=Low (rare), 2=Mid (occasional), 3=High (common/must-know)
7. **relatedSystems**: Only include if condition truly spans systems. Use codes: ${SYSTEM_CODES.join(', ')}
8. **synonyms**: Include common abbreviations and alternative names
9. **differentials**: Include rule_out reasoning for each DDx condition

Valid system codes: ${SYSTEM_CODES.join(', ')}
All content must be medically accurate and PANCE-relevant.`;

// (Old function body removed; only the new implementation remains)

// ============================================================================
// PHASE 1: PANCE GAP ANALYSIS
// ============================================================================

interface GapCondition {
  name: string;
  subcategory: string;
  relatedSystems?: string[];
  reasoning: string;
}

async function phase1GapAnalysis(targetSystem?: string): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('🧠 PHASE 1: PANCE GAP ANALYSIS');
  console.log('═'.repeat(70));
  console.log('Comparing your database against the NCCPA PANCE Blueprint...\n');

  const systems = targetSystem ? [targetSystem] : SYSTEM_CODES;
  let totalGaps = 0;
  let totalRegistered = 0;

  for (const system of systems) {
    console.log(`\n📋 Analyzing ${SYSTEM_LABELS[system] || system}...`);

    // Get current conditions for this system
    const existingConditions = await prisma.condition.findMany({
      where: { 
        OR: [
          { system },
          { relatedSystems: { has: system } },
        ]
      },
      select: { name: true, subcategory: true },
    });

    const conditionList = existingConditions.map(c => c.name).join('\n- ');
    console.log(`  📊 Current count: ${existingConditions.length} conditions`);

    // Ask Gemini for gap analysis
    const prompt = `You are a PANCE/PANRE exam blueprint expert. Analyze this list of ${SYSTEM_LABELS[system] || system} conditions and identify HIGH-YIELD GAPS.

CURRENT ${system} CONDITIONS IN DATABASE:
${conditionList || '(none)'}

TASK: Compare against the NCCPA PANCE Content Blueprint for ${SYSTEM_LABELS[system] || system}.
Identify 3-5 HIGH-YIELD conditions that are MISSING and commonly tested on PANCE.

IMPORTANT CRITERIA:
- Focus on conditions that appear frequently on PANCE exams
- Include conditions with classic presentations that every PA student must know
- Consider conditions that bridge multiple systems (mark relatedSystems)

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    "name": "Exact Condition Name",
    "subcategory": "Appropriate Subcategory",
    "relatedSystems": ["OTHER_SYSTEM_CODE"],
    "reasoning": "Why this is high-yield for PANCE"
  }
]

Valid system codes: ${SYSTEM_CODES.join(', ')}`;

    try {
      await sleep(1500); // Polite delay between requests
      const response = await callGeminiWithRetry(prompt);
      const gaps = parseGeminiJson<GapCondition[]>(response);

      if (!gaps || !Array.isArray(gaps)) {
        console.log('  ⚠️ No valid gaps identified');
        continue;
      }

      console.log(`  🆕 Found ${gaps.length} gap(s):`);

      // Register each missing condition
      for (const gap of gaps) {
        try {
          const conditionId = generateConditionId(system, gap.subcategory, gap.name);

          // Check if already exists
          const existing = await prisma.condition.findUnique({
            where: { id: conditionId },
          });

          if (existing) {
            console.log(`    ⏭️  ${gap.name} - Already exists`);
            continue;
          }

          // Create the condition record
          await prisma.condition.create({
            data: {
              id: conditionId,
              name: gap.name,
              system,
              subcategory: gap.subcategory || 'General',
              relatedSystems: gap.relatedSystems || [],
              displayName: gap.name.replace(/\s*\([^)]*\)/g, '').trim(),
              status: 'published',
              content: {
                reasoning: gap.reasoning,
                source: 'content-doctor-phase1',
                generatedAt: new Date().toISOString(),
              },
            },
          });

          console.log(`    ✅ Registered: ${gap.name} (${gap.subcategory})`);
          totalRegistered++;
          totalGaps++;
        } catch (error) {
          console.error(`    ❌ Failed to register ${gap.name}:`, error);
        }
      }
    } catch (error) {
      console.error(`  ❌ Error analyzing ${system}:`, error);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`📈 Phase 1 Summary: Found ${totalGaps} gaps, registered ${totalRegistered} new conditions`);
}

// ============================================================================
// PHASE 2: REFERENCE GRADE CONTENT GENERATION
// ============================================================================

interface MedicalContentSchema {
  // Core clinical content
  overview: string;
  etiology: string;
  epidemiology: string;
  pathophysiology: string;
  riskFactors: string[];
  symptoms: string[];
  physicalExam: string[];
  diagnostics: string;
  differentialDiagnosis: string[];
  treatment: string[];
  complications: string[];
  prognosis: string;
  
  // High-yield exam fields
  buzzwords: string[];          // <5 words each, no punctuation
  classic_triad: string[];      // 2-4 cardinal signs
  clinical_pearls: string[];    // Full sentences with rationale
  gold_standard_dx: string;     // Single definitive test
  first_line_rx: string;        // First-line treatment
  
  // Search & Discovery
  synonyms?: string[];          // Alternative names ["GCA", "Temporal Arteritis"]
  classic_patient?: string;     // Demographic snapshot "Elderly female with jaw claudication"
  mnemonic?: string;            // Memory aid if applicable
  guidelines?: string;          // "2023 AHA Guidelines", "USPSTF Grade A"
  
  // Structured Differentials
  differentials?: Array<{       // Enhanced DDx with rule-out logic
    condition: string;
    rule_out: string;           // Key differentiating feature
  }>;
  
  // Study Prioritization
  pance_yield?: number;         // 1=Low, 2=Mid, 3=High
  image_query?: string;         // Search term for educational images
  
  // Diagnostic Nuance
  best_initial_test?: string;   // Screening/initial workup test
  
  // Pharmacology Context
  rx_mechanism?: string;        // MOA of first-line treatment
  rx_side_effects?: string;     // Top adverse effects to know
  
  // Demographics
  age_demographic?: string[];   // ["Elderly", "Adult"] or ["Child", "Adolescent"]
  gender_bias?: string;         // "Female > Male (9:1)" or "No significant bias"
  
  // Clinical Management
  patient_education?: string;   // Key counseling points
  disposition?: string;         // Admission criteria / outpatient management
  prevention?: string;          // Screening/prevention recommendations
  
  // Multi-system tagging
  relatedSystems?: string[];    // Additional systems involved
}

async function phase2ContentGeneration(targetSystem?: string): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('💉 PHASE 2: REFERENCE GRADE CONTENT GENERATION');
  console.log('═'.repeat(70));
  console.log('Finding conditions with missing or incomplete content...\n');

  // Find all published conditions
  const allConditions = await prisma.condition.findMany({
    where: {
      status: 'published',
      ...(targetSystem ? { system: targetSystem } : {}),
    },
  });

  // Only select minimal fields for completeness checks to avoid response size limits
  const requiredFields = [
    'overview', 'etiology', 'epidemiology', 'pathophysiology', 'riskFactors', 'symptoms', 'physicalExam', 'diagnostics',
    'differentialDiagnosis', 'treatment', 'complications', 'prognosis', 'buzzwords', 'classic_triad', 'clinical_pearls',
    'gold_standard_dx', 'first_line_rx', 'synonyms', 'classic_patient', 'mnemonic', 'guidelines', 'differentials',
    'pance_yield', 'image_query', 'best_initial_test', 'rx_mechanism', 'rx_side_effects', 'age_demographic', 'gender_bias',
    'patient_education', 'disposition', 'prevention', 'relatedSystems'
  ];

  // Fetch only conditionId and required fields in batches
  const BATCH_SIZE = 200;
  let allContent = [];
  for (let i = 0; i < allConditions.length; i += BATCH_SIZE) {
    const batchIds = allConditions.slice(i, i + BATCH_SIZE).map(c => c.id);
    const batchContent = await prisma.medicalContent.findMany({
      where: { conditionId: { in: batchIds }, status: 'published' },
      select: requiredFields.concat(['conditionId']).reduce((acc, f) => { acc[f] = true; return acc; }, {} as any),
    });
    allContent = allContent.concat(batchContent);
  }
  const contentMap = new Map(allContent.map(c => [c.conditionId, c]));

  // Find conditions missing any required field
  const needsContent: typeof allConditions = [];
  for (const condition of allConditions) {
    const content = contentMap.get(condition.id);
    if (!content) {
      needsContent.push(condition);
      continue;
    }
    // Check for any missing or null/empty required field
    let missing = false;
    for (const field of requiredFields) {
      if (
        !(field in content) ||
        content[field] === null ||
        content[field] === undefined ||
        (Array.isArray(content[field]) && content[field].length === 0) ||
        (typeof content[field] === 'string' && content[field].trim() === '')
      ) {
        missing = true;
        break;
      }
    }
    if (missing) needsContent.push(condition);
  }

  console.log(`📊 Found ${needsContent.length} conditions needing content generation`);

  let generated = 0;
  let errors = 0;

  for (const condition of needsContent) {
    // Get existing content if present
    const existingContent = contentMap.get(condition.id) || {};
    // Determine which fields are missing
    const missingFields = requiredFields.filter(field => {
      return (
        !(field in existingContent) ||
        existingContent[field] === null ||
        existingContent[field] === undefined ||
        (Array.isArray(existingContent[field]) && existingContent[field].length === 0) ||
        (typeof existingContent[field] === 'string' && existingContent[field].trim() === '')
      );
    });
    if (missingFields.length === 0) continue;

    // Generate only the missing fields
    await generateContentForCondition(condition, missingFields, existingContent);
    generated++;
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`📈 Phase 2 Summary: Generated ${generated} content records, ${errors} errors`);

  // After filling gaps, run Phase 1 to add any missing conditions
  await phase1GapAnalysis(targetSystem);

  // Find any new conditions added and generate content for them
  const newConditions = await prisma.condition.findMany({
    where: {
      status: 'published',
      ...(targetSystem ? { system: targetSystem } : {}),
    },
  });
  const newContentMap = new Map((await prisma.medicalContent.findMany({ where: { status: 'published' } })).map(c => [c.conditionId, c]));
  const trulyNew = newConditions.filter(c => !newContentMap.has(c.id));
  if (trulyNew.length > 0) {
    console.log(`\n🆕 Generating content for ${trulyNew.length} newly added conditions...`);
    for (const condition of trulyNew) {
      // Overload: generateContentForCondition(condition, missingFields, existingContent)
      // If missingFields and existingContent are provided, only generate those fields
      const isPartial = arguments.length > 1;
      const missingFields = isPartial ? arguments[1] : null;
      const existingContent = isPartial ? arguments[2] : null;
      console.log(`\n📝 Generating content for: ${condition.name} (${condition.system})${isPartial ? ` [Missing fields: ${missingFields.join(', ')}]` : ''}`);

      // Build a prompt that only asks for the missing fields
      let prompt;
      if (isPartial && missingFields && missingFields.length > 0) {
        prompt = `You are an expert medical educator creating PANCE/PANRE study content for PA students.\n\nGenerate ONLY the following missing fields for:\nCONDITION: ${condition.name}\nSYSTEM: ${SYSTEM_LABELS[condition.system] || condition.system}\nSUBCATEGORY: ${condition.subcategory || 'General'}\n\nReturn ONLY a JSON object with these fields (no markdown, no explanation):\n{\n  ${missingFields.map(f => `"${f}": "..."`).join(',\n  ')}\n}\n\nCRITICAL FORMATTING RULES (apply to all fields):\n1. buzzwords: <5 words each, NO punctuation, trigger-words that immediately suggest diagnosis (e.g., "currant jelly sputum", "splinter hemorrhages", "target lesions")\n2. clinical_pearls: FULL SENTENCES with rationale - these teach the "why" (e.g., "Obtain ECG in all chest pain patients because silent MI is common in diabetics and elderly.")\n3. classic_triad/classic_patient: Brief badges for quick recognition, <8 words each\n4. Markdown: Use **bold** for key terms within prose fields (etiology, pathophysiology, diagnostics, treatment, prognosis)\n5. Arrays: Format array items with category prefixes like "**First-line**: detail" or "**Acute**: complication"\n6. pance_yield: 1=Low (rare), 2=Mid (occasional), 3=High (common/must-know)\n7. relatedSystems: Only include if condition truly spans systems. Use codes: ${SYSTEM_CODES.join(', ')}\n8. synonyms: Include common abbreviations and alternative names\n9. differentials: Include rule_out reasoning for each DDx condition\n\nAll content must be medically accurate and PANCE-relevant.`;
      } else {
        prompt = `You are an expert medical educator creating PANCE/PANRE study content for PA students.\n\nGenerate comprehensive, high-yield medical content for:\nCONDITION: ${condition.name}\nSYSTEM: ${SYSTEM_LABELS[condition.system] || condition.system}\nSUBCATEGORY: ${condition.subcategory || 'General'}\n\nReturn ONLY a JSON object (no markdown, no explanation):\n{ ... }\n\nCRITICAL FORMATTING RULES:\n...existing code...\nAll content must be medically accurate and PANCE-relevant.`;
      }

      try {
        await sleep(2000); // Polite delay
        const response = await callGeminiWithRetry(prompt);
        const content = parseGeminiJson<MedicalContentSchema>(response);

        if (!content) {
          console.log('  ⚠️ Failed to parse content, skipping');
          return;
        }

        // TRANSFORMATION LAYER: Format content for beautiful UI rendering
        const toMarkdownList = (arr: string[] | string | undefined): string | undefined => {
          if (!arr) return undefined;
          if (typeof arr === 'string') return arr;
          if (!Array.isArray(arr) || arr.length === 0) return undefined;
          return arr.map(item => `- ${item}`).join('\n');
        };
        const cleanBadge = (text: string | undefined): string | undefined => {
          if (!text) return undefined;
          return text.replace(/\.$/, '');
        };
        const relatedSystems = (content.relatedSystems && content.relatedSystems.length > 0)
          ? content.relatedSystems
          : [condition.system];
        const cleanBuzzwords = (arr: string[] | undefined): string[] => {
          if (!arr || arr.length === 0) return [];
          return arr.map(b => b.replace(/[.,!?;:]$/g, '').trim());
        };

        // Merge with existing content if partial
        let contentData: any = {};
        if (isPartial && existingContent) {
          // Start with existing content, only update missing fields
          contentData = { ...existingContent };
          for (const field of missingFields) {
            let val = content[field];
            // Apply transformations for markdown fields
            if (["riskFactors","symptoms","physicalExam","differentialDiagnosis","treatment","complications"].includes(field)) {
              val = toMarkdownList(val);
            }
            if (["gold_standard_dx","first_line_rx","classic_patient","best_initial_test"].includes(field)) {
              val = cleanBadge(val);
            }
            if (field === "buzzwords") {
              val = cleanBuzzwords(val);
            }
            contentData[field] = val;
          }
        } else {
          // Build the data payload with all fields (original logic)
          contentData = {
            relatedSystems: relatedSystems,
            overview: content.overview,
            etiology: content.etiology,
            epidemiology: content.epidemiology,
            pathophysiology: content.pathophysiology,
            riskFactors: toMarkdownList(content.riskFactors),
            symptoms: toMarkdownList(content.symptoms),
            physicalExam: toMarkdownList(content.physicalExam),
            diagnostics: content.diagnostics,
            differentialDiagnosis: toMarkdownList(content.differentialDiagnosis),
            treatment: toMarkdownList(content.treatment),
            complications: toMarkdownList(content.complications),
            prognosis: content.prognosis,
            buzzwords: cleanBuzzwords(content.buzzwords),
            classic_triad: content.classic_triad || [],
            clinical_pearls: content.clinical_pearls || [],
            gold_standard_dx: cleanBadge(content.gold_standard_dx),
            first_line_rx: cleanBadge(content.first_line_rx),
            synonyms: content.synonyms || [],
            classic_patient: cleanBadge(content.classic_patient),
            mnemonic: content.mne
