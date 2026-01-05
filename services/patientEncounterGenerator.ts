import type { PatientEncounterCase, PatientPersona, PatientPersonality } from '@/types/drill-modes';
import { getApiEndpoint, API_ENDPOINTS } from '../lib/utils/apiConfig';
import { callGeminiText } from './geminiService';

// Lazy load condition content to improve initial bundle size
let conditionContentCache: Record<string, unknown> | null = null;

/**
 * Load condition content from the database API.
 * Database-First: No static file fallbacks.
 */
async function getConditionContent(): Promise<Record<string, unknown>> {
  if (conditionContentCache) {
    return conditionContentCache;
  }
  
  const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);
  const response = await fetch(apiUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to load condition content from database: ${response.status} ${response.statusText}`);
  }
  
  conditionContentCache = await response.json();
  return conditionContentCache;
}

interface ConditionData {
  overview?: string;
  clinicalPresentation?: string;
  symptoms?: string[];
  examFindings?: string[];
  diagnostics?: {
    notes?: string;
    labs?: string[];
    imaging?: string[];
  };
  riskFactors?: string[];
  treatment?: string[];
  complications?: string[];
  etiologyPathophysiology?: string;
}

const FIRST_NAMES_MALE = ['John', 'James', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles'];
const FIRST_NAMES_FEMALE = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Jackson'];

const PATIENT_PERSONALITIES: PatientPersonality[] = [
  'Anxious',
  'Stoic',
  'Confused',
  'Hostile',
  'Pleasant',
];

/**
 * Generate a random patient name
 */
function generatePatientName(sex: 'M' | 'F'): string {
  const firstNames = sex === 'M' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
}

function generatePersonaId(): string {
  return `persona-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate random vital signs based on condition severity
 */
function generateVitalSigns(conditionKey: string): PatientEncounterCase['vitalSigns'] {
  // Default normal vitals with some variation
  const vitals = {
    bp: '120/80',
    hr: 75 + Math.floor(Math.random() * 20) - 10, // 65-85
    rr: 16 + Math.floor(Math.random() * 4) - 2, // 14-18
    temp: 98.6,
    o2sat: 98 + Math.floor(Math.random() * 3) // 98-100
  };

  // Adjust for specific conditions
  if (conditionKey.includes('hypertension')) {
    vitals.bp = `${140 + Math.floor(Math.random() * 40)}/${90 + Math.floor(Math.random() * 20)}`;
  } else if (conditionKey.includes('hypotension')) {
    vitals.bp = `${90 + Math.floor(Math.random() * 10)}/${60 + Math.floor(Math.random() * 10)}`;
  }

  if (conditionKey.includes('fever') || conditionKey.includes('infection') || conditionKey.includes('pneumonia')) {
    vitals.temp = 100.4 + Math.random() * 3; // 100.4-103.4
  }

  if (conditionKey.includes('tachycardia') || conditionKey.includes('heart_failure')) {
    vitals.hr = 100 + Math.floor(Math.random() * 30); // 100-130
  } else if (conditionKey.includes('bradycardia')) {
    vitals.hr = 45 + Math.floor(Math.random() * 15); // 45-60
  }

  if (conditionKey.includes('respiratory') || conditionKey.includes('copd') || conditionKey.includes('asthma')) {
    vitals.rr = 20 + Math.floor(Math.random() * 10); // 20-30
    vitals.o2sat = 88 + Math.floor(Math.random() * 8); // 88-96
  }

  return vitals;
}

/**
 * Extract chief complaint from condition data
 */
function extractChiefComplaint(conditionKey: string, data: ConditionData): string {
  const conditionName = conditionKey.split('__').pop()?.replace(/_/g, ' ') || 'medical issue';
  
  // Try to extract from symptoms
  if (data.symptoms && data.symptoms.length > 0) {
    const primarySymptom = data.symptoms[0];
    // Clean up the symptom text
    const cleanSymptom = primarySymptom.replace(/^\*\*.*?\*\*:?\s*/g, '').replace(/\*\*/g, '').split('.')[0];
    if (cleanSymptom.length < 100) {
      return cleanSymptom;
    }
  }

  // Fallback to generic based on system
  if (conditionKey.includes('CV__')) return 'Chest pain';
  if (conditionKey.includes('GI__')) return 'Abdominal pain';
  if (conditionKey.includes('RESP__')) return 'Shortness of breath';
  if (conditionKey.includes('NEURO__')) return 'Headache';
  if (conditionKey.includes('MSK__')) return 'Joint pain';
  
  return 'Not feeling well';
}

/**
 * Parse and organize history data from condition content
 */
function extractHistoryData(data: ConditionData): Record<string, string> {
  const history: Record<string, string> = {};

  if (data.symptoms) {
    data.symptoms.forEach((symptom, idx) => {
      const cleanSymptom = symptom.replace(/^\*\*.*?\*\*:?\s*/g, '').replace(/\*\*/g, '');
      history[`symptom_${idx}`] = cleanSymptom;
    });
  }

  if (data.riskFactors) {
    const riskText = data.riskFactors.filter(rf => !rf.includes('**')).join('. ');
    if (riskText) {
      history['risk_factors'] = riskText;
    }
  }

  if (data.etiologyPathophysiology) {
    const etiology = data.etiologyPathophysiology.slice(0, 500);
    history['etiology'] = etiology;
  }

  return history;
}

/**
 * Parse and organize physical exam data
 */
function extractPhysicalExamData(data: ConditionData): Record<string, string> {
  const physicalExam: Record<string, string> = {};

  if (data.examFindings) {
    data.examFindings.forEach((finding, idx) => {
      const cleanFinding = finding.replace(/^\*\*.*?\*\*:?\s*/g, '').replace(/\*\*/g, '');
      physicalExam[`exam_${idx}`] = cleanFinding;
    });
  }

  return physicalExam;
}

/**
 * Parse and organize lab/diagnostic data
 */
function extractLabData(data: ConditionData): Record<string, string> {
  const labData: Record<string, string> = {};

  if (data.diagnostics?.notes) {
    labData['diagnostic_notes'] = data.diagnostics.notes.replace(/\*\*/g, '');
  }

  if (data.diagnostics?.labs) {
    data.diagnostics.labs.forEach((lab, idx) => {
      const cleanLab = lab.replace(/^\*\*.*?\*\*:?\s*/g, '').replace(/\*\*/g, '');
      labData[`lab_${idx}`] = cleanLab;
    });
  }

  if (data.diagnostics?.imaging) {
    data.diagnostics.imaging.forEach((imaging, idx) => {
      const cleanImaging = imaging.replace(/^\*\*.*?\*\*:?\s*/g, '').replace(/\*\*/g, '');
      labData[`imaging_${idx}`] = cleanImaging;
    });
  }

  return labData;
}

/**
 * Extract essential questions from condition data
 */
function extractEssentialQuestions(conditionKey: string, data: ConditionData): string[] {
  const questions: string[] = [];

  // Always ask about onset, duration, character
  questions.push('onset', 'duration', 'character', 'severity');

  // System-specific questions
  if (conditionKey.includes('CV__')) {
    questions.push('chest pain', 'radiation', 'exertion', 'cardiac history');
  } else if (conditionKey.includes('GI__')) {
    questions.push('abdominal pain', 'nausea', 'vomiting', 'bowel movements');
  } else if (conditionKey.includes('RESP__')) {
    questions.push('shortness of breath', 'cough', 'sputum', 'wheezing');
  } else if (conditionKey.includes('NEURO__')) {
    questions.push('headache', 'weakness', 'numbness', 'vision changes');
  }

  // Risk factors
  questions.push('medical history', 'medications', 'allergies');

  return questions;
}

/**
 * Extract helpful questions
 */
function extractHelpfulQuestions(conditionKey: string, data: ConditionData): string[] {
  const questions: string[] = [];

  questions.push('associated symptoms', 'aggravating factors', 'alleviating factors');
  questions.push('family history', 'social history', 'recent travel');

  return questions;
}

/**
 * Define unnecessary questions (generic wasteful questions)
 */
function getUnnecessaryQuestions(): string[] {
  return [
    'appetite', 'sleep', 'mood', 'stress',
    'exercise routine', 'diet details', 'hobbies',
    'pets', 'occupation details', 'relationship status'
  ];
}

/**
 * Extract ideal workup from treatment/diagnostic data
 */
function extractIdealWorkup(data: ConditionData): string[] {
  const workup: string[] = [];

  if (data.diagnostics?.labs) {
    workup.push(...data.diagnostics.labs.slice(0, 3).map(lab => lab.replace(/\*\*/g, '').split(':')[0]));
  }

  if (data.diagnostics?.imaging) {
    workup.push(...data.diagnostics.imaging.slice(0, 2).map(img => img.replace(/\*\*/g, '').split(':')[0]));
  }

  if (data.treatment) {
    workup.push(...data.treatment.slice(0, 2).map(tx => tx.replace(/\*\*/g, '').split('.')[0]));
  }

  return workup.length > 0 ? workup : ['Complete history and physical', 'Basic labs', 'Imaging as indicated'];
}

/**
 * Extract teaching points
 */
function extractTeachingPoints(conditionKey: string, data: ConditionData): string[] {
  const points: string[] = [];

  if (data.overview) {
    const overview = data.overview.slice(0, 300).replace(/\*\*/g, '');
    points.push(overview);
  }

  if (data.complications) {
    const complication = data.complications[0]?.replace(/\*\*/g, '');
    if (complication) {
      points.push(`Complication: ${complication}`);
    }
  }

  return points.length > 0 ? points : ['Key clinical presentation features are important for diagnosis'];
}

// ============================================================================
// Gemini-backed Dynamic Patient Persona Generator
// ============================================================================

function sanitizePersonality(value: string | undefined): PatientPersonality {
  if (!value) return 'Pleasant';
  const normalized = value.trim().toLowerCase();
  const match = PATIENT_PERSONALITIES.find(
    (p) => p.toLowerCase() === normalized
  );
  return match ?? 'Pleasant';
}

function ensureVitalsShape(raw: any): PatientPersona['vitals'] {
  const fallback: PatientPersona['vitals'] = {
    hr: 80,
    bp: '120/80',
    temp: 98.6,
    rr: 16,
    o2: 98,
  };

  if (!raw || typeof raw !== 'object') return fallback;

  const hr = Number(raw.hr ?? raw.heartRate ?? 80) || 80;
  const bp = typeof raw.bp === 'string' ? raw.bp : '120/80';
  const temp = Number(raw.temp ?? raw.temperature ?? 98.6) || 98.6;
  const rr = Number(raw.rr ?? raw.respiratoryRate ?? 16) || 16;
  const o2 = Number(raw.o2 ?? raw.o2sat ?? raw.oxygen ?? 98) || 98;

  return { hr, bp, temp, rr, o2 };
}

function normalizePersona(raw: any): PatientPersona {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Gemini returned an invalid persona payload');
  }

  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : generatePersonaId();

  const demographics = raw.demographics && typeof raw.demographics === 'object'
    ? {
        name:
          typeof raw.demographics.name === 'string' && raw.demographics.name.trim()
            ? raw.demographics.name.trim()
            : 'Alex Smith',
        age: Number(raw.demographics.age) || 40,
        gender:
          typeof raw.demographics.gender === 'string' && raw.demographics.gender.trim()
            ? raw.demographics.gender.trim()
            : 'Unknown',
      }
    : { name: 'Alex Smith', age: 40, gender: 'Unknown' };

  const chiefComplaint =
    typeof raw.chiefComplaint === 'string' && raw.chiefComplaint.trim()
      ? raw.chiefComplaint.trim()
      : 'Not feeling well';

  const history =
    typeof raw.history === 'string' && raw.history.trim()
      ? raw.history.trim()
      : 'Patient presents with a non-specific complaint. Please gather a focused history.';

  const vitals = ensureVitalsShape(raw.vitals);

  const personality = sanitizePersonality(raw.personality);

  const secretDiagnosis =
    typeof raw.secretDiagnosis === 'string' && raw.secretDiagnosis.trim()
      ? raw.secretDiagnosis.trim()
      : 'Undifferentiated condition';

  const criticalCues: string[] = Array.isArray(raw.criticalCues)
    ? raw.criticalCues
        .filter((c: any) => typeof c === 'string')
        .map((c: string) => c.trim())
        .filter(Boolean)
    : [];

  return {
    id,
    demographics,
    chiefComplaint,
    history,
    vitals,
    personality,
    secretDiagnosis,
    criticalCues,
  };
}

/**
 * Generate a dynamic PatientPersona using Gemini via the geminiProxy.
 * This is used by the Simulation Engine to drive the "Patient Bot".
 */
export async function generatePatientCase(
  system?: string,
  difficulty?: string
): Promise<PatientPersona> {
  const systemLabel = system?.trim() || 'any relevant';
  const difficultyLabel = difficulty?.trim() || 'standard';

  const prompt = `You are a senior clinical educator designed to create realistic OSCE cases for Physician Assistant students.

Task: Generate a unique patient case for the ${systemLabel} system at ${difficultyLabel} difficulty level.

Clinical Requirements:
- The case must be medically accurate and appropriate for PA training.
- Ensure vital signs are internally consistent with the underlying pathology.
- Include at least 3-6 critical cues in the history that are essential for diagnosis.
- The chief complaint should be a short phrase (e.g., "Sudden onset chest pain").

Personality Requirements:
- Assign a single predominant personality trait that affects how the patient answers questions.
- Use exactly one of these values for personality: "Anxious", "Stoic", "Confused", "Hostile", "Pleasant".
- Make sure the tone of the history could plausibly reflect this personality.

Output Format (STRICT):
- Return ONLY a single JSON object.
- Do NOT include any markdown, backticks, comments, or explanations.
- The JSON must match this TypeScript interface exactly:

interface PatientPersona {
  id: string;
  demographics: { name: string; age: number; gender: string };
  chiefComplaint: string;
  history: string;
  vitals: { hr: number; bp: string; temp: number; rr: number; o2: number };
  personality: "Anxious" | "Stoic" | "Confused" | "Hostile" | "Pleasant";
  secretDiagnosis: string;
  criticalCues: string[];
}

Important:
- secretDiagnosis is for internal grading only and must NEVER be revealed verbatim to the student.
- Include rich clinical detail in history while keeping it under 250 words.
- Use realistic vital sign ranges and units (e.g., bp as "130/85").
`;

  try {
    const rawText = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.7);
    const cleaned = rawText
      .replace(/```json|```/gi, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    return normalizePersona(parsed);
  } catch (error) {
    console.error('Error generating patient persona:', error);
    throw new Error('Failed to generate patient case. Please try again.');
  }
}

/**
 * Get suitable conditions for patient encounters (exclude ECGs, pure diagnostics, etc.)
 * Takes condition content as parameter to avoid redundant loading
 */
function getSuitableConditionsFromContent(conditionContent: Record<string, unknown>): string[] {
  const allKeys = Object.keys(conditionContent);
  
  return allKeys.filter(key => {
    // Exclude ECG patterns
    if (key.includes('__ecg__')) return false;
    
    // Exclude imaging-only conditions
    if (key.includes('__imaging__')) return false;
    
    // Prefer conditions with good clinical presentation
    return true;
  });
}

/**
 * Generate a patient encounter case from condition content
 */
export async function generatePatientEncounterFromCondition(): Promise<PatientEncounterCase> {
  const conditionContent = await getConditionContent();
  const suitableConditions = await getSuitableConditionsFromContent(conditionContent);
  const conditionKey = suitableConditions[Math.floor(Math.random() * suitableConditions.length)];
  const data = (conditionContent as Record<string, ConditionData>)[conditionKey];

  const sex: 'M' | 'F' = Math.random() > 0.5 ? 'M' : 'F';
  const age = 25 + Math.floor(Math.random() * 50); // 25-75

  const conditionName = conditionKey.split('__').pop()?.replace(/_/g, ' ') || 'unknown condition';

  const encounterCase: PatientEncounterCase = {
    id: `gen-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    patientName: generatePatientName(sex),
    chiefComplaint: extractChiefComplaint(conditionKey, data),
    age,
    sex,
    vitalSigns: generateVitalSigns(conditionKey),
    historyData: extractHistoryData(data),
    physicalExamData: extractPhysicalExamData(data),
    labData: extractLabData(data),
    essentialQuestions: extractEssentialQuestions(conditionKey, data),
    helpfulQuestions: extractHelpfulQuestions(conditionKey, data),
    unnecessaryQuestions: getUnnecessaryQuestions(),
    correctDiagnosis: conditionName.charAt(0).toUpperCase() + conditionName.slice(1),
    differentialDiagnoses: [],
    idealWorkup: extractIdealWorkup(data),
    teachingPoints: extractTeachingPoints(conditionKey, data),
  };

  return encounterCase;
}

/**
 * Get a fresh patient encounter from the database.
 * Database-First: Always generates from database content.
 * 
 * @param useGenerated - Whether to force fresh AI generation (default: false)
 */
export async function getFreshPatientEncounter(useGenerated: boolean = false): Promise<PatientEncounterCase> {
  // Always generate from database content
  return await generatePatientEncounterFromCondition();
}
