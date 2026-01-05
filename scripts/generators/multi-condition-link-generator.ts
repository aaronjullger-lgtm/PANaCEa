#!/usr/bin/env npx tsx
/**
 * Multi Condition Link Generator
 * 
 * Creates links between various content tables and Conditions
 * These are junction tables that connect content to conditions
 * 
 * Tables generated:
 *   - LabConditionLink: Links lab tests to conditions
 *   - FindingConditionLink: Links physical exam findings to conditions
 *   - ProcedureConditionLink: Links procedures to conditions
 *   - PhysiologyConditionLink: Links physiology concepts to conditions
 *   - AnatomyConditionLink: Links anatomy structures to conditions
 *   - TreatmentConditionLink: Links treatments to conditions
 * 
 * Usage:
 *   npx tsx scripts/generators/multi-condition-link-generator.ts --lab
 *   npx tsx scripts/generators/multi-condition-link-generator.ts --finding
 *   npx tsx scripts/generators/multi-condition-link-generator.ts --procedure
 *   npx tsx scripts/generators/multi-condition-link-generator.ts --physiology
 *   npx tsx scripts/generators/multi-condition-link-generator.ts --anatomy
 *   npx tsx scripts/generators/multi-condition-link-generator.ts --treatment
 *   npx tsx scripts/generators/multi-condition-link-generator.ts --all
 *   npx tsx scripts/generators/multi-condition-link-generator.ts --analyze
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ANALYZE = args.includes('--analyze');
const GEN_ALL = args.includes('--all');
const GEN_LAB = args.includes('--lab') || GEN_ALL;
const GEN_FINDING = args.includes('--finding') || GEN_ALL;
const GEN_PROCEDURE = args.includes('--procedure') || GEN_ALL;
const GEN_PHYSIOLOGY = args.includes('--physiology') || GEN_ALL;
const GEN_ANATOMY = args.includes('--anatomy') || GEN_ALL;
const GEN_TREATMENT = args.includes('--treatment') || GEN_ALL;
const GEN_DRUG = args.includes('--drug') || GEN_ALL;

// Rate limiter
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(private capacity: number, private refillRate: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

// ================================
// LINK DATA TYPES
// ================================

interface LabConditionLinkData {
  labTestId: string;
  conditionId: string;
  relationshipType: string;  // 'diagnostic', 'monitoring', 'screening', 'confirmatory'
  expectedResult: string;
  significance: string;
  sensitivity?: number;
  specificity?: number;
}

interface FindingConditionLinkData {
  findingId: string;
  conditionId: string;
  relationshipType: string;  // 'diagnostic', 'suggestive', 'associated', 'classic'
  clinicalContext: string;
  sensitivity?: number;
  specificity?: number;
}

interface ProcedureConditionLinkData {
  procedureId: string;
  conditionId: string;
  relationshipType: string;  // 'diagnostic', 'therapeutic', 'palliative', 'preventive'
  indication: string;
  isFirstLine: boolean;
}

interface PhysiologyConditionLinkData {
  physiologyId: string;
  conditionId: string;
  relationshipType: string;  // 'pathophysiology', 'compensatory', 'decompensation', 'mechanism'
  explanation: string;
}

interface AnatomyConditionLinkData {
  anatomyId: string;
  conditionId: string;
  relationshipType: string;  // 'primary_site', 'referred_pain', 'complication', 'surgical_landmark'
  clinicalContext: string;
}

interface TreatmentConditionLinkData {
  treatmentId: string;
  conditionId: string;
  relationshipType: string;  // 'first_line', 'second_line', 'adjunct', 'contraindicated'
  indication: string;
  isFirstLine: boolean;
}

interface DrugConditionLinkData {
  drugId: string;
  conditionId: string;
  relationshipType: string;  // 'treatment', 'prophylaxis', 'contraindicated', 'caution'
  evidenceLevel: string;
  notes: string;
  isFirstLine: boolean;
}

// ================================
// AI GENERATION FUNCTIONS
// ================================

async function generateLabLinks(
  labTest: { id: string; name: string; category: string },
  conditions: Array<{ id: string; name: string; system: string }>,
  retryCount = 0
): Promise<LabConditionLinkData[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const conditionsList = conditions.slice(0, 50).map(c => `${c.name} (${c.system})`).join(', ');
  
  const prompt = retryCount === 0 ? `You are a medical expert. For the lab test "${labTest.name}" (category: ${labTest.category}), identify which conditions from this list it helps diagnose or monitor:

Conditions: ${conditionsList}

Return a JSON array of condition links:

[
  {
    "conditionName": "Exact condition name from list",
    "relationshipType": "diagnostic|monitoring|screening|confirmatory",
    "expectedResult": "Elevated/Decreased/Positive/Negative/Abnormal pattern",
    "significance": "How this lab finding relates to the condition",
    "sensitivity": 0.0-1.0 (optional),
    "specificity": 0.0-1.0 (optional)
  }
]

Rules:
- Only include conditions where this lab test is clinically relevant
- Use "diagnostic" if abnormal result strongly suggests the diagnosis
- Use "monitoring" if used to track disease progression/treatment
- Use "screening" if used for early detection
- Use "confirmatory" if used to confirm clinical suspicion
- Return ONLY valid JSON array, no markdown
- Use straight apostrophes, no special symbols` 
  : `List conditions that the lab test "${labTest.name}" helps diagnose.
Return JSON array only:
[{"conditionName":"Name","relationshipType":"diagnostic","expectedResult":"Elevated","significance":"Description"}]`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) return [];
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    
    jsonStr = jsonStr.replace(/['']/g, "'").replace(/[""]/g, '"').replace(/,(\s*[\]}])/g, '$1');
    
    let parsed: Array<{
      conditionName: string;
      relationshipType: string;
      expectedResult: string;
      significance: string;
      sensitivity?: number;
      specificity?: number;
    }>;
    
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        return generateLabLinks(labTest, conditions, 1);
      }
      return [];
    }
    
    const links: LabConditionLinkData[] = [];
    for (const item of parsed) {
      const condition = conditions.find(c => 
        c.name.toLowerCase() === item.conditionName.toLowerCase() ||
        c.name.toLowerCase().includes(item.conditionName.toLowerCase()) ||
        item.conditionName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (condition) {
        links.push({
          labTestId: labTest.id,
          conditionId: condition.id,
          relationshipType: item.relationshipType || 'diagnostic',
          expectedResult: item.expectedResult || 'Abnormal',
          significance: item.significance || `${labTest.name} abnormality in ${condition.name}`,
          sensitivity: item.sensitivity,
          specificity: item.specificity
        });
      }
    }
    
    return links;
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise(r => setTimeout(r, 1000));
      return generateLabLinks(labTest, conditions, 1);
    }
    return [];
  }
}

async function generateFindingLinks(
  finding: { id: string; name: string; system: string },
  conditions: Array<{ id: string; name: string; system: string }>,
  retryCount = 0
): Promise<FindingConditionLinkData[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const conditionsList = conditions.slice(0, 50).map(c => `${c.name} (${c.system})`).join(', ');
  
  const prompt = retryCount === 0 ? `You are a medical expert. For the physical exam finding "${finding.name}" (system: ${finding.system}), identify which conditions from this list it helps diagnose:

Conditions: ${conditionsList}

Return a JSON array of condition links:

[
  {
    "conditionName": "Exact condition name from list",
    "relationshipType": "diagnostic|suggestive|associated|classic",
    "clinicalContext": "When and how this finding appears in this condition",
    "sensitivity": 0.0-1.0 (optional),
    "specificity": 0.0-1.0 (optional)
  }
]

Rules:
- Only include conditions where this finding is clinically relevant
- Use "diagnostic" if pathognomonic or highly specific
- Use "suggestive" if raises clinical suspicion
- Use "associated" if commonly seen but not diagnostic
- Use "classic" if textbook presentation
- Return ONLY valid JSON array, no markdown` 
  : `List conditions where "${finding.name}" is a relevant physical exam finding.
Return JSON array only:
[{"conditionName":"Name","relationshipType":"suggestive","clinicalContext":"Description"}]`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) return [];
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    
    jsonStr = jsonStr.replace(/['']/g, "'").replace(/[""]/g, '"').replace(/,(\s*[\]}])/g, '$1');
    
    let parsed: Array<{
      conditionName: string;
      relationshipType: string;
      clinicalContext: string;
      sensitivity?: number;
      specificity?: number;
    }>;
    
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        return generateFindingLinks(finding, conditions, 1);
      }
      return [];
    }
    
    const links: FindingConditionLinkData[] = [];
    for (const item of parsed) {
      const condition = conditions.find(c => 
        c.name.toLowerCase() === item.conditionName.toLowerCase() ||
        c.name.toLowerCase().includes(item.conditionName.toLowerCase()) ||
        item.conditionName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (condition) {
        links.push({
          findingId: finding.id,
          conditionId: condition.id,
          relationshipType: item.relationshipType || 'associated',
          clinicalContext: item.clinicalContext || `${finding.name} seen in ${condition.name}`,
          sensitivity: item.sensitivity,
          specificity: item.specificity
        });
      }
    }
    
    return links;
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise(r => setTimeout(r, 1000));
      return generateFindingLinks(finding, conditions, 1);
    }
    return [];
  }
}

async function generateProcedureLinks(
  procedure: { id: string; name: string; category: string },
  conditions: Array<{ id: string; name: string; system: string }>,
  retryCount = 0
): Promise<ProcedureConditionLinkData[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const conditionsList = conditions.slice(0, 50).map(c => `${c.name} (${c.system})`).join(', ');
  
  const prompt = retryCount === 0 ? `You are a medical expert. For the procedure "${procedure.name}" (category: ${procedure.category}), identify which conditions from this list it is used to diagnose or treat:

Conditions: ${conditionsList}

Return a JSON array of condition links:

[
  {
    "conditionName": "Exact condition name from list",
    "relationshipType": "diagnostic|therapeutic|palliative|preventive",
    "indication": "Why this procedure is performed for this condition",
    "isFirstLine": true/false
  }
]

Rules:
- Only include conditions where this procedure is clinically indicated
- Use "diagnostic" if procedure helps diagnose the condition
- Use "therapeutic" if procedure treats the condition
- Use "palliative" if procedure provides symptom relief
- Use "preventive" if procedure prevents complications
- isFirstLine = true if this is the first procedure considered
- Return ONLY valid JSON array, no markdown` 
  : `List conditions where "${procedure.name}" is indicated.
Return JSON array only:
[{"conditionName":"Name","relationshipType":"therapeutic","indication":"Description","isFirstLine":true}]`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) return [];
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    
    jsonStr = jsonStr.replace(/['']/g, "'").replace(/[""]/g, '"').replace(/,(\s*[\]}])/g, '$1');
    
    let parsed: Array<{
      conditionName: string;
      relationshipType: string;
      indication: string;
      isFirstLine: boolean;
    }>;
    
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        return generateProcedureLinks(procedure, conditions, 1);
      }
      return [];
    }
    
    const links: ProcedureConditionLinkData[] = [];
    for (const item of parsed) {
      const condition = conditions.find(c => 
        c.name.toLowerCase() === item.conditionName.toLowerCase() ||
        c.name.toLowerCase().includes(item.conditionName.toLowerCase()) ||
        item.conditionName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (condition) {
        links.push({
          procedureId: procedure.id,
          conditionId: condition.id,
          relationshipType: item.relationshipType || 'therapeutic',
          indication: item.indication || `${procedure.name} for ${condition.name}`,
          isFirstLine: item.isFirstLine ?? false
        });
      }
    }
    
    return links;
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise(r => setTimeout(r, 1000));
      return generateProcedureLinks(procedure, conditions, 1);
    }
    return [];
  }
}

async function generatePhysiologyLinks(
  concept: { id: string; name: string; category: string },
  conditions: Array<{ id: string; name: string; system: string }>,
  retryCount = 0
): Promise<PhysiologyConditionLinkData[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const conditionsList = conditions.slice(0, 50).map(c => `${c.name} (${c.system})`).join(', ');
  
  const prompt = retryCount === 0 ? `You are a medical expert. For the physiology concept "${concept.name}" (category: ${concept.category}), identify which conditions from this list involve this physiological process:

Conditions: ${conditionsList}

Return a JSON array of condition links:

[
  {
    "conditionName": "Exact condition name from list",
    "relationshipType": "pathophysiology|compensatory|decompensation|mechanism",
    "explanation": "How this physiological concept relates to the condition"
  }
]

Rules:
- Only include conditions where this physiology concept is relevant
- Use "pathophysiology" if this explains the disease mechanism
- Use "compensatory" if this is a compensatory response
- Use "decompensation" if this represents failure of compensation
- Use "mechanism" if this is a key underlying mechanism
- Return ONLY valid JSON array, no markdown` 
  : `List conditions involving the physiology concept "${concept.name}".
Return JSON array only:
[{"conditionName":"Name","relationshipType":"pathophysiology","explanation":"Description"}]`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) return [];
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    
    jsonStr = jsonStr.replace(/['']/g, "'").replace(/[""]/g, '"').replace(/,(\s*[\]}])/g, '$1');
    
    let parsed: Array<{
      conditionName: string;
      relationshipType: string;
      explanation: string;
    }>;
    
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        return generatePhysiologyLinks(concept, conditions, 1);
      }
      return [];
    }
    
    const links: PhysiologyConditionLinkData[] = [];
    for (const item of parsed) {
      const condition = conditions.find(c => 
        c.name.toLowerCase() === item.conditionName.toLowerCase() ||
        c.name.toLowerCase().includes(item.conditionName.toLowerCase()) ||
        item.conditionName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (condition) {
        links.push({
          physiologyId: concept.id,
          conditionId: condition.id,
          relationshipType: item.relationshipType || 'pathophysiology',
          explanation: item.explanation || `${concept.name} in ${condition.name}`
        });
      }
    }
    
    return links;
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise(r => setTimeout(r, 1000));
      return generatePhysiologyLinks(concept, conditions, 1);
    }
    return [];
  }
}

async function generateAnatomyLinks(
  structure: { id: string; name: string; system: string },
  conditions: Array<{ id: string; name: string; system: string }>,
  retryCount = 0
): Promise<AnatomyConditionLinkData[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const conditionsList = conditions.slice(0, 50).map(c => `${c.name} (${c.system})`).join(', ');
  
  const prompt = retryCount === 0 ? `You are a medical expert. For the anatomical structure "${structure.name}" (system: ${structure.system}), identify which conditions from this list involve this structure:

Conditions: ${conditionsList}

Return a JSON array of condition links:

[
  {
    "conditionName": "Exact condition name from list",
    "relationshipType": "primary_site|referred_pain|complication|surgical_landmark",
    "clinicalContext": "How this anatomical structure relates to the condition"
  }
]

Rules:
- Only include conditions where this anatomy is clinically relevant
- Use "primary_site" if disease primarily affects this structure
- Use "referred_pain" if pain from condition refers to this area
- Use "complication" if condition can damage this structure
- Use "surgical_landmark" if important for surgical approach
- Return ONLY valid JSON array, no markdown` 
  : `List conditions involving the anatomical structure "${structure.name}".
Return JSON array only:
[{"conditionName":"Name","relationshipType":"primary_site","clinicalContext":"Description"}]`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) return [];
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    
    jsonStr = jsonStr.replace(/['']/g, "'").replace(/[""]/g, '"').replace(/,(\s*[\]}])/g, '$1');
    
    let parsed: Array<{
      conditionName: string;
      relationshipType: string;
      clinicalContext: string;
    }>;
    
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        return generateAnatomyLinks(structure, conditions, 1);
      }
      return [];
    }
    
    const links: AnatomyConditionLinkData[] = [];
    for (const item of parsed) {
      const condition = conditions.find(c => 
        c.name.toLowerCase() === item.conditionName.toLowerCase() ||
        c.name.toLowerCase().includes(item.conditionName.toLowerCase()) ||
        item.conditionName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (condition) {
        links.push({
          anatomyId: structure.id,
          conditionId: condition.id,
          relationshipType: item.relationshipType || 'primary_site',
          clinicalContext: item.clinicalContext || `${structure.name} involved in ${condition.name}`
        });
      }
    }
    
    return links;
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise(r => setTimeout(r, 1000));
      return generateAnatomyLinks(structure, conditions, 1);
    }
    return [];
  }
}

async function generateDrugLinks(
  drug: { id: string; genericName: string; drugClass: string },
  conditions: Array<{ id: string; name: string; system: string }>,
  retryCount = 0
): Promise<DrugConditionLinkData[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const conditionsList = conditions.slice(0, 50).map(c => `${c.name} (${c.system})`).join(', ');
  
  const prompt = retryCount === 0 ? `You are a medical expert. For the drug "${drug.genericName}" (class: ${drug.drugClass}), identify which conditions from this list it is used to treat or is contraindicated for:

Conditions: ${conditionsList}

Return a JSON array of condition links:

[
  {
    "conditionName": "Exact condition name from list",
    "relationshipType": "treatment|prophylaxis|contraindicated|caution",
    "evidenceLevel": "A|B|C",
    "notes": "Brief clinical note about this drug-condition relationship",
    "isFirstLine": true/false
  }
]

Rules:
- Only include conditions where this drug is clinically relevant
- Use "treatment" if drug is used to treat the condition
- Use "prophylaxis" if drug prevents the condition
- Use "contraindicated" if drug should NOT be used
- Use "caution" if special monitoring required
- evidenceLevel: A=strong evidence, B=moderate, C=expert opinion
- isFirstLine = true if this is a first-line treatment
- Return ONLY valid JSON array, no markdown` 
  : `List conditions that the drug "${drug.genericName}" treats or is contraindicated for.
Return JSON array only:
[{"conditionName":"Name","relationshipType":"treatment","evidenceLevel":"A","notes":"Description","isFirstLine":true}]`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) return [];
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    
    jsonStr = jsonStr.replace(/['']/g, "'").replace(/[""]/g, '"').replace(/,(\s*[\]}])/g, '$1');
    
    let parsed: Array<{
      conditionName: string;
      relationshipType: string;
      evidenceLevel: string;
      notes: string;
      isFirstLine: boolean;
    }>;
    
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        return generateDrugLinks(drug, conditions, 1);
      }
      return [];
    }
    
    const links: DrugConditionLinkData[] = [];
    for (const item of parsed) {
      const condition = conditions.find(c => 
        c.name.toLowerCase() === item.conditionName.toLowerCase() ||
        c.name.toLowerCase().includes(item.conditionName.toLowerCase()) ||
        item.conditionName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (condition) {
        links.push({
          drugId: drug.id,
          conditionId: condition.id,
          relationshipType: item.relationshipType || 'treatment',
          evidenceLevel: item.evidenceLevel || 'B',
          notes: item.notes || `${drug.genericName} for ${condition.name}`,
          isFirstLine: item.isFirstLine ?? false
        });
      }
    }
    
    return links;
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise(r => setTimeout(r, 1000));
      return generateDrugLinks(drug, conditions, 1);
    }
    return [];
  }
}

interface TreatmentLinkResult {
  conditionName: string;
  relationshipType: string;
  evidenceLevel: string;
  notes: string;
  isFirstLine: boolean;
}

async function generateTreatmentLinks(
  treatment: { id: string; name: string; category: string },
  conditions: Array<{ id: string; name: string; system: string }>,
  retryCount = 0
): Promise<Array<{ treatmentId: string; conditionId: string; relationshipType: string; evidenceLevel: string; notes: string; isFirstLine: boolean }>> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const conditionsList = conditions.slice(0, 50).map(c => `${c.name} (${c.system})`).join(', ');
  
  const prompt = retryCount === 0 ? `You are a medical expert. For the treatment "${treatment.name}" (category: ${treatment.category}), identify which conditions from this list it is used to treat:

Conditions: ${conditionsList}

Return a JSON array of condition links:

[
  {
    "conditionName": "Exact condition name from list",
    "relationshipType": "first_line|second_line|adjunct|alternative|supportive",
    "evidenceLevel": "A|B|C",
    "notes": "Brief clinical note about this treatment-condition relationship",
    "isFirstLine": true/false
  }
]

Rules:
- Only include conditions where this treatment is clinically relevant
- "first_line" = primary recommended treatment
- "second_line" = used when first-line fails/contraindicated
- "adjunct" = used alongside primary treatment
- "alternative" = valid alternative approach
- "supportive" = symptom management only
- evidenceLevel: A=strong evidence, B=moderate, C=expert opinion
- Return ONLY valid JSON array, no markdown` 
  : `List conditions that "${treatment.name}" treats.
Return JSON array only:
[{"conditionName":"Name","relationshipType":"first_line","evidenceLevel":"A","notes":"Description","isFirstLine":true}]`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) return [];
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    
    jsonStr = jsonStr.replace(/['']/g, "'").replace(/[""]/g, '"').replace(/,(\s*[\]}])/g, '$1');
    
    let parsed: TreatmentLinkResult[];
    
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        return generateTreatmentLinks(treatment, conditions, 1);
      }
      return [];
    }
    
    const links: Array<{ treatmentId: string; conditionId: string; relationshipType: string; evidenceLevel: string; notes: string; isFirstLine: boolean }> = [];
    for (const item of parsed) {
      const condition = conditions.find(c => 
        c.name.toLowerCase() === item.conditionName.toLowerCase() ||
        c.name.toLowerCase().includes(item.conditionName.toLowerCase()) ||
        item.conditionName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (condition) {
        links.push({
          treatmentId: treatment.id,
          conditionId: condition.id,
          relationshipType: item.relationshipType || 'first_line',
          evidenceLevel: item.evidenceLevel || 'B',
          notes: item.notes || `${treatment.name} for ${condition.name}`,
          isFirstLine: item.isFirstLine ?? false
        });
      }
    }
    
    return links;
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise(r => setTimeout(r, 1000));
      return generateTreatmentLinks(treatment, conditions, 1);
    }
    return [];
  }
}

// ================================
// MAIN PROCESSING FUNCTIONS
// ================================

async function processLabLinks() {
  console.log('\n🧪 Processing Lab Condition Links...');
  
  const labTests = await prisma.labTest.findMany({
    select: { id: true, name: true, category: true }
  });
  
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true }
  });
  
  const existingLinks = await prisma.labConditionLink.findMany({
    select: { labTestId: true, conditionId: true }
  });
  const existingSet = new Set(existingLinks.map(l => `${l.labTestId}:${l.conditionId}`));
  
  console.log(`  Found ${labTests.length} lab tests, ${conditions.length} conditions`);
  console.log(`  Existing links: ${existingLinks.length}`);
  
  let created = 0;
  let skipped = 0;
  
  for (const labTest of labTests) {
    console.log(`  🔬 ${labTest.name}...`);
    
    const links = await generateLabLinks(labTest, conditions);
    
    for (const link of links) {
      const key = `${link.labTestId}:${link.conditionId}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      
      if (!DRY_RUN) {
        try {
          await prisma.labConditionLink.create({
            data: {
              id: crypto.randomUUID(),
              ...link,
              updatedAt: new Date()
            }
          });
          existingSet.add(key);
          created++;
        } catch (e) {
          // Likely duplicate, skip
        }
      } else {
        console.log(`    [DRY-RUN] Would create: ${labTest.name} -> ${link.conditionId}`);
        created++;
      }
    }
    
    console.log(`    Created ${links.length} links`);
  }
  
  console.log(`  ✅ Lab links: ${created} created, ${skipped} skipped`);
  return created;
}

async function processFindingLinks() {
  console.log('\n🩺 Processing Finding Condition Links...');
  
  const findings = await prisma.physicalExamFinding.findMany({
    select: { id: true, name: true, system: true }
  });
  
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true }
  });
  
  const existingLinks = await prisma.findingConditionLink.findMany({
    select: { findingId: true, conditionId: true }
  });
  const existingSet = new Set(existingLinks.map(l => `${l.findingId}:${l.conditionId}`));
  
  console.log(`  Found ${findings.length} findings, ${conditions.length} conditions`);
  console.log(`  Existing links: ${existingLinks.length}`);
  
  let created = 0;
  let skipped = 0;
  
  for (const finding of findings) {
    console.log(`  🔍 ${finding.name}...`);
    
    const links = await generateFindingLinks(finding, conditions);
    
    for (const link of links) {
      const key = `${link.findingId}:${link.conditionId}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      
      if (!DRY_RUN) {
        try {
          await prisma.findingConditionLink.create({
            data: {
              id: crypto.randomUUID(),
              ...link,
              updatedAt: new Date()
            }
          });
          existingSet.add(key);
          created++;
        } catch (e) {
          // Likely duplicate, skip
        }
      } else {
        console.log(`    [DRY-RUN] Would create: ${finding.name} -> ${link.conditionId}`);
        created++;
      }
    }
    
    console.log(`    Created ${links.length} links`);
  }
  
  console.log(`  ✅ Finding links: ${created} created, ${skipped} skipped`);
  return created;
}

async function processProcedureLinks() {
  console.log('\n🔪 Processing Procedure Condition Links...');
  
  const procedures = await prisma.procedure.findMany({
    select: { id: true, name: true, category: true }
  });
  
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true }
  });
  
  const existingLinks = await prisma.procedureConditionLink.findMany({
    select: { procedureId: true, conditionId: true }
  });
  const existingSet = new Set(existingLinks.map(l => `${l.procedureId}:${l.conditionId}`));
  
  console.log(`  Found ${procedures.length} procedures, ${conditions.length} conditions`);
  console.log(`  Existing links: ${existingLinks.length}`);
  
  let created = 0;
  let skipped = 0;
  
  for (const procedure of procedures) {
    console.log(`  🔧 ${procedure.name}...`);
    
    const links = await generateProcedureLinks(procedure, conditions);
    
    for (const link of links) {
      const key = `${link.procedureId}:${link.conditionId}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      
      if (!DRY_RUN) {
        try {
          await prisma.procedureConditionLink.create({
            data: {
              id: crypto.randomUUID(),
              ...link,
              updatedAt: new Date()
            }
          });
          existingSet.add(key);
          created++;
        } catch (e) {
          // Likely duplicate, skip
        }
      } else {
        console.log(`    [DRY-RUN] Would create: ${procedure.name} -> ${link.conditionId}`);
        created++;
      }
    }
    
    console.log(`    Created ${links.length} links`);
  }
  
  console.log(`  ✅ Procedure links: ${created} created, ${skipped} skipped`);
  return created;
}

async function processPhysiologyLinks() {
  console.log('\n🧬 Processing Physiology Condition Links...');
  
  const concepts = await prisma.physiologyConcept.findMany({
    select: { id: true, name: true, category: true }
  });
  
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true }
  });
  
  const existingLinks = await prisma.physiologyConditionLink.findMany({
    select: { physiologyId: true, conditionId: true }
  });
  const existingSet = new Set(existingLinks.map(l => `${l.physiologyId}:${l.conditionId}`));
  
  console.log(`  Found ${concepts.length} physiology concepts, ${conditions.length} conditions`);
  console.log(`  Existing links: ${existingLinks.length}`);
  
  let created = 0;
  let skipped = 0;
  
  for (const concept of concepts) {
    console.log(`  🧪 ${concept.name}...`);
    
    const links = await generatePhysiologyLinks(concept, conditions);
    
    for (const link of links) {
      const key = `${link.physiologyId}:${link.conditionId}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      
      if (!DRY_RUN) {
        try {
          await prisma.physiologyConditionLink.create({
            data: {
              id: crypto.randomUUID(),
              ...link,
              updatedAt: new Date()
            }
          });
          existingSet.add(key);
          created++;
        } catch (e) {
          // Likely duplicate, skip
        }
      } else {
        console.log(`    [DRY-RUN] Would create: ${concept.name} -> ${link.conditionId}`);
        created++;
      }
    }
    
    console.log(`    Created ${links.length} links`);
  }
  
  console.log(`  ✅ Physiology links: ${created} created, ${skipped} skipped`);
  return created;
}

async function processAnatomyLinks() {
  console.log('\n🦴 Processing Anatomy Condition Links...');
  
  const structures = await prisma.anatomyStructure.findMany({
    select: { id: true, name: true, system: true }
  });
  
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true }
  });
  
  const existingLinks = await prisma.anatomyConditionLink.findMany({
    select: { anatomyId: true, conditionId: true }
  });
  const existingSet = new Set(existingLinks.map(l => `${l.anatomyId}:${l.conditionId}`));
  
  console.log(`  Found ${structures.length} anatomy structures, ${conditions.length} conditions`);
  console.log(`  Existing links: ${existingLinks.length}`);
  
  let created = 0;
  let skipped = 0;
  
  for (const structure of structures) {
    console.log(`  🦴 ${structure.name}...`);
    
    const links = await generateAnatomyLinks(structure, conditions);
    
    for (const link of links) {
      const key = `${link.anatomyId}:${link.conditionId}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      
      if (!DRY_RUN) {
        try {
          await prisma.anatomyConditionLink.create({
            data: {
              id: crypto.randomUUID(),
              ...link,
              updatedAt: new Date()
            }
          });
          existingSet.add(key);
          created++;
        } catch (e) {
          // Likely duplicate, skip
        }
      } else {
        console.log(`    [DRY-RUN] Would create: ${structure.name} -> ${link.conditionId}`);
        created++;
      }
    }
    
    console.log(`    Created ${links.length} links`);
  }
  
  console.log(`  ✅ Anatomy links: ${created} created, ${skipped} skipped`);
  return created;
}

async function processDrugLinks() {
  console.log('\n💊 Processing Drug Condition Links...');
  
  const drugs = await prisma.drug.findMany({
    select: { id: true, genericName: true, drugClass: true }
  });
  
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true }
  });
  
  const existingLinks = await prisma.drugConditionLink.findMany({
    select: { drugId: true, conditionId: true, relationshipType: true }
  });
  const existingSet = new Set(existingLinks.map(l => `${l.drugId}:${l.conditionId}:${l.relationshipType}`));
  
  console.log(`  Found ${drugs.length} drugs, ${conditions.length} conditions`);
  console.log(`  Existing links: ${existingLinks.length}`);
  
  let created = 0;
  let skipped = 0;
  let processed = 0;
  
  // Process in batches to avoid overwhelming the API
  const BATCH_SIZE = 30;
  
  for (let i = 0; i < drugs.length; i += BATCH_SIZE) {
    const batch = drugs.slice(i, i + BATCH_SIZE);
    console.log(`\n  📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(drugs.length / BATCH_SIZE)} (drugs ${i + 1}-${Math.min(i + BATCH_SIZE, drugs.length)})`);
    
    for (const drug of batch) {
      processed++;
      console.log(`  💊 [${processed}/${drugs.length}] ${drug.genericName}...`);
      
      // Join drugClass array for the AI prompt
      const drugForPrompt = {
        id: drug.id,
        genericName: drug.genericName,
        drugClass: drug.drugClass.join(', ')
      };
      const links = await generateDrugLinks(drugForPrompt, conditions);
      
      for (const link of links) {
        const key = `${link.drugId}:${link.conditionId}:${link.relationshipType}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }
        
        if (!DRY_RUN) {
          try {
            await prisma.drugConditionLink.create({
              data: {
                id: crypto.randomUUID(),
                drugId: link.drugId,
                conditionId: link.conditionId,
                relationshipType: link.relationshipType,
                notes: link.notes,
                evidenceLevel: link.evidenceLevel,
                isFirstLine: link.isFirstLine,
                updatedAt: new Date()
              }
            });
            existingSet.add(key);
            created++;
          } catch (e) {
            // Likely duplicate, skip
          }
        } else {
          console.log(`    [DRY-RUN] Would create: ${drug.genericName} -> ${link.conditionId} (${link.relationshipType})`);
          created++;
        }
      }
      
      if (links.length > 0) {
        console.log(`    ✓ ${links.length} links`);
      }
    }
  }
  
  console.log(`\n  ✅ Drug links: ${created} created, ${skipped} skipped`);
  return created;
}

async function processTreatmentLinks() {
  console.log('\n💉 Processing Treatment Condition Links...');
  
  const treatments = await prisma.treatment.findMany({
    select: { id: true, name: true, category: true }
  });
  
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true }
  });
  
  const existingLinks = await prisma.treatmentConditionLink.findMany({
    select: { treatmentId: true, conditionId: true, relationshipType: true }
  });
  const existingSet = new Set(existingLinks.map(l => `${l.treatmentId}:${l.conditionId}:${l.relationshipType}`));
  
  console.log(`  Found ${treatments.length} treatments, ${conditions.length} conditions`);
  console.log(`  Existing links: ${existingLinks.length}`);
  
  let created = 0;
  let skipped = 0;
  let processed = 0;
  
  const BATCH_SIZE = 30;
  
  for (let i = 0; i < treatments.length; i += BATCH_SIZE) {
    const batch = treatments.slice(i, i + BATCH_SIZE);
    console.log(`\n  📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(treatments.length / BATCH_SIZE)} (treatments ${i + 1}-${Math.min(i + BATCH_SIZE, treatments.length)})`);
    
    for (const treatment of batch) {
      processed++;
      console.log(`  💉 [${processed}/${treatments.length}] ${treatment.name}...`);
      
      const links = await generateTreatmentLinks(treatment, conditions);
      
      for (const link of links) {
        const key = `${link.treatmentId}:${link.conditionId}:${link.relationshipType}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }
        
        if (!DRY_RUN) {
          try {
            await prisma.treatmentConditionLink.create({
              data: {
                id: crypto.randomUUID(),
                treatmentId: link.treatmentId,
                conditionId: link.conditionId,
                relationshipType: link.relationshipType,
                notes: link.notes,
                evidenceLevel: link.evidenceLevel,
                isFirstLine: link.isFirstLine,
                updatedAt: new Date()
              }
            });
            existingSet.add(key);
            created++;
          } catch (e) {
            // Likely duplicate, skip
          }
        } else {
          console.log(`    [DRY-RUN] Would create: ${treatment.name} -> ${link.conditionId} (${link.relationshipType})`);
          created++;
        }
      }
      
      if (links.length > 0) {
        console.log(`    ✓ ${links.length} links`);
      }
    }
  }
  
  console.log(`\n  ✅ Treatment links: ${created} created, ${skipped} skipped`);
  return created;
}

async function analyze() {
  console.log('\n📊 Current Link Table Status:\n');
  
  const tables = [
    { name: 'LabConditionLink', count: await prisma.labConditionLink.count() },
    { name: 'FindingConditionLink', count: await prisma.findingConditionLink.count() },
    { name: 'ProcedureConditionLink', count: await prisma.procedureConditionLink.count() },
    { name: 'PhysiologyConditionLink', count: await prisma.physiologyConditionLink.count() },
    { name: 'AnatomyConditionLink', count: await prisma.anatomyConditionLink.count() },
    { name: 'ECGConditionLink', count: await prisma.eCGConditionLink.count() },
    { name: 'ImagingConditionLink', count: await prisma.imagingConditionLink.count() },
    { name: 'DrugConditionLink', count: await prisma.drugConditionLink.count() },
    { name: 'TreatmentConditionLink', count: await prisma.treatmentConditionLink.count() },
  ];
  
  const contentTables = [
    { name: 'LabTest', count: await prisma.labTest.count() },
    { name: 'PhysicalExamFinding', count: await prisma.physicalExamFinding.count() },
    { name: 'Procedure', count: await prisma.procedure.count() },
    { name: 'PhysiologyConcept', count: await prisma.physiologyConcept.count() },
    { name: 'AnatomyStructure', count: await prisma.anatomyStructure.count() },
    { name: 'ECGPattern', count: await prisma.eCGPattern.count() },
    { name: 'ImagingStudy', count: await prisma.imagingStudy.count() },
    { name: 'Drug', count: await prisma.drug.count() },
    { name: 'Condition', count: await prisma.condition.count() },
  ];
  
  console.log('Link Tables:');
  for (const t of tables) {
    const status = t.count > 0 ? '✅' : '❌';
    console.log(`  ${status} ${t.name}: ${t.count}`);
  }
  
  console.log('\nContent Tables:');
  for (const t of contentTables) {
    const status = t.count > 0 ? '✅' : '⚠️';
    console.log(`  ${status} ${t.name}: ${t.count}`);
  }
}

// ================================
// MAIN
// ================================

async function main() {
  console.log('🔗 Multi Condition Link Generator');
  console.log('='.repeat(60));
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  }
  
  if (ANALYZE) {
    await analyze();
    await prisma.$disconnect();
    return;
  }
  
  // Show what we're going to process
  if (!GEN_LAB && !GEN_FINDING && !GEN_PROCEDURE && !GEN_PHYSIOLOGY && !GEN_ANATOMY && !GEN_TREATMENT && !GEN_DRUG) {
    console.log('\n⚠️  No link type specified. Use one of:');
    console.log('   --lab        Generate LabConditionLink');
    console.log('   --finding    Generate FindingConditionLink');
    console.log('   --procedure  Generate ProcedureConditionLink');
    console.log('   --physiology Generate PhysiologyConditionLink');
    console.log('   --anatomy    Generate AnatomyConditionLink');
    console.log('   --drug       Generate DrugConditionLink');
    console.log('   --treatment  Generate TreatmentConditionLink');
    console.log('   --all        Generate all link types');
    console.log('   --analyze    Show current status');
    console.log('   --dry-run    Preview mode');
    await prisma.$disconnect();
    return;
  }
  
  let totalCreated = 0;
  
  if (GEN_LAB) totalCreated += await processLabLinks();
  if (GEN_FINDING) totalCreated += await processFindingLinks();
  if (GEN_PROCEDURE) totalCreated += await processProcedureLinks();
  if (GEN_PHYSIOLOGY) totalCreated += await processPhysiologyLinks();
  if (GEN_ANATOMY) totalCreated += await processAnatomyLinks();
  if (GEN_DRUG) totalCreated += await processDrugLinks();
  if (GEN_TREATMENT) totalCreated += await processTreatmentLinks();
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Total links created: ${totalCreated}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
