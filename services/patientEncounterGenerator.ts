import type { PatientEncounterCase } from '@/types/drill-modes';

// Lazy load condition content to improve initial bundle size
let conditionContentCache: Record<string, unknown> | null = null;

async function getConditionContent(): Promise<Record<string, unknown>> {
  if (conditionContentCache) {
    return conditionContentCache;
  }
  
  try {
    const module = await import('../conditionContent.generated.json');
    conditionContentCache = module.default;
    return conditionContentCache;
  } catch (error) {
    console.error('Failed to load condition content:', error);
    return {};
  }
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

/**
 * Generate a random patient name
 */
function generatePatientName(sex: 'M' | 'F'): string {
  const firstNames = sex === 'M' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
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

/**
 * Get suitable conditions for patient encounters (exclude ECGs, pure diagnostics, etc.)
 */
async function getSuitableConditions(): Promise<string[]> {
  const conditionContent = await getConditionContent();
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
  const suitableConditions = await getSuitableConditions();
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
 * Get a fresh patient encounter (either from static data or generated)
 */
export async function getFreshPatientEncounter(useGenerated: boolean = false): Promise<PatientEncounterCase> {
  if (useGenerated) {
    return await generatePatientEncounterFromCondition();
  }
  
  // Import and use static cases as fallback
  // This will be implemented in the data file
  return await generatePatientEncounterFromCondition();
}
