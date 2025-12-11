// scripts/fixIncompleteConditions.ts
// Script to fix incomplete conditions by generating missing sections using Gemini

import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.5-pro";
const INPUT_FILE = path.resolve("conditionContent.generated.json");
const OUTPUT_FILE = path.resolve("conditionContent.generated.json");
const MAX_RETRIES = 3;
const DELAY_BETWEEN_REQUESTS = 2000; // 2 second delay
const PLACEHOLDER_VALUE = "--";

// ======================================================
// REQUIRED SECTIONS
// ======================================================
const envPath = path.resolve(process.cwd(), '.env');
let envConfig: any = {};
if (fs.existsSync(envPath)) {
  envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, val] = line.split('=');
    if (key && val) acc[key.trim()] = val.trim().replace(/^"|"$/g, '');
    return acc;
  }, {} as any);
}

// ======================================================
const REQUIRED_SECTIONS = [
  "overview",
  "diagnostics",
  "etiologyPathophysiology",
  "epidemiology",
  "riskFactors",
  "clinicalPresentation",
  "symptoms",
  "examFindings",
  "treatment",
  "management",
  "complications",
  "prognosis",
] as const;

type SectionName = (typeof REQUIRED_SECTIONS)[number];

// ======================================================
// API KEY (optional - if not provided, will use placeholder content)
// ======================================================
const apiKey = envConfig.API_KEY || envConfig.GOOGLE_API_KEY || envConfig.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";

let client: GoogleGenAI | null = null;
// let model: any = null;

if (apiKey) {
  // Use default apiVersion
  client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 600000 } });
  
  // Polyfill for client.generativeModel if it doesn't exist (it doesn't in v1.32.0)
  // This allows us to use the syntax requested by the user while mapping to the actual SDK methods
  if (typeof (client as any).generativeModel !== 'function') {
    (client as any).generativeModel = (modelName: string) => ({
      generateContent: async (prompt: any) => {
        const contents = typeof prompt === 'string' 
          ? [{ role: 'user', parts: [{ text: prompt }] }] 
          : (Array.isArray(prompt) ? prompt : [prompt]);
          
        return client!.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            httpOptions: { timeout: 600000 }
          }
        });
      }
    });
  }

  console.log("✅ Gemini API key found - will generate content with AI");
} else {
  console.log("[WARNING] No Gemini API key found - will use placeholder content");
}

// ======================================================
// ASCII CLEANER
// ======================================================
function asciiClean(str: string = ""): string {
  return str
    .normalize("NFKC")
    .replace(/[""„‟]/g, '"')
    .replace(/[''‚‛]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\x7F]/g, "");
}

// ======================================================
// CONDITION INTERFACE
// ======================================================
interface ConditionContent {
  diagnostics?: { notes?: string };
  overview?: string;
  etiologyPathophysiology?: string;
  epidemiology?: string;
  riskFactors?: string[];
  clinicalPresentation?: string;
  symptoms?: string[];
  examFindings?: string[];
  treatment?: string[];
  management?: string[];
  complications?: string[];
  prognosis?: string;
  aliases?: string[];
  [key: string]: unknown;
}

interface ConditionItem {
  conditionId: string;
  condition: string;
  content: ConditionContent;
}

// ======================================================
// CHECK IF SECTION IS VALID
// ======================================================
function isValidSection(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Check if it's empty or a placeholder value
    if (trimmed.length === 0 || trimmed === PLACEHOLDER_VALUE) return false;
    // Check if it contains "Content to be generated" placeholder text
    if (trimmed.includes("Content to be generated")) return false;
    if (trimmed.includes("To be populated")) return false;
    if (trimmed.includes("PLACEHOLDER")) return false;
    if (trimmed === "--") return false;
    return true;
  }
  
  if (Array.isArray(value)) {
    // Check if array is empty or only contains placeholder values
    if (value.length === 0) return false;
    // Filter out placeholder values and check if anything remains
    const nonPlaceholderValues = value.filter(
      (item) => item !== PLACEHOLDER_VALUE && item?.toString().trim() !== PLACEHOLDER_VALUE
    );
    return nonPlaceholderValues.length > 0;
  }
  
  if (typeof value === "object") {
    const str = JSON.stringify(value);
    if (str.includes("To be populated") || str.includes("Content to be generated") || str.includes("PLACEHOLDER") || str.includes('"--"')) {
      return false;
    }
    
    const obj = value as Record<string, unknown>;
    if ("notes" in obj && typeof obj.notes === "string") {
      const trimmed = obj.notes.trim();
      // Check if notes is empty, placeholder, or contains "Content to be generated"
      if (trimmed.length === 0 || trimmed === PLACEHOLDER_VALUE) return false;
      if (trimmed.includes("Content to be generated")) return false;
      if (trimmed.includes("To be populated")) return false;
      if (trimmed.includes("PLACEHOLDER")) return false;
      return true;
    }
    return Object.keys(obj).length > 0;
  }
  
  return false;
}

// ======================================================
// FIND INCOMPLETE CONDITIONS
// ======================================================
function findIncompleteConditions(
  conditions: ConditionItem[]
): Array<{ index: number; item: ConditionItem; missingSections: SectionName[] }> {
  const incomplete: Array<{ index: number; item: ConditionItem; missingSections: SectionName[] }> = [];

  conditions.forEach((item, index) => {
    const missingSections: SectionName[] = [];
    const content = item.content || {};

    for (const section of REQUIRED_SECTIONS) {
      if (!isValidSection(content[section])) {
        missingSections.push(section);
      }
    }

    if (missingSections.length > 0) {
      incomplete.push({ index, item, missingSections });
    }
  });

  return incomplete;
}

// ======================================================
// EXTRACT CONDITION NAME FROM ID
// ======================================================
function extractConditionName(conditionId: string): string {
  // ID format: SYSTEM__subcategory__condition_name
  const parts = conditionId.split("__");
  if (parts.length >= 2) {
    // Get the last part and convert underscores to spaces, capitalize
    return parts[parts.length - 1]
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return conditionId;
}

// ======================================================
// GENERATE PLACEHOLDER CONTENT FOR MISSING SECTIONS
// ======================================================
function generatePlaceholderSections(
  conditionName: string,
  missingSections: SectionName[]
): Partial<ConditionContent> {
  // const conditionName = extractConditionName(conditionId);
  const result: Partial<ConditionContent> = {};

  for (const section of missingSections) {
    switch (section) {
      case "diagnostics":
        result.diagnostics = {
          notes: `Diagnostic workup for ${conditionName}. Content to be generated.`,
        };
        break;
      case "overview":
        result.overview = `${conditionName} overview. Content to be generated.`;
        break;
      case "etiologyPathophysiology":
        result.etiologyPathophysiology = `Etiology and pathophysiology of ${conditionName}. Content to be generated.`;
        break;
      case "epidemiology":
        result.epidemiology = `Epidemiology of ${conditionName}. Content to be generated.`;
        break;
      case "riskFactors":
        result.riskFactors = [PLACEHOLDER_VALUE];
        break;
      case "clinicalPresentation":
        result.clinicalPresentation = `Clinical presentation of ${conditionName}. Content to be generated.`;
        break;
      case "symptoms":
        result.symptoms = [PLACEHOLDER_VALUE];
        break;
      case "examFindings":
        result.examFindings = [PLACEHOLDER_VALUE];
        break;
      case "treatment":
        result.treatment = [PLACEHOLDER_VALUE];
        break;
      case "management":
        result.management = [PLACEHOLDER_VALUE];
        break;
      case "complications":
        result.complications = [PLACEHOLDER_VALUE];
        break;
      case "prognosis":
        result.prognosis = `Prognosis for ${conditionName}. Content to be generated.`;
        break;
    }
  }

  return result;
}

// ======================================================
// GENERATE MISSING SECTIONS WITH GEMINI
// ======================================================
async function generateMissingSections(
  conditionName: string,
  existingContent: ConditionContent,
  missingSections: SectionName[]
): Promise<Partial<ConditionContent> | null> {
  // If no API key, return placeholder content
  if (!client) {
    return generatePlaceholderSections(conditionName, missingSections);
  }

  // const conditionName = extractConditionName(conditionId);

  // Build context from existing content
  let existingContext = "";
  if (existingContent.overview) {
    existingContext += `Overview: ${existingContent.overview}\n\n`;
  }
  if (existingContent.etiologyPathophysiology) {
    existingContext += `Etiology: ${existingContent.etiologyPathophysiology}\n\n`;
  }
  if (
    existingContent.diagnostics &&
    typeof existingContent.diagnostics === "object" &&
    "notes" in existingContent.diagnostics
  ) {
    existingContext += `Diagnostics: ${existingContent.diagnostics.notes}\n\n`;
  }

  // Build the prompt for missing sections
  const sectionDescriptions: Record<SectionName, string> = {
    diagnostics:
      '"diagnostics": { "notes": "Detailed diagnostic workup including labs, imaging, and clinical tests" }',
    overview:
      '"overview": "2-3 paragraph overview of the condition including definition, classification, and clinical significance"',
    etiologyPathophysiology:
      '"etiologyPathophysiology": "Detailed explanation of causes and disease mechanisms"',
    epidemiology:
      '"epidemiology": "Incidence, prevalence, demographics, and distribution"',
    riskFactors: '"riskFactors": ["List of risk factors as bullet points"]',
    clinicalPresentation:
      '"clinicalPresentation": "How patients typically present, including history and physical exam findings"',
    symptoms: '"symptoms": ["List of common symptoms"]',
    examFindings: '"examFindings": ["List of physical examination findings"]',
    treatment: '"treatment": ["Acute and chronic treatment options"]',
    management: '"management": ["Long-term management strategies"]',
    complications: '"complications": ["Potential complications"]',
    prognosis: '"prognosis": "Expected outcomes and prognosis"',
  };

  const sectionsToGenerate = missingSections
    .map((s) => sectionDescriptions[s])
    .join(",\n  ");

  const prompt = `Generate the MISSING medical content sections for the condition "${conditionName}".

EXISTING CONTENT (for context):
${existingContext || "No existing content available."}

Generate ONLY these MISSING sections as a valid JSON object:
{
  ${sectionsToGenerate}
}

Provide medically accurate, board-exam-level content suitable for PA/medical students. Use proper medical terminology.
IMPORTANT: Return ONLY the JSON object with the missing sections.
DO NOT change the keys. Use EXACTLY the keys provided above (e.g. "diagnostics", "overview").
Do not include markdown formatting or code blocks (like \`\`\`json).
FORMATTING RULES:
- For string fields (like overview, etiologyPathophysiology), use Markdown formatting.
- Use '*' for ALL bullet points. Do NOT use '-'.
- Do NOT use Markdown tables. Use lists instead.
- Use '**Bold**' for headers/emphasis. Do NOT use '###'.
- Ensure nested bullets are indented with 2 spaces.`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client!.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      
      let text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Clean the response
      text = asciiClean(text);
      text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      const content = JSON.parse(text) as Partial<ConditionContent>;
      console.log(`   [DEBUG] Returned keys: ${Object.keys(content).join(", ")}`);

      // Map alternative keys to expected keys
      const KEY_MAP: Record<string, string> = {
        "workup": "diagnostics",
        "evaluation": "diagnostics",
        "diagnosis": "diagnostics",
        "clinicalFeatures": "clinicalPresentation",
        "clinical_presentation": "clinicalPresentation",
        "signs_and_symptoms": "symptoms",
        "historyAndPhysical": "clinicalPresentation", // Best effort
        "treatmentAndManagement": "treatment",
        "management_treatment": "management"
      };

      Object.entries(KEY_MAP).forEach(([alt, expected]) => {
        if (content[alt] && !content[expected]) {
          console.log(`   [DEBUG] Mapping ${alt} -> ${expected}`);
          content[expected] = content[alt];
          delete content[alt];
        }
      });

      if (content.overview) {
        console.log(`   [DEBUG] Generated overview start: ${content.overview.substring(0, 50)}...`);
      }
      return content;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `  [ERROR] Attempt ${attempt} failed for ${conditionName}: ${errorMessage}`
      );
      if (attempt === MAX_RETRIES) {
        return null;
      }
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
  return null;
}

// ======================================================
// MAIN
// ======================================================
async function main() {
  console.log("🚀 Starting incomplete condition fixer");

  // Load existing content
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`[ERROR] Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT_FILE, "utf8");
  const allConditions: ConditionItem[] = JSON.parse(raw);
  console.log(`📂 Loaded ${allConditions.length} total conditions`);

  // Find incomplete conditions
  const incompleteConditions = findIncompleteConditions(allConditions);
  console.log(`📌 Found ${incompleteConditions.length} incomplete conditions`);

  if (incompleteConditions.length === 0) {
    console.log("✅ All conditions are complete!");
    return;
  }

  // Show distribution of missing sections
  const sectionCounts: Record<string, number> = {};
  for (const cond of incompleteConditions) {
    for (const section of cond.missingSections) {
      sectionCounts[section] = (sectionCounts[section] || 0) + 1;
    }
  }
  console.log("\n[INFO] Missing sections distribution:");
  for (const [section, count] of Object.entries(sectionCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`   ${section}: ${count}`);
  }
  console.log("");

  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < incompleteConditions.length; i++) {
    // if (fixed >= 3) {
    //   console.log("🛑 Stopping after 3 fixes for verification purposes.");
    //   break;
    // }
    const { index, item, missingSections } = incompleteConditions[i];
    const conditionName = item.condition || extractConditionName(item.conditionId);

    console.log(
      `\n[${i + 1}/${incompleteConditions.length}] 🔵 Fixing: ${conditionName} (${item.conditionId})`
    );
    console.log(`   Missing: ${missingSections.join(", ")}`);

    const newSections = await generateMissingSections(
      conditionName,
      item.content || {},
      missingSections
    );

    if (newSections) {
      // Merge new sections into existing condition content
      allConditions[index].content = { ...(allConditions[index].content || {}), ...newSections };
      fixed++;
      console.log(`   ✅ Fixed: ${item.conditionId}`);

      // Save after each successful fix
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allConditions, null, 2), "utf8");
    } else {
      failed++;
      console.log(`   [ERROR] Failed: ${item.conditionId}`);
    }

    // Delay between requests
    await new Promise((res) => setTimeout(res, DELAY_BETWEEN_REQUESTS));
  }

  console.log("\n🎉 Fixing complete!");
  console.log(`  ✅ Fixed: ${fixed}`);
  console.log(`  [ERROR] Failed: ${failed}`);
  console.log(`  [INFO] Total conditions: ${Object.keys(allConditions).length}`);

  // Verify completion
  const remainingIncomplete = findIncompleteConditions(allConditions);
  console.log(`  📋 Remaining incomplete: ${remainingIncomplete.length}`);
}

main().catch(console.error);
