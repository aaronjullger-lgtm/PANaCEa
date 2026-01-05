/**
 * Image Upload Helper for Cline
 * 
 * This script provides functions for Cline to upload clinical images
 * and create MediaAsset records in the database.
 * 
 * All clinical context, explanations, and educational content are pulled
 * from the database (MedicalContent, Condition tables) - NOT from static data.
 * 
 * Usage (from Cline):
 *   npx tsx scripts/images/upload-helper.ts upload <imageUrl> <category> <diagnosis> <distractors>
 *   npx tsx scripts/images/upload-helper.ts batch <jsonFile>
 * 
 * Example:
 *   npx tsx scripts/images/upload-helper.ts upload "https://example.com/afib.jpg" ecg "Atrial Fibrillation" "Atrial Flutter,MAT,Sinus Arrhythmia"
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEDIA_BUCKET = "medical-images";

// ============================================================================
// TYPES
// ============================================================================

interface UploadResult {
  success: boolean;
  mediaAssetId?: string;
  storedUrl?: string;
  error?: string;
}

interface ClinicalContext {
  age: number;
  sex: "M" | "F";
  chiefComplaint: string;
  vitals: string;
  history: string;
  additionalFindings?: string[];
}

interface ImageMetadata {
  width?: number;
  height?: number;
  fileSize: number;
  mimeType: string;
}

interface BatchItem {
  imageUrl: string;
  category: "ecg" | "derm" | "radiology" | "labs" | "diagrams";
  correctDiagnosis: string;
  distractors: string[];
  description?: string;
  tags?: string[];
  sourceAttribution?: string;
  difficulty?: "easy" | "medium" | "hard";
  explanation?: string;
  clinicalContext?: Partial<ClinicalContext>;
}

// ============================================================================
// DATABASE CONTENT RETRIEVAL
// All educational content is pulled from the database
// ============================================================================

interface DatabaseContent {
  conditionId: string | null;
  system: string | null;
  overview: string | null;
  symptoms: string | null;
  physicalExam: string | null;
  diagnostics: string | null;
  treatment: string | null;
  classicPatient: string | null;
  clinicalPearls: string[] | null;
  buzzwords: string[] | null;
  differentials: string[] | null;
}

/**
 * Common medical synonym mappings
 * Maps colloquial/alternative names to database-standard names
 */
const DIAGNOSIS_SYNONYMS: Record<string, string[]> = {
  // Heart blocks
  "Complete Heart Block": ["Third-Degree AV Block", "3rd Degree AV Block", "Complete AV Block"],
  "Third Degree Heart Block": ["Third-Degree AV Block", "3rd Degree AV Block"],
  "First Degree Heart Block": ["First-Degree AV Block", "1st Degree AV Block"],
  "Second Degree Heart Block": ["Second-Degree AV Block"],
  "Mobitz I": ["Second-Degree AV Block (Mobitz I)", "Wenckebach"],
  "Mobitz II": ["Second-Degree AV Block (Mobitz II)"],
  "Wenckebach": ["Second-Degree AV Block (Mobitz I)", "Mobitz I"],
  
  // Arrhythmias
  "AFib": ["Atrial Fibrillation"],
  "AFlutter": ["Atrial Flutter"],
  "VTach": ["Ventricular Tachycardia"],
  "VFib": ["Ventricular Fibrillation"],
  "SVT": ["Supraventricular Tachycardia"],
  "MAT": ["Multifocal Atrial Tachycardia"],
  "PVC": ["Premature Ventricular Contraction"],
  "PAC": ["Premature Atrial Contraction"],
  "PSVT": ["Paroxysmal Supraventricular Tachycardia"],
  "WPW": ["Wolff-Parkinson-White"],
  "Torsades": ["Torsades de Pointes"],
  
  // MI types
  "STEMI": ["ST-Elevation Myocardial Infarction"],
  "NSTEMI": ["Non-ST-Elevation Myocardial Infarction"],
  "Heart Attack": ["Myocardial Infarction", "STEMI", "NSTEMI"],
  
  // Other cardiac
  "Long QT": ["Long QT Syndrome"],
  "Short QT": ["Short QT Syndrome"],
  "Brugada": ["Brugada Syndrome"],
  "HOCM": ["Hypertrophic Cardiomyopathy"],
  "DCM": ["Dilated Cardiomyopathy"],
  
  // Skin conditions
  "Shingles": ["Herpes Zoster"],
  "Chickenpox": ["Varicella"],
  "Cold Sore": ["Herpes Labialis"],
  "Ringworm": ["Tinea Corporis"],
  "Athlete's Foot": ["Tinea Pedis"],
  "Jock Itch": ["Tinea Cruris"],
  
  // Common abbreviations
  "PE": ["Pulmonary Embolism"],
  "DVT": ["Deep Vein Thrombosis"],
  "CHF": ["Congestive Heart Failure", "Heart Failure"],
  "COPD": ["Chronic Obstructive Pulmonary Disease"],
  "CAD": ["Coronary Artery Disease"],
  "HTN": ["Hypertension"],
  "DM": ["Diabetes Mellitus"],
  "CKD": ["Chronic Kidney Disease"],
  "AKI": ["Acute Kidney Injury"],
  "UTI": ["Urinary Tract Infection"],
  "PNA": ["Pneumonia"],
  "TB": ["Tuberculosis"],
  "MS": ["Multiple Sclerosis"],
  "RA": ["Rheumatoid Arthritis"],
  "SLE": ["Systemic Lupus Erythematosus"],
  "IBD": ["Inflammatory Bowel Disease"],
  "GERD": ["Gastroesophageal Reflux Disease"],
};

/**
 * Get alternative search terms for a diagnosis
 */
function getAlternativeSearchTerms(diagnosis: string): string[] {
  const alternatives: string[] = [diagnosis];
  
  // Check if this diagnosis has known synonyms
  const synonyms = DIAGNOSIS_SYNONYMS[diagnosis];
  if (synonyms) {
    alternatives.push(...synonyms);
  }
  
  // Also check if the diagnosis IS a synonym of something
  for (const [canonical, syns] of Object.entries(DIAGNOSIS_SYNONYMS)) {
    if (syns.some(s => s.toLowerCase() === diagnosis.toLowerCase())) {
      alternatives.push(canonical);
    }
  }
  
  return Array.from(new Set(alternatives)); // Remove duplicates
}

/**
 * Fetch condition and medical content from the database
 * Uses a tiered matching strategy to find the best match
 */
async function fetchDatabaseContent(
  prisma: PrismaClient,
  diagnosis: string
): Promise<DatabaseContent | null> {
  try {
    // Get alternative search terms (synonyms)
    const searchTerms = getAlternativeSearchTerms(diagnosis);
    console.log(`   🔎 Searching for: ${searchTerms.join(', ')}`);
    
    let condition = null;
    
    // Try each search term
    for (const term of searchTerms) {
      // Normalize the term for searching
      const normalizedTerm = term.toLowerCase().trim();
      const termWords = normalizedTerm.split(/\s+/).filter(w => w.length > 2);
      
      // TIER 1: Exact name match (case-insensitive)
      condition = await prisma.condition.findFirst({
        where: { name: { equals: term, mode: "insensitive" } },
        select: { id: true, name: true, system: true, aliases: true },
      });
      if (condition) break;

      // TIER 2: Check if term exists in aliases
      condition = await prisma.condition.findFirst({
        where: { aliases: { has: term } },
        select: { id: true, name: true, system: true, aliases: true },
      });
      if (condition) break;

      // TIER 3: Search by condition ID pattern (e.g., "third_degree_av_block" in ID)
      const idPattern = normalizedTerm.replace(/\s+/g, "_");
      condition = await prisma.condition.findFirst({
        where: { id: { contains: idPattern, mode: "insensitive" } },
        select: { id: true, name: true, system: true, aliases: true },
      });
      if (condition) break;

      // TIER 4: Full phrase contained in name
      condition = await prisma.condition.findFirst({
        where: { name: { contains: term, mode: "insensitive" } },
        select: { id: true, name: true, system: true, aliases: true },
      });
      if (condition) break;
    }
    
    // If still not found after all synonyms, try multi-word matching on original diagnosis
    const normalizedDiagnosis = diagnosis.toLowerCase().trim();
    const diagnosisWords = normalizedDiagnosis.split(/\s+/).filter(w => w.length > 2);

    // TIER 5: Multi-word matching - require ALL significant words to match
    if (!condition && diagnosisWords.length >= 2) {
      // Get candidates that contain the first significant word
      const candidates = await prisma.condition.findMany({
        where: { 
          OR: [
            { name: { contains: diagnosisWords[0], mode: "insensitive" } },
            { id: { contains: diagnosisWords[0], mode: "insensitive" } },
          ]
        },
        select: { id: true, name: true, system: true, aliases: true },
        take: 50,
      });

      // Score each candidate by how many words match
      let bestMatch: typeof condition = null;
      let bestScore = 0;

      for (const candidate of candidates) {
        const candidateName = candidate.name.toLowerCase();
        const candidateId = candidate.id.toLowerCase();
        let score = 0;
        
        for (const word of diagnosisWords) {
          if (candidateName.includes(word) || candidateId.includes(word)) {
            score++;
          }
        }
        
        // Require at least 2 words to match, or all words for short diagnoses
        const minRequired = Math.min(2, diagnosisWords.length);
        if (score >= minRequired && score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
        }
      }
      
      condition = bestMatch;
    }

    // TIER 6: Single significant word (avoid common words like "complete", "acute", etc.)
    if (!condition) {
      const commonWords = new Set(['complete', 'incomplete', 'acute', 'chronic', 'severe', 'mild', 'moderate', 'primary', 'secondary', 'type', 'grade', 'stage', 'first', 'second', 'third']);
      const significantWords = diagnosisWords.filter(w => !commonWords.has(w) && w.length > 4);
      
      for (const word of significantWords) {
        condition = await prisma.condition.findFirst({
          where: { 
            OR: [
              { name: { contains: word, mode: "insensitive" } },
              { id: { contains: word, mode: "insensitive" } },
            ]
          },
          select: { id: true, name: true, system: true, aliases: true },
        });
        if (condition) break;
      }
    }

    if (!condition) {
      console.log(`   ⚠️ No matching Condition found in database for: ${diagnosis}`);
      return null;
    }

    console.log(`   ✅ Found Condition: ${condition.id} (${condition.name})`);

    // Now fetch MedicalContent using the condition ID pattern
    // MedicalContent.conditionId often matches patterns like "CV__ecg__atrial_fibrillation"
    const medicalContent = await prisma.medicalContent.findFirst({
      where: {
        OR: [
          { conditionId: condition.id },
          { conditionId: { contains: condition.name.toLowerCase().replace(/\s+/g, "_"), mode: "insensitive" } },
          { condition: { equals: condition.name, mode: "insensitive" } },
        ]
      },
      select: {
        conditionId: true,
        system: true,
        overview: true,
        symptoms: true,
        physicalExam: true,
        diagnostics: true,
        treatment: true,
        classic_patient: true,
        clinical_pearls: true,
        buzzwords: true,
        differentials: true,
      },
    });

    if (medicalContent) {
      console.log(`   ✅ Found MedicalContent: ${medicalContent.conditionId}`);
      return {
        conditionId: condition.id,
        system: medicalContent.system || condition.system,
        overview: medicalContent.overview,
        symptoms: medicalContent.symptoms,
        physicalExam: medicalContent.physicalExam,
        diagnostics: medicalContent.diagnostics,
        treatment: medicalContent.treatment,
        classicPatient: medicalContent.classic_patient,
        clinicalPearls: medicalContent.clinical_pearls as string[] | null,
        buzzwords: medicalContent.buzzwords,
        differentials: medicalContent.differentials as string[] | null,
      };
    }

    // Return just condition info if no MedicalContent found
    console.log(`   ⚠️ No MedicalContent found, using Condition data only`);
    return {
      conditionId: condition.id,
      system: condition.system,
      overview: null,
      symptoms: null,
      physicalExam: null,
      diagnostics: null,
      treatment: null,
      classicPatient: null,
      clinicalPearls: null,
      buzzwords: null,
      differentials: null,
    };
  } catch (error) {
    console.error("   ❌ Database content fetch error:", error);
    return null;
  }
}

/**
 * Build clinical context from database content
 */
function buildClinicalContextFromDb(
  dbContent: DatabaseContent | null,
  diagnosis: string,
  modality: string
): ClinicalContext {
  const sexOptions: Array<"M" | "F"> = ["M", "F"];
  const defaultAge = 45 + Math.floor(Math.random() * 30);
  const defaultSex = sexOptions[Math.floor(Math.random() * 2)];

  if (!dbContent) {
    return {
      age: defaultAge,
      sex: defaultSex,
      chiefComplaint: `Evaluation for possible ${diagnosis}`,
      vitals: "BP 128/82, HR 78, Temp 98.6°F, RR 14, SpO2 98%",
      history: `Patient presents for clinical evaluation.`,
    };
  }

  // Extract chief complaint from classic patient or symptoms
  let chiefComplaint = `Evaluation for ${diagnosis}`;
  if (dbContent.classicPatient) {
    chiefComplaint = dbContent.classicPatient;
  } else if (dbContent.symptoms) {
    // Try to parse symptoms (could be JSON array or string)
    try {
      const symptomsArr = typeof dbContent.symptoms === 'string' && dbContent.symptoms.startsWith('[')
        ? JSON.parse(dbContent.symptoms)
        : [dbContent.symptoms];
      if (Array.isArray(symptomsArr) && symptomsArr.length > 0) {
        // Clean markdown and take first symptom
        chiefComplaint = symptomsArr[0].replace(/\*\*/g, '').replace(/\*/g, '').substring(0, 100);
      }
    } catch {
      chiefComplaint = dbContent.symptoms.substring(0, 100);
    }
  }

  // Extract physical exam findings
  let additionalFindings: string[] = [];
  if (dbContent.physicalExam) {
    try {
      const examData = typeof dbContent.physicalExam === 'string' && dbContent.physicalExam.startsWith('{')
        ? JSON.parse(dbContent.physicalExam)
        : dbContent.physicalExam;
      if (typeof examData === 'object') {
        additionalFindings = Object.values(examData).slice(0, 3).map(v => 
          String(v).replace(/\*\*/g, '').substring(0, 80)
        );
      }
    } catch {
      // Not JSON, extract key phrases
      const examStr = String(dbContent.physicalExam);
      const matches = examStr.match(/\*\*([^*]+)\*\*/g);
      if (matches) {
        additionalFindings = matches.slice(0, 3).map(m => m.replace(/\*\*/g, ''));
      }
    }
  }

  // Generate appropriate vitals based on system
  let vitals = "BP 128/82, HR 78, Temp 98.6°F, RR 14, SpO2 98%";
  if (dbContent.system === 'CV' || modality === 'ecg') {
    vitals = "BP 130/85, HR 95 (irregular), RR 16, SpO2 96%";
  } else if (dbContent.system === 'PULM' || modality === 'radiology') {
    vitals = "BP 125/80, HR 88, Temp 99.2°F, RR 20, SpO2 94%";
  } else if (dbContent.system === 'DERM' || modality === 'derm') {
    vitals = "BP 122/78, HR 72, Temp 98.6°F, RR 14";
  }

  // Build history from overview
  let history = `Patient presents for clinical evaluation.`;
  if (dbContent.overview) {
    // Extract first 1-2 sentences from overview
    const sentences = dbContent.overview
      .replace(/\*\*/g, '')
      .split(/[.!?]/)
      .filter(s => s.trim().length > 20)
      .slice(0, 2);
    if (sentences.length > 0) {
      history = sentences.join('. ').substring(0, 200) + '.';
    }
  }

  return {
    age: defaultAge,
    sex: defaultSex,
    chiefComplaint,
    vitals,
    history,
    additionalFindings: additionalFindings.length > 0 ? additionalFindings : undefined,
  };
}

/**
 * Build explanation from database content
 */
function buildExplanationFromDb(
  dbContent: DatabaseContent | null,
  diagnosis: string,
  modality: string
): string {
  if (!dbContent) {
    const modalityName = modality === 'ecg' ? 'ECG' : modality === 'derm' ? 'dermatological' : 'imaging';
    return `This ${modalityName} finding is consistent with ${diagnosis}. Review the characteristic features that distinguish it from similar presentations.`;
  }

  const parts: string[] = [];

  // Add overview excerpt
  if (dbContent.overview) {
    const cleanOverview = dbContent.overview.replace(/\*\*/g, '').replace(/\n+/g, ' ');
    const firstParagraph = cleanOverview.split(/\n\n/)[0].substring(0, 300);
    parts.push(firstParagraph);
  }

  // Add clinical pearls
  if (dbContent.clinicalPearls && Array.isArray(dbContent.clinicalPearls) && dbContent.clinicalPearls.length > 0) {
    const pearl = dbContent.clinicalPearls[0].replace(/\*\*/g, '').substring(0, 150);
    parts.push(`Key pearl: ${pearl}`);
  }

  // Add buzzwords for recognition
  if (dbContent.buzzwords && dbContent.buzzwords.length > 0) {
    const keywords = dbContent.buzzwords
      .slice(0, 4)
      .map(b => b.replace(/\*\*/g, ''))
      .join(', ');
    parts.push(`Look for: ${keywords}`);
  }

  if (parts.length === 0) {
    const modalityName = modality === 'ecg' ? 'ECG' : modality === 'derm' ? 'dermatological' : 'imaging';
    return `This ${modalityName} finding is consistent with ${diagnosis}. Review the characteristic features.`;
  }

  return parts.join(' ').substring(0, 600);
}

/**
 * Build tags from database content
 */
function buildTagsFromDb(
  dbContent: DatabaseContent | null,
  category: string,
  modality: string,
  diagnosis: string
): string[] {
  const tags = [category, modality, diagnosis];

  if (dbContent) {
    if (dbContent.system) tags.push(dbContent.system);
    
    // Add buzzwords as tags
    if (dbContent.buzzwords && dbContent.buzzwords.length > 0) {
      const cleanBuzzwords = dbContent.buzzwords
        .slice(0, 5)
        .map(b => b.replace(/\*\*/g, '').replace(/[^\w\s-]/g, '').trim())
        .filter(b => b.length > 2 && b.length < 40);
      tags.push(...cleanBuzzwords);
    }
  }

  return Array.from(new Set(tags)); // Remove duplicates
}

/**
 * Build description from database content
 */
function buildDescriptionFromDb(
  dbContent: DatabaseContent | null,
  diagnosis: string,
  modality: string
): string {
  const modalityName = modality === 'ecg' ? 'ECG rhythm strip' : modality === 'derm' ? 'clinical photograph' : 'medical imaging study';

  if (!dbContent || !dbContent.overview) {
    return `Clinical ${modalityName} demonstrating ${diagnosis}.`;
  }

  // Extract key features from overview
  const cleanOverview = dbContent.overview.replace(/\*\*/g, '');
  const firstSentence = cleanOverview.split(/[.!?]/)[0].trim();
  
  return `Clinical ${modalityName} demonstrating ${diagnosis}. ${firstSentence}.`.substring(0, 300);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================


function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").substring(0, 50);
}

/**
 * Extract image dimensions from buffer using magic bytes
 * Supports JPEG, PNG, GIF, WebP
 */
function getImageDimensions(buffer: ArrayBuffer): { width: number; height: number } | null {
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);
  
  try {
    // PNG: bytes 16-23 contain width and height
    if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
      const width = view.getUint32(16, false);
      const height = view.getUint32(20, false);
      return { width, height };
    }
    
    // JPEG: need to find SOF0 marker
    if (uint8[0] === 0xFF && uint8[1] === 0xD8) {
      let offset = 2;
      while (offset < uint8.length - 9) {
        if (uint8[offset] !== 0xFF) {
          offset++;
          continue;
        }
        const marker = uint8[offset + 1];
        // SOF0, SOF1, SOF2 markers contain dimensions
        if (marker >= 0xC0 && marker <= 0xC2) {
          const height = view.getUint16(offset + 5, false);
          const width = view.getUint16(offset + 7, false);
          return { width, height };
        }
        // Skip to next marker
        const length = view.getUint16(offset + 2, false);
        offset += 2 + length;
      }
    }
    
    // GIF: bytes 6-9 contain width and height (little endian)
    if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46) {
      const width = view.getUint16(6, true);
      const height = view.getUint16(8, true);
      return { width, height };
    }
    
    // WebP: more complex, skip for now
    
  } catch (e) {
    console.warn("Could not parse image dimensions:", e);
  }
  
  return null;
}

/**
 * Detect MIME type from buffer magic bytes
 */
function detectMimeType(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  
  // PNG
  if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
    return "image/png";
  }
  // JPEG
  if (uint8[0] === 0xFF && uint8[1] === 0xD8) {
    return "image/jpeg";
  }
  // GIF
  if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46) {
    return "image/gif";
  }
  // WebP
  if (uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46 &&
      uint8[8] === 0x57 && uint8[9] === 0x45 && uint8[10] === 0x42 && uint8[11] === 0x50) {
    return "image/webp";
  }
  
  return "image/jpeg"; // Default fallback
}

/**
 * Look up condition in database to get conditionId
 */
async function findConditionId(prisma: PrismaClient, diagnosis: string): Promise<string | null> {
  try {
    // Try exact match first
    const exact = await prisma.condition.findFirst({
      where: { name: { equals: diagnosis, mode: "insensitive" } },
      select: { id: true },
    });
    if (exact) return exact.id;
    
    // Try contains match
    const partial = await prisma.condition.findFirst({
      where: { name: { contains: diagnosis, mode: "insensitive" } },
      select: { id: true },
    });
    if (partial) return partial.id;
    
    // Try search in aliases or alternate names
    const byAlias = await prisma.condition.findFirst({
      where: {
        OR: [
          { aliases: { has: diagnosis } },
          { name: { contains: diagnosis.split(" ")[0], mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    return byAlias?.id || null;
  } catch (e) {
    console.warn("Could not find condition:", diagnosis);
    return null;
  }
}

async function ensureBucketExists(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return false;
  }

  try {
    // Check if bucket exists
    const checkResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/bucket/${MEDIA_BUCKET}`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (checkResponse.ok) {
      return true;
    }

    // Create bucket if it doesn"t exist
    console.log(`📦 Creating bucket: ${MEDIA_BUCKET}`);
    const createResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/bucket`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: MEDIA_BUCKET,
          name: MEDIA_BUCKET,
          public: true,
          file_size_limit: 10485760, // 10MB
          allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        }),
      }
    );

    if (createResponse.ok) {
      console.log(`✅ Bucket created: ${MEDIA_BUCKET}`);
      return true;
    } else {
      const error = await createResponse.text();
      console.error(`Failed to create bucket: ${error}`);
      return false;
    }
  } catch (error) {
    console.error("Bucket check error:", error);
    return false;
  }
}

interface DownloadResult {
  buffer: ArrayBuffer;
  contentType: string;
  metadata: ImageMetadata;
}

async function downloadImage(url: string): Promise<DownloadResult | null> {
  try {
    let buffer: ArrayBuffer;
    let contentType: string;
    
    if (url.startsWith("http")) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!response.ok) {
        console.error(`Failed to download image: ${response.status}`);
        return null;
      }
      contentType = response.headers.get("content-type") || "image/jpeg";
      buffer = await response.arrayBuffer();
    } else {
      // Local file - resolve path
      const path = await import("path");
      let filePath = url;
      
      // If not an absolute path, try to resolve it
      if (!url.startsWith("/")) {
        // Check common locations
        const possiblePaths = [
          url,
          path.join(process.cwd(), url),
          path.join(process.cwd(), "scripts/images", url),
          path.join(process.cwd(), "public", url),
          path.join(process.cwd(), "temp", url),
        ];
        
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            filePath = p;
            break;
          }
        }
      }
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Local file not found: ${url}`);
        console.error(`   Tried paths: ${filePath}`);
        console.error(`   Hint: Use a full URL (https://...) or an absolute file path`);
        return null;
      }
      
      console.log(`📂 Reading local file: ${filePath}`);
      const fileBuffer = fs.readFileSync(filePath);
      buffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
      
      // Detect content type from file
      const ext = filePath.toLowerCase().split('.').pop();
      const extToMime: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
      };
      contentType = extToMime[ext || ''] || "image/jpeg";
    }
    
    // Extract metadata
    const detectedMime = detectMimeType(buffer);
    const dimensions = getImageDimensions(buffer);
    
    const metadata: ImageMetadata = {
      fileSize: buffer.byteLength,
      mimeType: detectedMime,
      width: dimensions?.width,
      height: dimensions?.height,
    };
    
    return { buffer, contentType: detectedMime, metadata };
  } catch (error) {
    console.error("Download error:", error);
    return null;
  }
}

async function uploadToSupabase(
  buffer: ArrayBuffer,
  contentType: string,
  path: string
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase credentials not configured");
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: buffer,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Supabase upload failed: ${error}`);
      return null;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
  } catch (error) {
    console.error("Upload error:", error);
    return null;
  }
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function uploadSingleImage(
  imageUrl: string,
  category: string,
  correctDiagnosis: string,
  distractors: string[],
  options: {
    description?: string;
    tags?: string[];
    sourceAttribution?: string;
    // Difficulty is always PANCE-level (stored as 'medium')
    explanation?: string;
    clinicalContext?: Partial<ClinicalContext>;
  } = {}
): Promise<UploadResult> {
  const prisma = new PrismaClient();

  try {
    // Validate inputs
    if (!imageUrl || !category || !correctDiagnosis || distractors.length < 3) {
      return {
        success: false,
        error:
          "Missing required fields: imageUrl, category, correctDiagnosis, and 3+ distractors",
      };
    }

    // Map category to normalized modality
    const modalityMap: Record<string, string> = {
      ecg: "ecg",
      ekg: "ecg",
      derm: "derm",
      photo: "derm",
      radiology: "radiology",
      xray: "radiology",
      ct: "radiology",
      mri: "radiology",
      labs: "labs",
      diagrams: "diagrams",
    };
    const modality = modalityMap[category.toLowerCase()] || "radiology";

    // Ensure bucket exists
    const bucketReady = await ensureBucketExists();
    if (!bucketReady) {
      return { success: false, error: "Failed to ensure storage bucket exists" };
    }

    // Download image with metadata extraction
    console.log(`📥 Downloading: ${imageUrl}`);
    const imageData = await downloadImage(imageUrl);
    if (!imageData) {
      return { success: false, error: "Failed to download image" };
    }

    console.log(`📊 Image metadata: ${imageData.metadata.width}x${imageData.metadata.height}, ${(imageData.metadata.fileSize / 1024).toFixed(1)}KB, ${imageData.metadata.mimeType}`);

    // Generate filename and path
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    const ext = extMap[imageData.metadata.mimeType] || "jpg";
    const sanitizedName = sanitizeFilename(correctDiagnosis);
    const filename = `${sanitizedName}_${Date.now()}.${ext}`;
    const storagePath = `${category}/${filename}`;

    // Upload to Supabase
    console.log(`📤 Uploading to: ${storagePath}`);
    const storedUrl = await uploadToSupabase(
      imageData.buffer,
      imageData.contentType,
      storagePath
    );
    if (!storedUrl) {
      return { success: false, error: "Failed to upload to Supabase Storage" };
    }

    // ========================================================================
    // FETCH ALL CONTENT FROM DATABASE (not static data)
    // ========================================================================
    console.log(`🔍 Fetching content from database for: ${correctDiagnosis}`);
    const dbContent = await fetchDatabaseContent(prisma, correctDiagnosis);
    
    // Build clinical context from database
    const clinicalContext = options.clinicalContext
      ? {
          age: options.clinicalContext.age || 50,
          sex: options.clinicalContext.sex || "M" as const,
          chiefComplaint: options.clinicalContext.chiefComplaint || `Evaluation for ${correctDiagnosis}`,
          vitals: options.clinicalContext.vitals || "BP 128/82, HR 78, Temp 98.6°F, RR 14",
          history: options.clinicalContext.history || "Patient presents for clinical evaluation",
          additionalFindings: options.clinicalContext.additionalFindings,
        }
      : buildClinicalContextFromDb(dbContent, correctDiagnosis, modality);

    // Build explanation from database
    const explanation = options.explanation || buildExplanationFromDb(dbContent, correctDiagnosis, modality);

    // Build tags from database
    const tags = options.tags || buildTagsFromDb(dbContent, category, modality, correctDiagnosis);

    // Build description from database
    const description = options.description || buildDescriptionFromDb(dbContent, correctDiagnosis, modality);

    // Generate alt text for accessibility
    const modalityName = modality === 'ecg' ? 'ECG rhythm strip' : modality === 'derm' ? 'clinical photograph' : 'medical imaging study';
    const altText = `${modalityName} showing ${correctDiagnosis}`;

    // Create MediaAsset record with all fields populated from database
    console.log(`💾 Creating MediaAsset record...`);
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        id: generateId(),
        conditionId: dbContent?.conditionId || null,
        type: category,
        modality,
        filename,
        originalUrl: storedUrl,
        thumbnailUrl: storedUrl, // Same URL, Supabase can transform
        mimeType: imageData.metadata.mimeType,
        fileSize: imageData.metadata.fileSize,
        dimensions: imageData.metadata.width && imageData.metadata.height
          ? { width: imageData.metadata.width, height: imageData.metadata.height }
          : undefined,
        tags,
        description,
        altText,
        correctDiagnosis,
        distractors,
        explanation,
        clinicalContext: JSON.parse(JSON.stringify(clinicalContext)),
        difficulty: "medium", // All questions are PANCE-level
        sourceQuality: "high",
        qualityScore: 0.85,
        confidence: 0.9,
        approvalStatus: "pending",
        status: "pending_review",
        folder: "inbox",
        mediaType: "image",
        isClinical: true,
        sourceUrl: imageUrl,
        citation: options.sourceAttribution,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Created MediaAsset: ${mediaAsset.id}`);
    console.log(`   📋 Condition ID: ${dbContent?.conditionId || 'none (not found in DB)'}`);
    console.log(`   📐 Dimensions: ${imageData.metadata.width}x${imageData.metadata.height}`);
    console.log(`   🏷️ Tags: ${tags.slice(0, 5).join(', ')}${tags.length > 5 ? '...' : ''}`);
    console.log(`   📝 Clinical Context: ${clinicalContext.chiefComplaint.substring(0, 50)}...`);
    
    return {
      success: true,
      mediaAssetId: mediaAsset.id,
      storedUrl,
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function uploadBatch(items: BatchItem[]): Promise<void> {
  console.log(`\n📦 Processing batch of ${items.length} images...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n[${i + 1}/${items.length}] ${item.correctDiagnosis}`);

    const result = await uploadSingleImage(
      item.imageUrl,
      item.category,
      item.correctDiagnosis,
      item.distractors,
      {
        description: item.description,
        tags: item.tags,
        sourceAttribution: item.sourceAttribution,
        difficulty: 'medium', // All questions are PANCE-level
        explanation: item.explanation,
        clinicalContext: item.clinicalContext,
      }
    );

    if (result.success) {
      successCount++;
    } else {
      errorCount++;
      console.error(`   ❌ Error: ${result.error}`);
    }

    // Rate limiting
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`════════════════════════════════════════\n`);
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Missing Supabase credentials");
    console.log("Required environment variables:");
    console.log("  VITE_SUPABASE_URL");
    console.log("  SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  switch (command) {
    case "upload": {
      const [, imageUrl, category, diagnosis, distractorsStr] = args;
      if (!imageUrl || !category || !diagnosis || !distractorsStr) {
        console.log(
          "Usage: npx tsx scripts/images/upload-helper.ts upload <imageUrl> <category> <diagnosis> <distractors>"
        );
        console.log("  category: ecg, derm, radiology, labs, diagrams");
        console.log("  distractors: comma-separated list (min 3)");
        console.log("\nExample:");
        console.log(
          `  npx tsx scripts/images/upload-helper.ts upload "https://example.com/afib.jpg" ecg "Atrial Fibrillation" "Atrial Flutter,MAT,Sinus Arrhythmia"`
        );
        process.exit(1);
      }

      const distractors = distractorsStr.split(",").map((d) => d.trim());
      const result = await uploadSingleImage(
        imageUrl,
        category,
        diagnosis,
        distractors
      );

      if (result.success) {
        console.log(`\n✅ Success!`);
        console.log(`   MediaAsset ID: ${result.mediaAssetId}`);
        console.log(`   Stored URL: ${result.storedUrl}`);
      } else {
        console.error(`\n❌ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case "batch": {
      const [, jsonFile] = args;
      if (!jsonFile) {
        console.log(
          "Usage: npx tsx scripts/images/upload-helper.ts batch <jsonFile>"
        );
        console.log("\nJSON file format:");
        console.log("[");
        console.log("  {");
        console.log(`    "imageUrl": "https://example.com/image.jpg",`);
        console.log(`    "category": "ecg",`);
        console.log(`    "correctDiagnosis": "Atrial Fibrillation",`);
        console.log(
          `    "distractors": ["Atrial Flutter", "MAT", "Sinus Arrhythmia"],`
        );
        console.log(`    "description": "Classic AFib pattern",`);
        console.log(`    "sourceAttribution": "Source name"`);
        console.log("  }");
        console.log("]");
        process.exit(1);
      }

      const fs = await import("fs");
      const content = fs.readFileSync(jsonFile, "utf-8");
      const items: BatchItem[] = JSON.parse(content);
      await uploadBatch(items);
      break;
    }

    case "test": {
      // Test connection
      console.log("Testing Supabase connection...");
      console.log(`  URL: ${SUPABASE_URL}`);
      console.log(`  Bucket: ${MEDIA_BUCKET}`);
      console.log(
        `  Service Key: ${
          SUPABASE_SERVICE_KEY
            ? `${SUPABASE_SERVICE_KEY.substring(0, 20)}...`
            : "NOT SET"
        }`
      );

      try {
        // First list all buckets
        console.log("\n1. Listing all buckets...");
        const listResponse = await fetch(
          `${SUPABASE_URL}/storage/v1/bucket`,
          {
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              apikey: SUPABASE_SERVICE_KEY,
            },
          }
        );

        const listText = await listResponse.text();
        console.log(`   Status: ${listResponse.status}`);

        if (listResponse.ok) {
          const buckets = JSON.parse(listText);
          console.log(
            `   Found ${buckets.length} buckets:`,
            buckets.map((b: any) => b.name)
          );

          const hasMedicalImages = buckets.some(
            (b: any) => b.name === MEDIA_BUCKET
          );
          if (hasMedicalImages) {
            console.log(`   ✅ "${MEDIA_BUCKET}" bucket exists!`);
          } else {
            console.log(`   ⚠️ "${MEDIA_BUCKET}" bucket not found. Creating...`);

            const createResponse = await fetch(
              `${SUPABASE_URL}/storage/v1/bucket`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                  apikey: SUPABASE_SERVICE_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  id: MEDIA_BUCKET,
                  name: MEDIA_BUCKET,
                  public: true,
                  file_size_limit: 52428800, // 50MB
                  allowed_mime_types: [
                    "image/jpeg",
                    "image/png",
                    "image/gif",
                    "image/webp",
                  ],
                }),
              }
            );

            if (createResponse.ok) {
              console.log(`   ✅ Created "${MEDIA_BUCKET}" bucket!`);
            } else {
              const createError = await createResponse.text();
              console.log(
                `   ❌ Failed to create bucket: ${createResponse.status} - ${createError}`
              );
            }
          }
        } else {
          console.log(`   ❌ Error listing buckets: ${listText}`);
        }

        // Test upload capability
        console.log("\n2. Testing upload capability...");
        const testBlob = new Blob(["test"], { type: "text/plain" });
        const uploadResponse = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/test-connection.txt`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              apikey: SUPABASE_SERVICE_KEY,
              "Content-Type": "text/plain",
            },
            body: testBlob,
          }
        );

        if (uploadResponse.ok || uploadResponse.status === 200) {
          console.log("   ✅ Upload test successful!");

          // Clean up test file
          await fetch(
            `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/test-connection.txt`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                apikey: SUPABASE_SERVICE_KEY,
              },
            }
          );
          console.log("   ✅ Cleanup successful!");
        } else {
          const uploadError = await uploadResponse.text();
          console.log(
            `   ❌ Upload test failed: ${uploadResponse.status} - ${uploadError}`
          );
        }

        console.log("\n✅ Supabase connection test complete!");
      } catch (error) {
        console.error("❌ Connection failed:", error);
      }
      break;
    }

    default:
      console.log("Clinical Image Upload Helper");
      console.log("============================");
      console.log("\nCommands:");
      console.log("  upload <imageUrl> <category> <diagnosis> <distractors>");
      console.log("  batch <jsonFile>");
      console.log("  test");
      console.log("\nCategories: ecg, derm, radiology, labs, diagrams");
  }
}

main().catch(console.error);

// Export for programmatic use
export { uploadSingleImage, uploadBatch };
export type { BatchItem, UploadResult };
