import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

// ======================================================
// CONFIGURATION
// ======================================================
const MAIN_INPUT = path.resolve("conditionContent.ready.json");
const OUTPUT_FILE = path.resolve("conditionContent.final.json");
const BATCH_SIZE = 5; // Parallel requests

const LEGACY_FILES = [
  path.resolve("conditionContent.generated.json"), 
  path.resolve("conditionContent.scrubbed.json"),  
  path.resolve("conditionContent.backup.json"),
  path.resolve("conditionContent.ready.json")
];

const MODEL_NAME = "gemini-2.5-pro"; 

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ ERROR: No API Key found.");
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey });

// ======================================================
// HELPERS
// ======================================================
function toLooseId(s: string): string {
  if (!s || typeof s !== 'string') return "";
  return s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function isValid(val: any): boolean {
  if (!val) return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'string') return val.length > 10 && !val.includes("pending") && !val.includes("--");
  return false;
}

function smartMerge(target: any, source: any) {
  const fields = [
    "overview", "clinicalPresentation", "symptoms", "treatment", 
    "riskFactors", "examFindings", "diagnostics", "management", 
    "complications", "epidemiology", "etiologyPathophysiology", "prognosis"
  ];
  
  let merged = false;
  for (const field of fields) {
    const tVal = target[field];
    const sVal = source[field];

    if (!isValid(sVal)) continue;
    if (!isValid(tVal)) {
      target[field] = sVal;
      merged = true;
      continue;
    }
    if (Array.isArray(tVal) && Array.isArray(sVal)) {
      if (sVal.length > tVal.length) {
        target[field] = sVal;
        merged = true;
      }
    } 
    else if (typeof tVal === 'string' && typeof sVal === 'string') {
      if (sVal.length > tVal.length + 20) { 
        target[field] = sVal;
        merged = true;
      }
    }
  }
  return merged;
}

function needsUpgrade(entry: any): string[] {
    const missing: string[] = [];
    const c = entry.content || {};

    // Check overview - only if missing or extremely short
    if (!c.overview || c.overview.length < 10) missing.push("overview");

    // Check arrays/objects - only if missing or empty
    const complexFields = ["symptoms", "treatment", "riskFactors", "complications", "management", "examFindings"];
    for (const field of complexFields) {
        const val = c[field];
        if (!val) {
            missing.push(field);
        } else if (Array.isArray(val) && val.length === 0) {
            missing.push(field);
        } else if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) {
            missing.push(field);
        } else if (typeof val === 'string' && val.length < 5) {
            missing.push(field);
        }
    }
    
    // Check strings - only if missing or extremely short
    const strings = ["clinicalPresentation", "etiologyPathophysiology", "diagnostics"];
    for (const field of strings) {
        if (!c[field] || c[field].length < 5) missing.push(field);
    }
    return missing;
}

// ======================================================
// GENERATION
// ======================================================
async function generateUpgrade(condition: string, existing: any, sections: string[]): Promise<any> {
    if (!client) return null;

    let context = "";
    if (existing.clinicalPresentation?.length > 20) context += `Presentation: ${existing.clinicalPresentation}\n`;
    if (existing.treatment?.length > 0) context += `Tx: ${JSON.stringify(existing.treatment)}\n`;

    const prompt = `You are an expert medical educator creating the **definitive study resource** for PANCE/USMLE.
**TOPIC**: "${condition}"
**TASK**: Upgrade these sections to "Board Exam Quality" (Deep, Educational, High-Yield).
**SECTIONS**: ${sections.join(", ")}
**EXISTING DATA**: ${context.substring(0, 1000)}...
**REQUIREMENTS**:
1. **Detail is King**: Explain *mechanism*.
2. **Overview**: Detailed paragraph (150+ words).
3. **Arrays**: 5+ items. Format: "* **Concept**: Explanation".
4. **Treatment**: First-line vs Second-line.
**OUTPUT**: JSON only.`;

    try {
        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' } 
        });
        
        let text = response?.text || ""; 
        text = text.replace(/```json|```/g, '').trim();
        return JSON.parse(text);

    } catch (e: any) {
        if (e.status === 429 || (e.message && e.message.includes("429"))) {
             console.log(`   ⚠️ Rate limit on ${condition}. Skipping this batch item.`);
             return null; 
        }
        console.error(`   ❌ API Error on ${condition}: ${e.message}`);
        return null;
    }
}

// ======================================================
// MAIN
// ======================================================
async function main() {
    
    // ======================================================
    // 🔄 SMART RESUME LOGIC
    // ======================================================
    let loadPath = MAIN_INPUT;
    if (fs.existsSync(OUTPUT_FILE)) {
        console.log("   🔄 Found existing progress (final.json). Resuming...");
        loadPath = OUTPUT_FILE;
    } else if (fs.existsSync(MAIN_INPUT)) {
        console.log("   📂 Starting fresh from source (ready.json)...");
    } else {
        console.error(`❌ Missing input files.`);
        return;
    }

    let conditions = JSON.parse(fs.readFileSync(loadPath, 'utf-8'));
    if (!Array.isArray(conditions)) conditions = Object.values(conditions);

    // Load Legacy for Rescue
    const legacyMaps: Map<string, any>[] = [];
    console.log("💾 Indexing Legacy Files...");
    for (const file of LEGACY_FILES) {
        if (fs.existsSync(file)) {
            try {
                const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
                const arr = Array.isArray(raw) ? raw : Object.values(raw);
                const map = new Map();
                arr.forEach((c: any) => {
                    if (c.conditionId) map.set(toLooseId(c.conditionId), c.content);
                    if (c.condition) map.set(toLooseId(c.condition), c.content);
                    if (c.name) map.set(toLooseId(c.name), c.content); 
                    if (c.title) map.set(toLooseId(c.title), c.content);
                });
                legacyMaps.push(map);
            } catch (e) { }
        }
    }

    console.log(`🚀 Starting TURBO Polish on ${conditions.length} conditions...`);
    
    // BATCH LOOP
    for (let i = 0; i < conditions.length; i += BATCH_SIZE) {
        const batch = conditions.slice(i, i + BATCH_SIZE);
        const promises = [];

        // Check if batch actually needs work
        let batchNeedsWork = false;
        for (const entry of batch) {
             if (needsUpgrade(entry).length > 0) batchNeedsWork = true;
        }

        if (!batchNeedsWork) {
            // process.stdout.write("."); // Skip indicator
            continue;
        }

        console.log(`\n⚡ Processing Batch ${i + 1}-${Math.min(i + BATCH_SIZE, conditions.length)}...`);

        for (const entry of batch) {
            if (!entry.content) entry.content = {};
            const looseId = toLooseId(entry.conditionId);
            const looseName = toLooseId(entry.condition);

            // Rescue
            let wasRescued = false;
            for (const map of legacyMaps) {
                let legacyContent = map.get(looseId) || map.get(looseName);
                if (legacyContent && smartMerge(entry.content, legacyContent)) {
                    wasRescued = true;
                }
            }

            const flags = needsUpgrade(entry);
            
            if (flags.length === 0) continue;

            // If we need upgrade, add to promises
            promises.push(async () => {
                const aiContent = await generateUpgrade(entry.condition, entry.content, flags);
                if (aiContent) {
                    entry.content = { ...entry.content, ...aiContent };
                    console.log(`   ✨ Upgraded: ${entry.condition}`);
                }
            });
        }

        // Run Batch in Parallel
        if (promises.length > 0) {
            await Promise.all(promises.map(p => p()));
            // Save after every batch so we don't lose data
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(conditions, null, 2));
        }
    }

    console.log("\n\n🏁 DONE!");
    console.log(`Output: ${OUTPUT_FILE}`);
}

main();