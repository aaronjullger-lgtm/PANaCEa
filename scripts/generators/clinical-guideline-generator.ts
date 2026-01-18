/**
 * Clinical Guideline Generator
 * Creates comprehensive clinical guidelines/scoring tools for PA education
 *
 * Guidelines include: CURB-65, Wells PE, Wells DVT, HEART Score, CHA2DS2-VASc,
 * Ottawa Ankle, Ottawa Knee, Centor, Modified Centor, PERC, San Francisco Syncope, etc.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface GuidelineComponent {
  name: string;
  points: number;
  description: string;
  clinicalNote?: string;
}

interface ScoringMapEntry {
  range: string;
  interpretation: string;
  recommendation: string;
  risk?: string;
}

interface Vignette {
  scenario: string;
  score: number;
  interpretation: string;
  clinicalDecision: string;
}

interface GuidelineData {
  name: string;
  description: string;
  clinicalContext: string;
  maxScore: number;
  components: GuidelineComponent[];
  scoringMap: ScoringMapEntry[];
  vignettes: Vignette[];
}

// Comprehensive list of clinical guidelines important for PA education
const GUIDELINES_TO_GENERATE = [
  // Cardiovascular
  {
    name: 'HEART Score',
    category: 'Cardiovascular',
    description: 'Chest pain risk stratification for ACS',
  },
  {
    name: 'CHA2DS2-VASc Score',
    category: 'Cardiovascular',
    description: 'Stroke risk in atrial fibrillation',
  },
  {
    name: 'HAS-BLED Score',
    category: 'Cardiovascular',
    description: 'Bleeding risk on anticoagulation',
  },
  {
    name: 'Framingham Risk Score',
    category: 'Cardiovascular',
    description: '10-year cardiovascular risk',
  },
  {
    name: 'TIMI Risk Score (STEMI)',
    category: 'Cardiovascular',
    description: 'Mortality risk in STEMI',
  },
  {
    name: 'TIMI Risk Score (NSTEMI/UA)',
    category: 'Cardiovascular',
    description: 'Risk stratification in NSTEMI/UA',
  },
  {
    name: 'Duke Criteria',
    category: 'Cardiovascular',
    description: 'Infective endocarditis diagnosis',
  },

  // Pulmonary/PE/DVT
  {
    name: 'Wells Score for PE',
    category: 'Pulmonary',
    description: 'Pulmonary embolism probability',
  },
  {
    name: 'Wells Score for DVT',
    category: 'Pulmonary',
    description: 'Deep vein thrombosis probability',
  },
  { name: 'Geneva Score (Revised)', category: 'Pulmonary', description: 'PE clinical probability' },
  { name: 'PERC Rule', category: 'Pulmonary', description: 'PE rule-out in low-risk patients' },
  { name: 'CURB-65', category: 'Pulmonary', description: 'Pneumonia severity and disposition' },
  { name: 'PSI/PORT Score', category: 'Pulmonary', description: 'Pneumonia severity index' },

  // Neurology
  {
    name: 'NIH Stroke Scale (NIHSS)',
    category: 'Neurology',
    description: 'Stroke severity assessment',
  },
  { name: 'ABCD2 Score', category: 'Neurology', description: 'TIA stroke risk prediction' },
  {
    name: 'Canadian CT Head Rule',
    category: 'Neurology',
    description: 'CT indication after minor head injury',
  },
  {
    name: 'New Orleans Criteria',
    category: 'Neurology',
    description: 'CT indication after minor head injury',
  },
  {
    name: 'Glasgow Coma Scale',
    category: 'Neurology',
    description: 'Level of consciousness assessment',
  },

  // GI/Hepatology
  { name: 'Ranson Criteria', category: 'GI', description: 'Pancreatitis severity prediction' },
  { name: 'BISAP Score', category: 'GI', description: 'Pancreatitis mortality prediction' },
  {
    name: 'Glasgow-Blatchford Score',
    category: 'GI',
    description: 'Upper GI bleed intervention need',
  },
  { name: 'Rockall Score', category: 'GI', description: 'Upper GI bleed mortality risk' },
  { name: 'Child-Pugh Score', category: 'GI', description: 'Cirrhosis severity and prognosis' },
  { name: 'MELD Score', category: 'GI', description: 'Liver disease severity/transplant priority' },
  { name: 'Alvarado Score', category: 'GI', description: 'Acute appendicitis probability' },

  // Infectious Disease
  { name: 'Centor Criteria', category: 'ID', description: 'Strep pharyngitis probability' },
  {
    name: 'Modified Centor (McIsaac)',
    category: 'ID',
    description: 'Strep pharyngitis with age adjustment',
  },
  { name: 'qSOFA Score', category: 'ID', description: 'Sepsis screening and mortality' },
  { name: 'SOFA Score', category: 'ID', description: 'Organ dysfunction in sepsis' },
  { name: 'SIRS Criteria', category: 'ID', description: 'Systemic inflammatory response' },

  // Orthopedic/MSK
  { name: 'Ottawa Ankle Rules', category: 'MSK', description: 'X-ray indication for ankle injury' },
  { name: 'Ottawa Knee Rules', category: 'MSK', description: 'X-ray indication for knee injury' },
  { name: 'Canadian C-Spine Rule', category: 'MSK', description: 'C-spine imaging after trauma' },
  { name: 'NEXUS Criteria', category: 'MSK', description: 'C-spine clearance without imaging' },

  // Syncope/Other
  {
    name: 'San Francisco Syncope Rule',
    category: 'Syncope',
    description: 'Short-term serious outcome risk',
  },
  { name: 'OESIL Score', category: 'Syncope', description: 'Syncope mortality risk' },
  { name: 'EGSYS Score', category: 'Syncope', description: 'Cardiac vs non-cardiac syncope' },

  // Renal
  { name: 'STONE Score', category: 'Renal', description: 'Ureteral stone probability' },

  // Psychiatry
  { name: 'PHQ-9', category: 'Psychiatry', description: 'Depression severity screening' },
  { name: 'GAD-7', category: 'Psychiatry', description: 'Anxiety severity screening' },
  {
    name: 'Columbia Suicide Severity Rating',
    category: 'Psychiatry',
    description: 'Suicide risk assessment',
  },
  {
    name: 'CAGE Questionnaire',
    category: 'Psychiatry',
    description: 'Alcohol use disorder screening',
  },
  { name: 'AUDIT-C', category: 'Psychiatry', description: 'Alcohol use screening' },

  // Pediatrics
  {
    name: 'PECARN Head CT Rule',
    category: 'Pediatrics',
    description: 'Pediatric head CT after trauma',
  },
  { name: 'Westley Croup Score', category: 'Pediatrics', description: 'Croup severity assessment' },
  {
    name: 'Pediatric Early Warning Score',
    category: 'Pediatrics',
    description: 'Clinical deterioration prediction',
  },

  // Additional PANCE-Relevant Guidelines
  { name: 'APACHE II Score', category: 'Critical Care', description: 'ICU mortality prediction' },
  {
    name: 'CHADS2 Score',
    category: 'Cardiovascular',
    description: 'Stroke risk in atrial fibrillation (simpler version)',
  },
  {
    name: 'Modified Early Warning Score (MEWS)',
    category: 'Critical Care',
    description: 'Early detection of clinical deterioration',
  },
  {
    name: 'Pittsburgh Knee Rules',
    category: 'MSK',
    description: 'X-ray indication for knee injury',
  },
  {
    name: 'FAST Exam criteria',
    category: 'Trauma',
    description: 'Ultrasound assessment for trauma',
  },
  { name: 'APGAR Score', category: 'Obstetrics', description: 'Newborn assessment at birth' },
  { name: 'Bishop Score', category: 'Obstetrics', description: 'Cervical readiness for induction' },
  {
    name: 'STOP-BANG Questionnaire',
    category: 'Sleep Medicine',
    description: 'Obstructive sleep apnea screening',
  },
  {
    name: 'Epworth Sleepiness Scale',
    category: 'Sleep Medicine',
    description: 'Daytime sleepiness assessment',
  },
  { name: 'PAINAD', category: 'Geriatrics', description: 'Pain assessment in advanced dementia' },
  {
    name: 'CAM (Confusion Assessment Method)',
    category: 'Geriatrics',
    description: 'Delirium screening tool',
  },
  {
    name: 'Montreal Cognitive Assessment (MoCA)',
    category: 'Neurology',
    description: 'Cognitive impairment screening',
  },
  {
    name: 'Mini-Mental State Exam (MMSE)',
    category: 'Neurology',
    description: 'Cognitive function screening',
  },
  {
    name: 'FOUR Score',
    category: 'Neurology',
    description: 'Coma assessment (alternative to GCS)',
  },
];

const PROMPT_TEMPLATE = `You are a medical education expert creating clinical decision tools for PA students.

Generate a comprehensive clinical guideline/scoring tool for: "${'{NAME}'}"
Category: ${'{CATEGORY}'}
Purpose: ${'{DESCRIPTION}'}

Create a detailed, accurate clinical guideline with the following structure in JSON format:

{
  "name": "Full official name of the guideline/score",
  "description": "2-3 sentence description of what this tool assesses and when to use it",
  "clinicalContext": "Clinical scenario/setting where this tool is most applicable",
  "maxScore": <maximum possible score as integer, use 0 for categorical/non-numeric tools>,
  "components": [
    {
      "name": "Component/criterion name",
      "points": <point value as integer, use 0 for categorical criteria>,
      "description": "What this component assesses",
      "clinicalNote": "Clinical pearl about this component"
    }
  ],
  "scoringMap": [
    {
      "range": "Score range or category name",
      "interpretation": "What this score/category means",
      "recommendation": "Clinical action/management recommendation",
      "risk": "Specific risk percentage if applicable, or 'Not applicable for categorical criteria'"
    }
  ],
  "vignettes": [
    {
      "scenario": "Brief clinical vignette (2-3 sentences)",
      "score": <calculated score or 0 for categorical>,
      "interpretation": "What the score/category means for this patient",
      "clinicalDecision": "What should be done next"
    }
  ]
}

CRITICAL JSON RULES - THIS IS EXTREMELY IMPORTANT:
- Return ONLY valid JSON with NO markdown formatting
- NEVER put a double quote (") inside a string value
- For apostrophes and possessives: use straight apostrophe (')
  Examples:
  ✓ CORRECT: "description": "The patient's condition improves"
  ✗ WRONG: "description": "The patient"s condition improves"
  ✗ WRONG: "description": "The patient\'s condition improves"
- For comparisons: spell out the words completely
  ✓ CORRECT: "Age greater than 65 years"
  ✗ WRONG: "Age > 65 years"
  ✗ WRONG: "Age ≥ 65 years"
- NO special symbols in strings: avoid >, <, ≥, ≤, ±, ×, ÷, ∞, →
- For categorical tools: set maxScore: 0 and points: 0
- NO null values - use 0 for numbers, use descriptive text like "Not applicable" for strings
- Remove ALL trailing commas before } or ]
- All numbers must be integers (whole numbers only)
- Test that your JSON is valid before submitting

IMPORTANT:
- Use accurate, evidence-based criteria from the actual published guideline
- Include ALL scoring components (don't omit any)
- Provide realistic clinical vignettes (3 examples: low, medium, high-risk)
- Include specific risk percentages where established in literature
- For categorical tools, describe the categories clearly in the range field`;

async function generateGuideline(
  guideline: (typeof GUIDELINES_TO_GENERATE)[0],
  retryCount = 0
): Promise<GuidelineData | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  let prompt = PROMPT_TEMPLATE.replace('{NAME}', guideline.name)
    .replace('{CATEGORY}', guideline.category)
    .replace('{DESCRIPTION}', guideline.description);

  // If this is a retry, use a simplified prompt that's more explicit
  if (retryCount > 0) {
    prompt = `You are a medical expert. Generate a JSON object for the clinical guideline: "${guideline.name}"

Return ONLY a valid JSON object with this EXACT structure (no markdown, no explanations):

{
  "name": "Full guideline name",
  "description": "Brief description",
  "clinicalContext": "When to use this",
  "maxScore": 10,
  "components": [
    {
      "name": "Component name",
      "points": 1,
      "description": "What this assesses",
      "clinicalNote": "Clinical tip"
    }
  ],
  "scoringMap": [
    {
      "range": "0-2",
      "interpretation": "Low risk",
      "recommendation": "Management plan",
      "risk": "5 percent"
    }
  ],
  "vignettes": [
    {
      "scenario": "Patient case",
      "score": 2,
      "interpretation": "Risk level",
      "clinicalDecision": "Next steps"
    }
  ]
}

CRITICAL RULES:
- Use only straight apostrophes (') never curly quotes
- Write "greater than" not ">" symbol
- Write "less than" not "<" symbol
- NO special characters: ≥ ≤ × ÷ → ∞
- NO double quotes inside string values
- Include at least 3 components, 3 scoring ranges, 3 vignettes`;
  }

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON - try to find first complete JSON object
    let jsonStr = text.trim();

    // Remove markdown code blocks if present
    jsonStr = jsonStr
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');

    // Find the JSON object boundaries
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object found in response');
    }

    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

    // Try to parse
    let parsed: GuidelineData;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      // If JSON parsing fails, try to fix common issues
      const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
      console.error(`  ⚠️  JSON parse error: ${errMsg}`);

      // Try multiple fix strategies in sequence
      let fixed = jsonStr;

      // Strategy 1: Clean up the string first
      fixed = fixed
        .replace(/^\uFEFF/, '') // Remove BOM
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\t/g, '  '); // Replace tabs with spaces

      // Strategy 2: Replace problematic symbols BEFORE any quote fixing
      fixed = fixed
        .replace(/≥/g, ' greater than or equal to ')
        .replace(/≤/g, ' less than or equal to ')
        .replace(/>/g, ' greater than ')
        .replace(/</g, ' less than ')
        .replace(/±/g, ' plus or minus ');

      // Strategy 3: Normalize quotes to ASCII (but keep structure intact)
      fixed = fixed
        .replace(/['']/g, "'") // Curly single quotes to straight
        .replace(/[""]/g, '"'); // Curly double quotes to straight

      // Strategy 4: Remove trailing commas
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

      try {
        parsed = JSON.parse(fixed);
        console.log(`  ℹ️  JSON fixed with basic cleanup`);
      } catch (secondError) {
        console.error(`  ⚠️  Basic fix failed, trying string value fix...`);

        // Strategy 5: Fix quotes inside string values using proper parsing
        try {
          // Parse line by line and fix string values
          const lines = fixed.split('\n');
          const fixedLines: string[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check if this line has a string value
            const match = line.match(/^(\s*"[^"]+"\s*:\s*)"(.*)("[\s,]*)$/);

            if (match) {
              const [, prefix, value, suffix] = match;

              // Only fix if there are unescaped quotes in the value
              if (value.includes('"') && !value.includes('\\"')) {
                // Replace internal quotes with single quotes
                const fixedValue = value.replace(/"/g, "'");
                fixedLines.push(prefix + '"' + fixedValue + suffix);
                continue;
              }
            }

            fixedLines.push(line);
          }

          parsed = JSON.parse(fixedLines.join('\n'));
          console.log(`  ℹ️  JSON fixed with string value repair`);
        } catch (thirdError) {
          console.error(`  ⚠️  String value fix failed, trying comprehensive fix...`);

          // Strategy 6: Most aggressive - reconstruct string values
          try {
            let reconstructed = fixed;

            // Find all string values and fix them
            reconstructed = reconstructed.replace(
              /"([^"]+)"\s*:\s*"([^"]*)"/g,
              (match, key, value) => {
                // If value contains unescaped quotes, replace them
                if (value.includes('"')) {
                  const cleanValue = value.replace(/"/g, "'");
                  return `"${key}": "${cleanValue}"`;
                }
                return match;
              }
            );

            // Handle multiline string values (those that span lines)
            const bracketStack: string[] = [];
            let inString = false;
            let stringStart = -1;
            let result = '';

            for (let i = 0; i < reconstructed.length; i++) {
              const char = reconstructed[i];
              const prevChar = i > 0 ? reconstructed[i - 1] : '';

              // Track brackets/braces
              if (!inString) {
                if (char === '{' || char === '[') bracketStack.push(char);
                if (char === '}' || char === ']') bracketStack.pop();
              }

              // Track strings
              if (char === '"' && prevChar !== '\\') {
                if (!inString) {
                  inString = true;
                  stringStart = i;
                } else {
                  inString = false;
                  // Check if this string value had issues
                  const stringContent = reconstructed.substring(stringStart + 1, i);
                  if (stringContent.includes('"')) {
                    // This string had internal quotes - we already fixed it above
                  }
                }
              }

              result += char;
            }

            parsed = JSON.parse(reconstructed);
            console.log(`  ℹ️  JSON fixed with comprehensive reconstruction`);
          } catch (finalError) {
            const finalMsg = finalError instanceof Error ? finalError.message : String(finalError);
            console.error(`  ❌ All JSON fix attempts failed: ${finalMsg}`);

            // Retry with simplified prompt if this is first attempt
            if (retryCount === 0) {
              console.log(`  🔄 Retrying with simplified prompt...`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
              return generateGuideline(guideline, 1);
            }

            return null; // Give up after retry
          }
        }
      }
    }

    // Validate required fields
    if (!parsed.name || !parsed.description || !parsed.clinicalContext) {
      throw new Error('Missing required fields');
    }

    // Ensure maxScore is a valid number (0 for categorical)
    if (typeof parsed.maxScore !== 'number' || parsed.maxScore === null || isNaN(parsed.maxScore)) {
      parsed.maxScore = 0;
    }

    // Ensure all component points are valid numbers (0 for categorical)
    if (parsed.components) {
      parsed.components = parsed.components.map((c) => ({
        ...c,
        points: typeof c.points === 'number' && !isNaN(c.points) ? c.points : 0,
      }));
    }

    // Ensure all vignette scores are valid numbers (0 for categorical)
    if (parsed.vignettes) {
      parsed.vignettes = parsed.vignettes.map((v) => ({
        ...v,
        score: typeof v.score === 'number' && !isNaN(v.score) ? v.score : 0,
      }));
    }

    return parsed;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Error generating ${guideline.name}: ${errorMsg}`);

    // Retry with simplified prompt if this is first attempt
    if (retryCount === 0) {
      console.log(`  🔄 Retrying with simplified prompt...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return generateGuideline(guideline, 1);
    }

    return null;
  }
}

// Fuzzy match names to detect duplicates (handles variations like "TIMI" vs "Thrombolysis In Myocardial Infarction")
function namesMatch(name1: string, name2: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\(\)\-\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Exact match
  if (n1 === n2) return true;

  // Check if one contains the other (for acronyms)
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Check key words match
  const words1 = new Set(n1.split(' ').filter((w) => w.length > 3));
  const words2 = new Set(n2.split(' ').filter((w) => w.length > 3));
  const intersection = [...words1].filter((w) => words2.has(w));

  // If 60%+ of significant words match, consider it a duplicate
  const minWords = Math.min(words1.size, words2.size);
  return minWords > 0 && intersection.length / minWords >= 0.6;
}

async function removeDuplicates() {
  console.log('\n🔍 Checking for duplicates...');

  const all = await prisma.clinicalGuideline.findMany({
    select: { id: true, name: true, createdAt: true },
  });

  const toDelete: string[] = [];
  const seen = new Map<string, (typeof all)[0]>();

  for (const item of all) {
    let isDuplicate = false;

    for (const [key, existing] of seen.entries()) {
      if (namesMatch(item.name, existing.name)) {
        // Keep the older one (earlier createdAt)
        if (item.createdAt > existing.createdAt) {
          console.log(`  🗑️  Duplicate: "${item.name}" (keeping "${existing.name}")`);
          toDelete.push(item.id);
        } else {
          console.log(`  🗑️  Duplicate: "${existing.name}" (keeping "${item.name}")`);
          toDelete.push(existing.id);
          seen.delete(key);
          seen.set(item.name, item);
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      seen.set(item.name, item);
    }
  }

  if (toDelete.length > 0) {
    await prisma.clinicalGuideline.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log(`  ✅ Removed ${toDelete.length} duplicate(s)`);
  } else {
    console.log(`  ✅ No duplicates found`);
  }
}

async function gapAnalysis() {
  console.log('\n📋 Gap Analysis - Missing PANCE-Relevant Guidelines:');
  console.log('='.repeat(60));

  const existing = await prisma.clinicalGuideline.findMany({
    select: { name: true, description: true },
  });

  const missing: typeof GUIDELINES_TO_GENERATE = [];

  for (const guideline of GUIDELINES_TO_GENERATE) {
    const found = existing.some((e) => namesMatch(e.name, guideline.name));
    if (!found) {
      missing.push(guideline);
    }
  }

  if (missing.length > 0) {
    console.log(`\n⚠️  Missing ${missing.length} guidelines:\n`);

    const byCategory = missing.reduce(
      (acc, g) => {
        if (!acc[g.category]) acc[g.category] = [];
        acc[g.category].push(g);
        return acc;
      },
      {} as Record<string, typeof missing>
    );

    for (const [category, items] of Object.entries(byCategory)) {
      console.log(`\n  ${category}:`);
      items.forEach((g) => console.log(`    - ${g.name}: ${g.description}`));
    }
  } else {
    console.log('\n✅ All defined guidelines are present!');
  }

  // Check current database
  console.log('\n\n📊 Current Database Contents:');
  console.log('='.repeat(60));

  const allGuidelines = await prisma.clinicalGuideline.findMany({
    select: { name: true, maxScore: true },
    orderBy: { name: 'asc' },
  });

  console.log(`\nTotal: ${allGuidelines.length} guidelines\n`);
  allGuidelines.forEach((g) => {
    const scoreType = g.maxScore === 0 ? 'categorical' : `max ${g.maxScore}`;
    console.log(`  • ${g.name} (${scoreType})`);
  });

  // Auto-generate additional PANCE-relevant tools if database is reasonably complete
  const additionalSuggestions = [
    {
      name: 'Revised Cardiac Risk Index (RCRI)',
      category: 'Cardiovascular',
      description: 'Perioperative cardiac risk assessment',
    },
    { name: 'Caprini Score', category: 'Hematology', description: 'VTE risk assessment' },
    {
      name: 'Padua Prediction Score',
      category: 'Hematology',
      description: 'VTE risk in medical patients',
    },
    {
      name: 'YEARS Algorithm',
      category: 'Pulmonary',
      description: 'PE diagnosis with age-adjusted D-dimer',
    },
    {
      name: "Light's Criteria",
      category: 'Pulmonary',
      description: 'Pleural effusion classification (exudate vs transudate)',
    },
    {
      name: 'PESI (Pulmonary Embolism Severity Index)',
      category: 'Pulmonary',
      description: 'PE mortality risk stratification',
    },
    {
      name: 'Khorana Score',
      category: 'Hematology',
      description: 'Chemotherapy-associated VTE risk',
    },
    {
      name: 'HOSPITAL Score',
      category: 'General Medicine',
      description: 'Readmission risk prediction',
    },
    { name: 'LACE Index', category: 'General Medicine', description: 'Hospital readmission risk' },
    { name: 'GRACE Score', category: 'Cardiovascular', description: 'ACS mortality and MI risk' },
    { name: 'CRUSADE Score', category: 'Cardiovascular', description: 'Bleeding risk in ACS' },
    {
      name: 'Sgarbossa Criteria',
      category: 'Cardiovascular',
      description: 'MI diagnosis with LBBB',
    },
    {
      name: 'PECARN Abdominal Trauma',
      category: 'Trauma',
      description: 'Pediatric abdominal CT indication after trauma',
    },
    {
      name: 'DKA Severity Criteria',
      category: 'Endocrinology',
      description: 'Diabetic ketoacidosis severity classification',
    },
  ];

  const notInDatabase = additionalSuggestions.filter(
    (s) => !allGuidelines.some((g) => namesMatch(g.name, s.name))
  );

  // Only auto-add if we have good coverage of the main guidelines
  const coveragePercent =
    ((GUIDELINES_TO_GENERATE.length - missing.length) / GUIDELINES_TO_GENERATE.length) * 100;

  if (notInDatabase.length > 0 && coveragePercent >= 90) {
    console.log('\n\n🤖 Auto-Adding Additional Guidelines:');
    console.log('='.repeat(60));
    console.log(`(Database is ${coveragePercent.toFixed(0)}% complete with core guidelines)\n`);

    for (const suggestion of notInDatabase.slice(0, 5)) {
      // Add up to 5 at a time
      console.log(`  🔄 Generating: ${suggestion.name}...`);

      const data = await generateGuideline(suggestion);

      if (!data) {
        console.log(`  ❌ Failed to generate ${suggestion.name}`);
        continue;
      }

      const alreadyExists = allGuidelines.some((g) => namesMatch(g.name, data.name));
      if (alreadyExists) {
        console.log(`  ⏭️  Skipped: ${data.name} (already exists)`);
        continue;
      }

      try {
        await prisma.clinicalGuideline.create({
          data: {
            id: uuidv4(),
            name: data.name,
            description: data.description,
            clinicalContext: data.clinicalContext,
            maxScore: data.maxScore,
            components: data.components as any,
            scoringMap: data.scoringMap as any,
            vignettes: data.vignettes as any,
            updatedAt: new Date(),
          },
        });

        allGuidelines.push({ name: data.name, maxScore: data.maxScore });
        console.log(`  ✅ Added: ${suggestion.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to save ${suggestion.name}: ${error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const remaining = notInDatabase.length - 5;
    if (remaining > 0) {
      console.log(`\n  ℹ️  ${remaining} more suggestions available - run again to add more`);
    }
  } else if (notInDatabase.length > 0) {
    console.log(
      '\n\n💡 Suggested Additional Guidelines (will auto-add when core guidelines are 90%+ complete):'
    );
    console.log('='.repeat(60));
    console.log(`Current coverage: ${coveragePercent.toFixed(0)}%\n`);
    notInDatabase.forEach((s) => console.log(`  • ${s.name}: ${s.description}`));
  }
}

async function main() {
  console.log('🏥 Clinical Guideline Generator');
  console.log('='.repeat(60));

  // First, remove duplicates
  await removeDuplicates();

  console.log(`\n\nGenerating ${GUIDELINES_TO_GENERATE.length} clinical guidelines...\n`);

  // Get existing with better matching
  const existing = await prisma.clinicalGuideline.findMany({
    select: { name: true, id: true },
  });

  console.log(`Found ${existing.length} existing guidelines\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const guideline of GUIDELINES_TO_GENERATE) {
    // Check if exists using fuzzy matching
    const alreadyExists = existing.some((e) => namesMatch(e.name, guideline.name));

    if (alreadyExists) {
      console.log(`  ⏭️  Skipped: ${guideline.name} (exists)`);
      skipped++;
      continue;
    }

    console.log(`  🔄 Creating: ${guideline.name}...`);

    const data = await generateGuideline(guideline);

    if (!data) {
      failed++;
      continue;
    }

    // Double-check generated name doesn't match existing
    const generatedNameExists = existing.some((e) => namesMatch(e.name, data.name));
    if (generatedNameExists) {
      console.log(`  ⏭️  Skipped: ${data.name} (AI generated duplicate name)`);
      skipped++;
      continue;
    }

    try {
      await prisma.clinicalGuideline.create({
        data: {
          id: uuidv4(),
          name: data.name,
          description: data.description,
          clinicalContext: data.clinicalContext,
          maxScore: data.maxScore,
          components: data.components as any,
          scoringMap: data.scoringMap as any,
          vignettes: data.vignettes as any,
          updatedAt: new Date(),
        },
      });

      // Add to existing list to prevent duplicates within this run
      existing.push({ id: uuidv4(), name: data.name });

      created++;
      console.log(`  ✅ Created: ${guideline.name}`);
    } catch (error) {
      console.error(`  ❌ Failed to save ${guideline.name}: ${error}`);
      failed++;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);

  const total = await prisma.clinicalGuideline.count();
  console.log(`   Total guidelines in database: ${total}`);

  // Run gap analysis
  await gapAnalysis();

  await prisma.$disconnect();
}

main().catch(console.error);
