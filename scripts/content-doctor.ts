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
import { v4 as uuidv4 } from 'uuid';
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
const SYSTEM_CODES = [
  'CV',
  'PULM',
  'GI',
  'NEURO',
  'MSK',
  'DERM',
  'HEME',
  'ENDO',
  'HEENT',
  'RENAL',
  'REPRO',
  'PSYCH',
  'ID',
  'GU',
] as const;
type SystemCode = (typeof SYSTEM_CODES)[number];

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
const RATE_LIMIT_DELAY = 200; // 200ms between requests (Flash can handle higher throughput)
const CONCURRENT_BATCH_SIZE = 10; // Process 10 conditions concurrently
const BATCH_DELAY = 1000; // 1 second between batches

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  return `${system}__${sanitize(subcategory || 'general')}__${sanitize(name)}`;
}

/**
 * Parse JSON from Gemini response, handling markdown code blocks and malformed JSON
 */
function parseGeminiJson<T>(text: string): T | null {
  try {
    // Remove markdown code blocks if present
    let cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Try standard parse first
    try {
      return JSON.parse(cleaned);
    } catch (firstError) {
      // Attempt to fix common JSON issues

      // Fix unescaped quotes in strings (but not in property names)
      // This is a heuristic - look for patterns like: "text with "quotes" inside"
      cleaned = cleaned.replace(
        /("(?:[^"\\]|\\.)*?")\s*:\s*"((?:[^"\\]|\\.)*)"/g,
        (match, key, value) => {
          // Escape unescaped quotes in the value
          const fixedValue = value.replace(/(?<!\\)"/g, '\\"');
          return `${key}: "${fixedValue}"`;
        }
      );

      // Fix trailing commas
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

      // Fix single quotes (should be double quotes)
      cleaned = cleaned.replace(/'/g, '"');

      // Try parsing again
      return JSON.parse(cleaned);
    }
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    if (text.length < 1000) {
      console.error('Response text:', text);
    } else {
      console.error('Response text (first 500 chars):', text.substring(0, 500));
    }
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

  const isPartial = missingFields && missingFields.length > 0;

  let prompt: string;

  if (isPartial) {
    console.log(`  🔧 Partial update mode - regenerating ${missingFields.length} fields`);
    console.log(
      `     Fields to generate: ${missingFields.slice(0, 10).join(', ')}${missingFields.length > 10 ? '...' : ''}`
    );

    // Create a minimal prompt that only asks for the missing fields
    prompt = `You are an expert medical educator creating PANCE/PANRE study content for PA students.

Generate ONLY the following missing fields for:
CONDITION: ${condition.name}
SYSTEM: ${SYSTEM_LABELS[condition.system] || condition.system}
SUBCATEGORY: ${condition.subcategory || 'General'}

Return ONLY a valid JSON object with ONLY these fields (no markdown, no code blocks, no explanation):
{
${missingFields
  .map((field) => {
    if (field === 'mnemonic') return '  "mnemonic": "Memory aid if one exists, else null"';
    if (field === 'guidelines')
      return '  "guidelines": "Relevant guideline name and year, else null"';
    if (field === 'classic_triad') return '  "classic_triad": ["Sign 1", "Sign 2", "Sign 3"]';
    if (field === 'relatedSystems') return '  "relatedSystems": ["SYSTEM_CODE"]';
    return `  "${field}": "..."`;
  })
  .join(',\n')}
}

CRITICAL RULES:
- Return ONLY valid JSON (no markdown, no \`\`\`json blocks)
- For mnemonic: provide a helpful memory aid OR null if none exists
- For guidelines: provide guideline name and year (e.g., "2023 AHA Guidelines") OR null
- For classic_triad: provide 2-4 key signs/symptoms as an array
- For relatedSystems: only include if truly multi-system (use codes: ${SYSTEM_CODES.join(', ')})
- All content must be medically accurate and PANCE-relevant`;
  } else {
    prompt = `You are an expert medical educator creating PANCE/PANRE study content for PA students.

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
  }

  try {
    await sleep(200); // Minimal delay for Flash model with concurrency
    const response = await callGeminiWithRetry(prompt);
    const content = parseGeminiJson<any>(response);

    if (!content) {
      console.log('  ❌ Failed to parse content');
      return;
    }

    // TRANSFORMATION HELPERS
    const toMarkdownList = (val: any): string | undefined => {
      if (!val) return undefined;
      if (typeof val === 'string') return val;
      if (Array.isArray(val) && val.length > 0) {
        return val.map((item) => `- ${item}`).join('\n');
      }
      return undefined;
    };

    const cleanBadge = (val: any): string | undefined => {
      if (!val || typeof val !== 'string') return undefined;
      return val.replace(/\.$/, '');
    };

    const cleanBuzzwords = (val: any): string[] => {
      if (!val || !Array.isArray(val)) return [];
      return val.map((b: string) => b.replace(/[.,!?;:]$/g, '').trim());
    };

    const parsePanceYield = (val: any): number | null => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.includes('high') || lower.includes('3')) return 3;
        if (lower.includes('mid') || lower.includes('medium') || lower.includes('2')) return 2;
        if (lower.includes('low') || lower.includes('1')) return 1;
      }
      return null;
    };

    // Build upsert data
    let upsertData: any = {};

    if (isPartial && existingContent) {
      // Partial update - merge with existing
      upsertData = { ...existingContent };

      for (const field of missingFields!) {
        let val = content[field];
        if (val === undefined || val === null) continue;

        // Apply transformations based on schema type
        if (
          [
            'riskFactors',
            'symptoms',
            'physicalExam',
            'differentialDiagnosis',
            'treatment',
            'complications',
          ].includes(field)
        ) {
          val = toMarkdownList(val);
        } else if (field === 'diagnostics') {
          // diagnostics can come as array but must be stored as Text
          val = toMarkdownList(val) || (typeof val === 'string' ? val : undefined);
        } else if (field === 'rx_side_effects') {
          // rx_side_effects can come as array but must be stored as Text
          val = toMarkdownList(val) || (typeof val === 'string' ? val : undefined);
        } else if (
          ['gold_standard_dx', 'first_line_rx', 'classic_patient', 'best_initial_test'].includes(
            field
          )
        ) {
          val = cleanBadge(val);
        } else if (field === 'buzzwords') {
          val = cleanBuzzwords(val);
        } else if (field === 'pance_yield') {
          val = parsePanceYield(val);
        } else if (field === 'relatedSystems') {
          val = val && Array.isArray(val) && val.length > 0 ? val : [condition.system];
        }

        if (val !== undefined && val !== null) {
          upsertData[field] = val;
        }
      }
    } else {
      // Full generation
      const relatedSystems =
        content.relatedSystems &&
        Array.isArray(content.relatedSystems) &&
        content.relatedSystems.length > 0
          ? content.relatedSystems
          : [condition.system];

      upsertData = {
        relatedSystems,
        overview: content.overview,
        etiology: content.etiology,
        epidemiology: content.epidemiology,
        pathophysiology: content.pathophysiology,
        riskFactors: toMarkdownList(content.riskFactors),
        symptoms: toMarkdownList(content.symptoms),
        physicalExam: toMarkdownList(content.physicalExam),
        diagnostics: toMarkdownList(content.diagnostics) || content.diagnostics,
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
        mnemonic: content.mnemonic || null,
        guidelines: content.guidelines || null,
        differentials: content.differentials || [],
        pance_yield: parsePanceYield(content.pance_yield),
        image_query: content.image_query || null,
        best_initial_test: cleanBadge(content.best_initial_test),
        rx_mechanism: content.rx_mechanism || null,
        rx_side_effects: toMarkdownList(content.rx_side_effects) || content.rx_side_effects || null,
        age_demographic: content.age_demographic || [],
        gender_bias: content.gender_bias || null,
        patient_education: content.patient_education || null,
        disposition: content.disposition || null,
        prevention: content.prevention || null,
      };
    }

    // Upsert to database
    await prisma.medicalContent.upsert({
      where: { conditionId: condition.id },
      create: {
        conditionId: condition.id,
        system: condition.system,
        subcategory: condition.subcategory || 'General',
        condition: condition.name,
        ...upsertData,
        status: 'published',
        createdBy: 'content-doctor',
        updatedBy: 'content-doctor',
      },
      update: {
        ...upsertData,
        updatedBy: 'content-doctor',
      },
    });

    console.log(`  ✅ Generated successfully`);
  } catch (error) {
    console.log(`  ❌ Error generating content: ${error}`);
    throw error;
  }
}

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
        OR: [{ system }, { relatedSystems: { has: system } }],
      },
      select: { name: true, subcategory: true },
    });

    const conditionList = existingConditions.map((c) => c.name).join('\n- ');
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
            } as any,
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
  console.log(
    `📈 Phase 1 Summary: Found ${totalGaps} gaps, registered ${totalRegistered} new conditions`
  );
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
  buzzwords: string[]; // <5 words each, no punctuation
  classic_triad: string[]; // 2-4 cardinal signs
  clinical_pearls: string[]; // Full sentences with rationale
  gold_standard_dx: string; // Single definitive test
  first_line_rx: string; // First-line treatment

  // Search & Discovery
  synonyms?: string[]; // Alternative names ["GCA", "Temporal Arteritis"]
  classic_patient?: string; // Demographic snapshot "Elderly female with jaw claudication"
  mnemonic?: string; // Memory aid if applicable
  guidelines?: string; // "2023 AHA Guidelines", "USPSTF Grade A"

  // Structured Differentials
  differentials?: Array<{
    // Enhanced DDx with rule-out logic
    condition: string;
    rule_out: string; // Key differentiating feature
  }>;

  // Study Prioritization
  pance_yield?: number; // 1=Low, 2=Mid, 3=High
  image_query?: string; // Search term for educational images

  // Diagnostic Nuance
  best_initial_test?: string; // Screening/initial workup test

  // Pharmacology Context
  rx_mechanism?: string; // MOA of first-line treatment
  rx_side_effects?: string; // Top adverse effects to know

  // Demographics
  age_demographic?: string[]; // ["Elderly", "Adult"] or ["Child", "Adolescent"]
  gender_bias?: string; // "Female > Male (9:1)" or "No significant bias"

  // Clinical Management
  patient_education?: string; // Key counseling points
  disposition?: string; // Admission criteria / outpatient management
  prevention?: string; // Screening/prevention recommendations

  // Multi-system tagging
  relatedSystems?: string[]; // Additional systems involved
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
  // CORE REQUIRED FIELDS - Essential clinical content that MUST be present
  const requiredFields = [
    'overview',
    'etiology',
    'epidemiology',
    'pathophysiology',
    'riskFactors',
    'symptoms',
    'physicalExam',
    'diagnostics',
    'differentialDiagnosis',
    'treatment',
    'complications',
    'prognosis',
    'buzzwords',
    'clinical_pearls',
    'gold_standard_dx',
    'first_line_rx',
    'synonyms',
    'classic_patient',
    'differentials',
    'pance_yield',
    'image_query',
    'best_initial_test',
    'rx_mechanism',
    'rx_side_effects',
    'age_demographic',
    'gender_bias',
    'patient_education',
    'disposition',
    'prevention',
    'mnemonic',
    'classic_triad',
    'guidelines',
    'relatedSystems',
  ];

  // OPTIONAL FIELDS - Not all conditions have these
  // Missing these should NOT trigger regeneration
  const optionalFields: string[] = [];

  // MEDIA FIELDS - Fields that require manual upload/processing (NOT generated by AI)
  // These should NOT be checked for completeness to avoid infinite regeneration loops
  const mediaFields = ['image_url', 'image_caption', 'image_source'];

  console.log('ℹ️  Checking only REQUIRED fields (excluding optional/media)');
  console.log('   Optional fields (not checked):', optionalFields.join(', '));
  console.log('   Media fields (not checked):', mediaFields.join(', '));

  // Fetch only conditionId and required fields in batches
  const BATCH_SIZE = 200;
  let allContent = [];
  const fieldsToFetch = [...requiredFields, ...optionalFields]; // Fetch all to check properly
  for (let i = 0; i < allConditions.length; i += BATCH_SIZE) {
    const batchIds = allConditions.slice(i, i + BATCH_SIZE).map((c) => c.id);
    const batchContent = await prisma.medicalContent.findMany({
      where: { conditionId: { in: batchIds }, status: 'published' },
      select: fieldsToFetch.concat(['conditionId']).reduce((acc, f) => {
        acc[f] = true;
        return acc;
      }, {} as any),
    });
    allContent = allContent.concat(batchContent);
  }
  const contentMap = new Map(allContent.map((c) => [c.conditionId, c]));

  // Find conditions missing any REQUIRED field (not optional fields)
  const needsContent: typeof allConditions = [];
  for (const condition of allConditions) {
    const content = contentMap.get(condition.id);
    if (!content) {
      needsContent.push(condition);
      continue;
    }
    // Check for any missing or null/empty REQUIRED field (skip optional fields)
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

  // Process in concurrent batches for better performance
  for (let i = 0; i < needsContent.length; i += CONCURRENT_BATCH_SIZE) {
    const batch = needsContent.slice(i, i + CONCURRENT_BATCH_SIZE);
    console.log(
      `\n🔄 Processing batch ${Math.floor(i / CONCURRENT_BATCH_SIZE) + 1}/${Math.ceil(needsContent.length / CONCURRENT_BATCH_SIZE)} (${batch.length} conditions)...`
    );

    const promises = batch.map(async (condition) => {
      try {
        // Get existing content if present
        const existingContent = contentMap.get(condition.id) || {};
        // Determine which fields are missing (excluding media fields)
        const missingFields = requiredFields.filter((field) => {
          return (
            !(field in existingContent) ||
            existingContent[field] === null ||
            existingContent[field] === undefined ||
            (Array.isArray(existingContent[field]) && existingContent[field].length === 0) ||
            (typeof existingContent[field] === 'string' && existingContent[field].trim() === '')
          );
        });

        // Skip if no AI-generatable fields are missing
        if (missingFields.length === 0) return { success: true, skipped: true };

        // IMPROVED DEBUGGING: Show exactly which fields are missing
        console.log(`  📋 Missing fields for ${condition.name}: ${missingFields.join(', ')}`);

        // Generate only the missing fields
        await generateContentForCondition(condition, missingFields, existingContent);
        return { success: true, skipped: false };
      } catch (error) {
        console.error(`  ❌ Error processing ${condition.name}:`, error);
        return { success: false, skipped: false };
      }
    });

    const results = await Promise.all(promises);
    generated += results.filter((r) => r.success && !r.skipped).length;
    errors += results.filter((r) => !r.success).length;

    // Delay between batches to avoid rate limiting
    if (i + CONCURRENT_BATCH_SIZE < needsContent.length) {
      await sleep(BATCH_DELAY);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`📈 Phase 2 Summary: Generated ${generated} content records, ${errors} errors`);
}

// ============================================================================
// FIELD-SPECIFIC REGENERATION
// ============================================================================

async function regenerateField(fieldName: string, targetSystem?: string) {
  console.log(`🔑 Starting ${fieldName} regeneration...\n`);

  // Build query based on field type
  const whereClause: any = {
    AND: [targetSystem ? { system: targetSystem } : {}],
  };

  // Handle different field types
  if (fieldName === 'buzzwords' || fieldName === 'clinical_pearls') {
    whereClause.AND.push({
      OR: [{ [fieldName]: { isEmpty: true } }, { [fieldName]: { has: 'NONE' } }],
    });
  } else if (fieldName === 'classic_triad') {
    // JSONB field
    whereClause.AND.push({
      OR: [{ [fieldName]: null }, { [fieldName]: { equals: null } }],
    });
  } else {
    // String fields
    whereClause.AND.push({
      OR: [{ [fieldName]: null }, { [fieldName]: 'NONE' }, { [fieldName]: '' }],
    });
  }

  const conditions = await prisma.medicalContent.findMany({
    where: whereClause,
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      overview: true,
      symptoms: true,
      physicalExam: true,
    },
  });

  console.log(`Found ${conditions.length} conditions needing ${fieldName}`);

  if (conditions.length === 0) {
    console.log(`✅ All conditions have ${fieldName}!`);
    return;
  }

  let generated = 0;
  let errors = 0;

  // Process in concurrent batches
  for (let i = 0; i < conditions.length; i += CONCURRENT_BATCH_SIZE) {
    const batch = conditions.slice(i, i + CONCURRENT_BATCH_SIZE);
    console.log(
      `\n📦 Processing batch ${Math.floor(i / CONCURRENT_BATCH_SIZE) + 1}/${Math.ceil(conditions.length / CONCURRENT_BATCH_SIZE)} (${batch.length} conditions)...`
    );

    const promises = batch.map(async (condition) => {
      try {
        const prompt = generateFieldPrompt(fieldName, condition);
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const data = parseGeminiJson<any>(text);

        if (!data || !data[fieldName]) {
          console.error(`  ⚠️  ${condition.conditionId}: Failed to parse ${fieldName}`);
          return { success: false };
        }

        // Update only the specific field
        await prisma.medicalContent.update({
          where: { id: condition.id },
          data: { [fieldName]: data[fieldName] },
        });

        const count = Array.isArray(data[fieldName]) ? data[fieldName].length : 1;
        console.log(`  ✅ ${condition.conditionId}: Added ${count} ${fieldName}`);
        await sleep(RATE_LIMIT_DELAY);
        return { success: true };
      } catch (error) {
        console.error(`  ❌ ${condition.conditionId}:`, error);
        return { success: false };
      }
    });

    const results = await Promise.all(promises);
    generated += results.filter((r) => r.success).length;
    errors += results.filter((r) => !r.success).length;

    if (i + CONCURRENT_BATCH_SIZE < conditions.length) {
      await sleep(BATCH_DELAY);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`📈 ${fieldName} Summary: Generated ${generated}, ${errors} errors`);
}

function generateFieldPrompt(fieldName: string, condition: any): string {
  const baseContext = `Condition: ${condition.condition}
System: ${condition.system}
Overview: ${condition.overview || 'Not provided'}`;

  const prompts: Record<string, string> = {
    buzzwords: `You are a medical education expert creating high-yield PANCE exam preparation content.

Generate ONLY the buzzwords field for this condition:

${baseContext}

Return ONLY a JSON object with this exact structure:
{
  "buzzwords": ["buzzword1", "buzzword2", "buzzword3", ...]
}

Buzzwords should be:
- Highly specific diagnostic clues or pathognomonic findings
- What PA students MUST recognize on the PANCE
- Classic presentations, lab values, imaging findings, or physical exam findings
- 3-8 memorable items

Examples: "Boot-shaped heart on CXR", "Strawberry tongue", "Target sign on imaging"

Return ONLY valid JSON, no markdown, no explanation.`,

    mnemonic: `You are a medical education expert creating memory aids for PA students.

Generate a mnemonic for this condition:

${baseContext}

Return ONLY a JSON object:
{
  "mnemonic": "SHORT acronym with explanation (e.g., MUDPILES for metabolic acidosis: Methanol, Uremia, DKA...)"
}

Requirements:
- Must be memorable and commonly used in medical education
- Include the acronym AND what each letter stands for
- If no standard mnemonic exists, return "NONE"

Return ONLY valid JSON, no markdown.`,

    guidelines: `You are a medical education expert familiar with clinical practice guidelines.

Generate the most relevant clinical guideline for this condition:

${baseContext}

Return ONLY a JSON object:
{
  "guidelines": "YYYY Organization Guideline Name (e.g., 2023 AHA/ACC/HFSA Heart Failure Guideline)"
}

Requirements:
- Use the most recent, authoritative guideline
- Include year, organization, and specific guideline name
- Commonly cited on PANCE (AHA, ACC, USPSTF, CDC, ACOG, etc.)
- If no specific guideline exists, return "NONE"

Return ONLY valid JSON, no markdown.`,

    classic_triad: `You are a medical education expert creating PANCE study materials.

Generate the classic triad (3-4 cardinal features) for this condition:

${baseContext}

Return ONLY a JSON object:
{
  "classic_triad": ["Feature 1", "Feature 2", "Feature 3"]
}

Requirements:
- 3-4 most distinctive clinical features
- Must be commonly tested on PANCE
- Can include symptoms, signs, or diagnostic findings
- Should help distinguish from similar conditions

Return ONLY valid JSON, no markdown.`,

    clinical_pearls: `You are a medical education expert creating clinical pearls for PA students.

Generate 3-5 high-yield clinical pearls for this condition:

${baseContext}

Return ONLY a JSON object:
{
  "clinical_pearls": [
    "Pearl 1: Full sentence with clinical insight",
    "Pearl 2: Another actionable clinical tip",
    ...
  ]
}

Requirements:
- Each pearl should be a complete sentence
- Focus on diagnostic pitfalls, treatment pearls, or test-taking strategies
- Must be clinically accurate and PANCE-relevant
- 3-5 pearls per condition

Return ONLY valid JSON, no markdown.`,
  };

  return prompts[fieldName] || prompts.buzzwords;
}

async function regenerateBuzzwords(targetSystem?: string) {
  // Keep old function for backward compatibility
  await regenerateField('buzzwords', targetSystem);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const runPhase1 = args.includes('--phase1');
  const runPhase2 = args.includes('--phase2');
  const runBuzzwords = args.includes('--buzzwords');
  const runMnemonics = args.includes('--mnemonics');
  const runGuidelines = args.includes('--guidelines');
  const runTriads = args.includes('--triads');
  const runPearls = args.includes('--pearls');
  const systemArg = args.find((arg) => arg.startsWith('--system='));
  const targetSystem = systemArg ? systemArg.split('=')[1] : undefined;

  console.log('🩺 PANaCEa Content Doctor Starting...\n');
  console.log('Available flags:');
  console.log('  --phase1            Run gap analysis');
  console.log('  --phase2            Run full content generation');
  console.log('  --buzzwords         Regenerate buzzwords only');
  console.log('  --mnemonics         Regenerate mnemonics only');
  console.log('  --guidelines        Regenerate guidelines only');
  console.log('  --triads            Regenerate classic triads only');
  console.log('  --pearls            Regenerate clinical pearls only');
  console.log('  --system=CODE       Target specific system (CV, PULM, etc.)\n');

  if (targetSystem) {
    console.log(`🎯 Target System: ${SYSTEM_LABELS[targetSystem] || targetSystem}`);
  }

  try {
    if (runBuzzwords) {
      await regenerateField('buzzwords', targetSystem);
    } else if (runMnemonics) {
      await regenerateField('mnemonic', targetSystem);
    } else if (runGuidelines) {
      await regenerateField('guidelines', targetSystem);
    } else if (runTriads) {
      await regenerateField('classic_triad', targetSystem);
    } else if (runPearls) {
      await regenerateField('clinical_pearls', targetSystem);
    } else if (runPhase1) {
      await phase1GapAnalysis(targetSystem);
    } else if (runPhase2) {
      await phase2ContentGeneration(targetSystem);
    } else {
      // Default: Run both phases
      await phase1GapAnalysis(targetSystem);
      await phase2ContentGeneration(targetSystem);
    }

    console.log('\n✅ Content Doctor completed successfully!');
  } catch (error) {
    console.error('\n❌ Content Doctor encountered an error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
