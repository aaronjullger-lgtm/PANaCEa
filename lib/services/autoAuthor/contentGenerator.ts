/**
 * Auto-Author Content Generator
 * 
 * Uses Google Gemini to generate medical condition content.
 * Designed to work in both Node.js (scripts) and Cloudflare Workers (if needed).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  GeneratedConditionContent,
  GeneratedLabContent,
  GeneratedImagingContent,
  GeneratedTreatmentContent,
  GeneratedPhysiologyContent,
  ContentGenerationOptions,
  ContentGenerationResult,
} from "./types";

// Only use Gemini 2.5 models - these are the only ones that work with the API key
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];
const DEFAULT_TEMPERATURE = 0.7;
const MAX_RETRIES = 2;

async function generateTextWithFallback(
  apiKey: string,
  prompt: string,
  temperature: number
): Promise<{ text: string; modelUsed: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return { text, modelUsed: modelName };
    } catch (error) {
      lastError = error;
      console.warn(`Gemini model ${modelName} failed, trying fallback...`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Gemini models failed");
}

/**
 * Clean markdown code fences from AI response
 */
function stripCodeFences(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  
  // Remove ```json or ``` markers
  cleaned = cleaned.replace(/^```json\s*/gm, "").replace(/^```\s*/gm, "").replace(/```$/gm, "");
  
  return cleaned.trim();
}

/**
 * Build prompt for Gemini API
 */
function buildContentPrompt(options: ContentGenerationOptions): string {
  const { conditionName, system, subcategory, includeExtendedFields } = options;
  
  const basePrompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create a comprehensive, clinically accurate study guide entry for: "${conditionName}" (System: ${system}${subcategory ? `, Subcategory: ${subcategory}` : ""}).

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for diagnosis and treatment

${includeExtendedFields ? `
Return this exact JSON structure:
{
  "overview": "1-3 sentences defining the condition and its clinical significance",
  "etiologyPathophysiology": "Brief explanation of underlying mechanism and causes",
  "epidemiology": "Key demographics, prevalence, and population affected",
  "riskFactors": ["Risk factor 1", "Risk factor 2", "Risk factor 3"],
  "symptoms": ["Cardinal symptom 1", "Common symptom 2", "Associated symptom 3"],
  "examFindings": ["Key physical exam finding 1", "Finding 2", "Finding 3"],
  "diagnosis": "Gold standard diagnostic approach and key tests (2-3 sentences)",
  "treatment": "First-line and alternative treatment approaches (2-3 sentences)",
  "complications": ["Complication 1", "Complication 2"],
  "prognosis": "Brief prognostic statement with key factors",
  "differentialDiagnosis": ["Similar condition 1", "Similar condition 2", "Similar condition 3"],
  "clinicalPearls": ["High-yield pearl 1", "PANCE testable fact 2", "Clinical tip 3"]
}
` : `
Return this exact JSON structure:
{
  "overview": "1-3 sentences defining the condition and its clinical significance",
  "riskFactors": ["Risk factor 1", "Risk factor 2", "Risk factor 3"],
  "symptoms": ["Cardinal symptom 1", "Common symptom 2", "Associated symptom 3"],
  "diagnosis": "Gold standard diagnostic approach and key tests (2-3 sentences)",
  "treatment": "First-line and alternative treatment approaches (2-3 sentences)",
  "clinicalPearls": ["High-yield pearl 1", "PANCE testable fact 2", "Clinical tip 3"]
}
`}`;

  return basePrompt;
}

/**
 * Generate content for a medical condition using Gemini
 */
export async function generateConditionContent(
  apiKey: string,
  options: ContentGenerationOptions
): Promise<ContentGenerationResult> {
  if (!apiKey) {
    return {
      success: false,
      error: "API key is required",
    };
  }

  try {
    const prompt = buildContentPrompt(options);
    
    let lastError: Error | null = null;
    
    // Retry logic for transient failures
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { text, modelUsed } = await generateTextWithFallback(
          apiKey,
          prompt,
          options.temperature || DEFAULT_TEMPERATURE
        );
        
        // Clean response
        const cleanedText = stripCodeFences(text);
        
        // Parse JSON
        const parsed = JSON.parse(cleanedText);
        
        // Validate required fields
        if (!parsed.overview || !parsed.symptoms || !parsed.diagnosis || !parsed.treatment) {
          throw new Error("Missing required fields in generated content");
        }
        
        // Ensure arrays are arrays
        const content: GeneratedConditionContent = {
          overview: parsed.overview,
          symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [parsed.symptoms],
          riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
          diagnosis: parsed.diagnosis,
          treatment: parsed.treatment,
          clinicalPearls: Array.isArray(parsed.clinicalPearls) ? parsed.clinicalPearls : [],
          // Extended fields
          etiologyPathophysiology: parsed.etiologyPathophysiology,
          epidemiology: parsed.epidemiology,
          examFindings: Array.isArray(parsed.examFindings) ? parsed.examFindings : [],
          complications: Array.isArray(parsed.complications) ? parsed.complications : [],
          prognosis: parsed.prognosis,
          differentialDiagnosis: Array.isArray(parsed.differentialDiagnosis) ? parsed.differentialDiagnosis : [],
        };
        
        return {
          success: true,
          content,
          modelUsed,
        };
      } catch (err) {
        lastError = err as Error;
        
        if (attempt < MAX_RETRIES) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          console.log(`   Retry attempt ${attempt + 1} for ${options.conditionName}...`);
        }
      }
    }
    
    // All retries failed
    return {
      success: false,
      error: `Failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error during content generation",
    };
  }
}

/**
 * Batch generate content with rate limiting
 */
export async function batchGenerateContent(
  apiKey: string,
  conditions: ContentGenerationOptions[],
  delayMs: number = 2000
): Promise<ContentGenerationResult[]> {
  const results: ContentGenerationResult[] = [];
  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    console.log(`   [${i + 1}/${conditions.length}] Generating: ${condition.conditionName}...`);
    
    const result = await generateConditionContent(apiKey, condition);
    results.push(result);
    
    // Rate limiting (except for last item)
    if (i < conditions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

// ============================================================
// LAB TEST CONTENT GENERATION
// ============================================================

/**
 * Generate content for a lab test using Gemini
 */
export async function generateLabContent(
  apiKey: string,
  name: string,
  temperature: number = DEFAULT_TEMPERATURE
): Promise<ContentGenerationResult<GeneratedLabContent>> {
  if (!apiKey) {
    return {
      success: false,
      error: "API key is required",
    };
  }

  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create comprehensive clinical details for the lab test: "${name}".

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for interpretation

Return this exact JSON structure:
{
  "description": "2-3 sentences explaining what this test measures and its clinical significance",
  "typicalNormalRange": "Normal reference range with units (e.g., '3.5-5.0 mEq/L')",
  "commonAbnormalities": ["Elevated in condition A", "Decreased in condition B", "Abnormal pattern in C"],
  "indications": ["When to order this test 1", "Clinical scenario 2", "Diagnostic purpose 3"]
}`;

  try {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { text, modelUsed } = await generateTextWithFallback(apiKey, prompt, temperature);
        const cleanedText = stripCodeFences(text);
        const parsed = JSON.parse(cleanedText);
        
        if (!parsed.description || !parsed.commonAbnormalities || !parsed.indications) {
          throw new Error("Missing required fields in generated content");
        }
        
        const content: GeneratedLabContent = {
          description: parsed.description,
          typicalNormalRange: parsed.typicalNormalRange || null,
          commonAbnormalities: Array.isArray(parsed.commonAbnormalities) ? parsed.commonAbnormalities : [],
          indications: Array.isArray(parsed.indications) ? parsed.indications : [],
        };
        
        return { success: true, content, modelUsed };
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    
    return {
      success: false,
      error: `Failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error during content generation",
    };
  }
}

// ============================================================
// IMAGING STUDY CONTENT GENERATION
// ============================================================

/**
 * Generate content for an imaging study using Gemini
 */
export async function generateImagingContent(
  apiKey: string,
  name: string,
  temperature: number = DEFAULT_TEMPERATURE
): Promise<ContentGenerationResult<GeneratedImagingContent>> {
  if (!apiKey) {
    return {
      success: false,
      error: "API key is required",
    };
  }

  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create comprehensive clinical details for the imaging study: "${name}".

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for clinical use

Return this exact JSON structure:
{
  "description": "2-3 sentences explaining what this imaging modality visualizes and its role in diagnosis",
  "bestFor": ["Clinical scenario 1 where this is first-line", "Condition 2 best diagnosed with this", "Indication 3"],
  "limitations": ["What this study cannot detect", "When to use alternative imaging", "Technical limitation"],
  "radiationRisk": true or false (boolean indicating if ionizing radiation is involved)
}`;

  try {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { text, modelUsed } = await generateTextWithFallback(apiKey, prompt, temperature);
        const cleanedText = stripCodeFences(text);
        const parsed = JSON.parse(cleanedText);
        
        if (!parsed.description || !parsed.bestFor || !parsed.limitations) {
          throw new Error("Missing required fields in generated content");
        }
        
        const content: GeneratedImagingContent = {
          description: parsed.description,
          bestFor: Array.isArray(parsed.bestFor) ? parsed.bestFor : [],
          limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
          radiationRisk: Boolean(parsed.radiationRisk),
        };
        
        return { success: true, content, modelUsed };
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    
    return {
      success: false,
      error: `Failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error during content generation",
    };
  }
}

// ============================================================
// TREATMENT CONTENT GENERATION
// ============================================================

/**
 * Generate content for a treatment/drug using Gemini
 */
export async function generateTreatmentContent(
  apiKey: string,
  name: string,
  temperature: number = DEFAULT_TEMPERATURE
): Promise<ContentGenerationResult<GeneratedTreatmentContent>> {
  if (!apiKey) {
    return {
      success: false,
      error: "API key is required",
    };
  }

  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Create comprehensive clinical details for the treatment/drug: "${name}".

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Include specific, actionable information for clinical practice

Return this exact JSON structure:
{
  "description": "2-3 sentences describing what this treatment is and its general use",
  "mechanismOfAction": "Clear explanation of how this treatment works at the physiological level",
  "commonIndications": ["Primary indication 1", "Secondary use 2", "Off-label use 3"],
  "seriousSideEffects": ["Black box warning or serious adverse effect 1", "Major side effect 2", "Important monitoring parameter 3"]
}`;

  try {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { text, modelUsed } = await generateTextWithFallback(apiKey, prompt, temperature);
        const cleanedText = stripCodeFences(text);
        const parsed = JSON.parse(cleanedText);
        
        if (!parsed.description || !parsed.mechanismOfAction || !parsed.commonIndications || !parsed.seriousSideEffects) {
          throw new Error("Missing required fields in generated content");
        }
        
        const content: GeneratedTreatmentContent = {
          description: parsed.description,
          mechanismOfAction: parsed.mechanismOfAction,
          commonIndications: Array.isArray(parsed.commonIndications) ? parsed.commonIndications : [],
          seriousSideEffects: Array.isArray(parsed.seriousSideEffects) ? parsed.seriousSideEffects : [],
        };
        
        return { success: true, content, modelUsed };
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    
    return {
      success: false,
      error: `Failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error during content generation",
    };
  }
}

// ============================================================
// PHYSIOLOGY CONTENT GENERATION
// ============================================================

/**
 * Generate content for a physiology concept using Gemini
 */
export async function generatePhysiologyContent(
  apiKey: string,
  name: string,
  temperature: number = DEFAULT_TEMPERATURE
): Promise<ContentGenerationResult<GeneratedPhysiologyContent>> {
  if (!apiKey) {
    return {
      success: false,
      error: "API key is required",
    };
  }

  const prompt = `You are a medical education expert creating high-yield study content for PA students preparing for the PANCE exam.

Explain the physiology concept: "${name}".

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a valid JSON object (no markdown, no code blocks, no explanatory text)
2. Be concise but complete - focus on PANCE-relevant information
3. Use clinical terminology appropriately
4. Connect physiology to clinical medicine

Return this exact JSON structure:
{
  "description": "2-3 sentences defining this physiological concept and its normal function",
  "mechanism": "Detailed explanation of the underlying mechanism, pathway, or process",
  "clinicalSignificance": "How this concept relates to disease states, diagnosis, or treatment (2-3 sentences)"
}`;

  try {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { text, modelUsed } = await generateTextWithFallback(apiKey, prompt, temperature);
        const cleanedText = stripCodeFences(text);
        const parsed = JSON.parse(cleanedText);
        
        if (!parsed.description || !parsed.mechanism || !parsed.clinicalSignificance) {
          throw new Error("Missing required fields in generated content");
        }
        
        const content: GeneratedPhysiologyContent = {
          description: parsed.description,
          mechanism: parsed.mechanism,
          clinicalSignificance: parsed.clinicalSignificance,
        };
        
        return { success: true, content, modelUsed };
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    
    return {
      success: false,
      error: `Failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error during content generation",
    };
  }
}
