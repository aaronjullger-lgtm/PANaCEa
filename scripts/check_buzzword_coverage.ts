
import { CONDITION_REGISTRY } from '../conditionRegistry';
import fs from 'fs';
import path from 'path';

// 1. Parse BuzzwordChart.txt
const buzzwordPath = path.resolve(process.cwd(), 'BuzzwordChart.txt');
const buzzwordContent = fs.readFileSync(buzzwordPath, 'utf-8');

const lines = buzzwordContent.split('\n');
const buzzwordConditions = new Set<string>();

lines.forEach(line => {
    // Skip header and empty lines
    if (!line || line.startsWith('The Buzzword') || line.endsWith(',,')) return;
    
    // CSV parsing is tricky with quoted commas, but let's try a simple split first
    // The format is: "Buzzword",Diagnosis,System
    // We care about the Diagnosis (2nd column usually, but sometimes 1st if no quotes)
    
    // Better regex for CSV splitting
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    // Actually, let's just look for the middle part.
    // Usually it's:  "Buzzword", Diagnosis Name, System
    
    const parts = line.split(',');
    // If the first part starts with ", it might contain commas.
    
    let diagnosis = '';
    
    // Simple heuristic: The diagnosis is usually the second-to-last item if we split by comma, 
    // OR we can try to be smarter.
    // Let's use a proper CSV regex parser or just manual logic.
    
    // Manual logic:
    // 1. Find the last comma. That separates System.
    const lastCommaIdx = line.lastIndexOf(',');
    if (lastCommaIdx === -1) return;
    
    const system = line.substring(lastCommaIdx + 1).trim();
    const rest = line.substring(0, lastCommaIdx);
    
    // 2. Find the comma before that? No, the buzzword might have commas.
    // But the Diagnosis usually doesn't have commas in this file.
    // Let's look at the file content again.
    // "Continuous ""machinery"" murmur",Patent Ductus Arteriosus (PDA),Cardio
    // "Rib notching + ""3 sign""",Coarctation of the Aorta,Cardio (XR)
    
    // It seems the Diagnosis is always the second field.
    // And the Buzzword is the first field, often quoted.
    
    // Let's try to split by `",` or `,` 
    // If the line starts with `"`, the first split is at `",`.
    
    let firstPartEnd = -1;
    if (line.startsWith('"')) {
        // Look for `",`
        firstPartEnd = line.indexOf('",');
        if (firstPartEnd !== -1) {
             // Diagnosis starts after `",`
             const afterBuzzword = line.substring(firstPartEnd + 2);
             const nextComma = afterBuzzword.lastIndexOf(',');
             if (nextComma !== -1) {
                 diagnosis = afterBuzzword.substring(0, nextComma).trim();
             }
        }
    } else {
        // Look for first `,`
        firstPartEnd = line.indexOf(',');
        if (firstPartEnd !== -1) {
             const afterBuzzword = line.substring(firstPartEnd + 1);
             const nextComma = afterBuzzword.lastIndexOf(',');
             if (nextComma !== -1) {
                 diagnosis = afterBuzzword.substring(0, nextComma).trim();
             }
        }
    }
    
    if (diagnosis) {
        // Clean up quotes if any
        diagnosis = diagnosis.replace(/^"|"$/g, '');
        buzzwordConditions.add(diagnosis);
    }
});

// 2. Check against Registry
const registryNames = new Set<string>();
const registryAliases = new Set<string>();

CONDITION_REGISTRY.forEach(c => {
    registryNames.add(c.condition.toLowerCase());
    if (c.aliases) {
        c.aliases.forEach(a => registryAliases.add(a.toLowerCase()));
    }
});

const missing: string[] = [];

buzzwordConditions.forEach(cond => {
    const lower = cond.toLowerCase();
    
    // Direct match
    if (registryNames.has(lower)) return;
    
    // Alias match
    if (registryAliases.has(lower)) return;
    
    // Partial match (e.g. "Acute Pericarditis" vs "Pericarditis")
    // We'll be strict for now to find potential gaps
    
    // Check if any registry item *contains* this string
    let found = false;
    for (const regName of registryNames) {
        if (regName.includes(lower) || lower.includes(regName)) {
            found = true;
            break;
        }
    }
    if (found) return;
    
    missing.push(cond);
});

console.log(`Found ${missing.length} potentially missing conditions from BuzzwordChart:`);
missing.forEach(m => console.log(`- ${m}`));

