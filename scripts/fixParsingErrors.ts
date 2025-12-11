
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash"; // Using flash for speed/reliability on fixes, or pro if needed. Sticking to pro for quality matching.
// Actually, let's stick to the one used before or a high quality one.
const MODEL_FOR_FIX = "gemini-1.5-pro"; 

if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY is missing in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const client = genAI.getGenerativeModel({ model: MODEL_FOR_FIX });

const DATA_FILE = path.join(process.cwd(), 'conditionContent.final.json');

// ======================================================
// UTILS
// ======================================================

function isValid(val: any): boolean {
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val.trim().length > 10;
    return false;
}

function needsUpgrade(entry: any): string[] {
    const missing: string[] = [];
    const c = entry.content || {};

    // Check Overview
    if (!isValid(c.overview) || c.overview.length < 300) missing.push("overview");

    // Check Arrays
    const arrays = ["symptoms", "treatment", "riskFactors", "complications", "management", "examFindings"];
    for (const field of arrays) {
        const arr = c[field];
        if (!Array.isArray(arr) || arr.length < 5) {
            missing.push(field);
        } else {
            // Check for "lazy lists" (short items)
            const totalLen = arr.reduce((sum: number, s: any) => sum + (typeof s === 'string' ? s.length : 0), 0);
            if ((totalLen / arr.length) < 35) missing.push(field);
        }
    }
    
    // Check Strings
    const strings = ["clinicalPresentation", "etiologyPathophysiology", "diagnostics"];
    for (const field of strings) {
        if (!isValid(c[field])) missing.push(field);
    }
    return missing;
}

function cleanAndParse(text: string) {
    // 1. Try direct parse
    try {
        return JSON.parse(text);
    } catch (e) {
        // 2. Try to extract JSON block
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            try {
                const jsonStr = text.substring(start, end + 1);
                return JSON.parse(jsonStr);
            } catch (e2) {
                // 3. Try to fix common trailing comma issues or markdown
                // (Simple regex cleanup if needed, but usually extraction works)
            }
        }
        return null;
    }
}

// ======================================================
// GENERATION
// ======================================================

async function generateFix(condition: string, existing: any, sections: string[]): Promise<any> {
    console.log(`   🔄 Fixing: ${condition} (Missing: ${sections.join(", ")})`);

    let context = "";
    if (existing.clinicalPresentation?.length > 20) context += `Presentation: ${existing.clinicalPresentation}\n`;
    
    // Same prompt as finalQualityUpgrade.ts to ensure consistency
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
**OUTPUT**: JSON only. No markdown fencing.`;

    try {
        const response = await client.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' } 
        });
        
        const text = response.response.text();
        const data = cleanAndParse(text);
        
        if (!data) {
            console.error(`   ❌ Failed to parse JSON for ${condition}`);
            // console.log("Raw output:", text.substring(0, 100));
            return null;
        }
        return data;

    } catch (e: any) {
        if (e.status === 429 || (e.message && e.message.includes("429"))) {
             console.log(`   ⚠️ Rate limit. Waiting...`);
             await new Promise(r => setTimeout(r, 5000));
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
    console.log("🚑 Starting Repair Job: Fixing Parsing Errors...");
    
    if (!fs.existsSync(DATA_FILE)) {
        console.error("❌ conditionContent.final.json not found!");
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let fixedCount = 0;
    let skippedCount = 0;

    // Identify candidates
    const candidates = data.filter((item: any) => {
        const missing = needsUpgrade(item);
        return missing.length > 0;
    });

    console.log(`🔍 Found ${candidates.length} conditions that still need upgrades.`);

    for (const item of candidates) {
        const missing = needsUpgrade(item);
        
        // Double check - if it's just one minor thing, maybe skip? 
        // But user said "parsing issues", so likely whole sections are missing.
        
        const newData = await generateFix(item.condition, item.content || {}, missing);
        
        if (newData) {
            // Merge
            item.content = { ...item.content, ...newData };
            fixedCount++;
            
            // Save incrementally every 5 items
            if (fixedCount % 5 === 0) {
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
                console.log(`   💾 Saved progress (${fixedCount} fixed)`);
            }
        } else {
            skippedCount++;
        }

        // Polite delay
        await new Promise(r => setTimeout(r, 2000));
    }

    // Final Save
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`\n✅ Repair Complete!`);
    console.log(`   - Fixed: ${fixedCount}`);
    console.log(`   - Skipped/Failed: ${skippedCount}`);
}

main();
