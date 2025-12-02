import type { PatientEncounterCase, PatientQuestion, QuestionRelevance } from '@/types/drill-modes';

/**
 * Mock patient encounter cases for Virtual OSCE simulation
 */
export const PATIENT_ENCOUNTER_CASES: PatientEncounterCase[] = [
  {
    id: 'enc-001',
    patientName: 'John Smith',
    chiefComplaint: 'Chest pain',
    age: 55,
    sex: 'M',
    vitalSigns: {
      bp: '140/90',
      hr: 92,
      rr: 18,
      temp: 98.6,
      o2sat: 97
    },
    historyData: {
      'onset': 'Started 2 hours ago while mowing the lawn',
      'character': 'Pressure-like, substernal',
      'duration': 'Constant since onset',
      'radiation': 'Radiates to left arm and jaw',
      'severity': '8/10',
      'alleviating': 'Rest helped slightly',
      'aggravating': 'Exertion makes it worse',
      'associated_symptoms': 'Diaphoresis, nausea, shortness of breath',
      'cardiac_history': 'Hypertension for 10 years, hyperlipidemia',
      'medications': 'Lisinopril, Atorvastatin',
      'smoking': 'Former smoker, quit 5 years ago, 30 pack-year history',
      'family_history': 'Father had MI at age 58'
    },
    physicalExamData: {
      'general': 'Appears anxious, diaphoretic',
      'cardiovascular': 'Regular rhythm, no murmurs, rubs, or gallops',
      'pulmonary': 'Clear to auscultation bilaterally',
      'extremities': 'No edema, pulses intact'
    },
    labData: {
      'troponin': 'Elevated (2.5 ng/mL, normal <0.04)',
      'ecg': 'ST elevation in leads II, III, aVF',
      'cbc': 'WBC 12,000, otherwise normal',
      'bmp': 'Within normal limits',
      'chest_xray': 'No acute findings'
    },
    essentialQuestions: [
      'chest pain', 'onset', 'character', 'radiation', 'severity',
      'cardiac history', 'risk factors', 'medications', 'smoking'
    ],
    helpfulQuestions: [
      'associated symptoms', 'alleviating', 'aggravating', 'family history',
      'previous MI', 'diabetes', 'duration'
    ],
    unnecessaryQuestions: [
      'bowel habits', 'urination', 'appetite', 'sleep', 'depression',
      'sexual history', 'travel history', 'pets'
    ],
    correctDiagnosis: 'Inferior wall STEMI',
    differentialDiagnoses: [
      'Unstable angina',
      'Pulmonary embolism',
      'Aortic dissection',
      'Pneumonia'
    ],
    idealWorkup: [
      'ECG immediately',
      'Troponin',
      'Chest X-ray',
      'Aspirin administration',
      'Cardiology consult for cardiac catheterization'
    ],
    teachingPoints: [
      'ST elevation in inferior leads (II, III, aVF) indicates inferior wall MI',
      'Elevated troponin confirms myocardial injury',
      'Time is muscle - door-to-balloon time should be <90 minutes',
      'Risk factors include HTN, hyperlipidemia, smoking history, family history'
    ]
  },
  {
    id: 'enc-002',
    patientName: 'Sarah Johnson',
    chiefComplaint: 'Abdominal pain',
    age: 32,
    sex: 'F',
    vitalSigns: {
      bp: '110/70',
      hr: 88,
      rr: 16,
      temp: 100.8,
      o2sat: 99
    },
    historyData: {
      'onset': 'Started yesterday evening',
      'location': 'Right lower quadrant',
      'character': 'Sharp, constant',
      'severity': '7/10',
      'migration': 'Started periumbilical, then moved to RLQ',
      'associated_symptoms': 'Nausea, vomiting (once), anorexia',
      'aggravating': 'Movement, coughing',
      'last_menstrual_period': '2 weeks ago, regular',
      'pregnancy': 'Not possible, not sexually active',
      'previous_surgeries': 'None',
      'urinary_symptoms': 'No dysuria or frequency'
    },
    physicalExamData: {
      'general': 'Appears uncomfortable, lying still',
      'abdomen': 'Tenderness in RLQ, positive McBurney\'s point, positive Rovsing\'s sign, rebound tenderness, guarding',
      'psoas_sign': 'Positive',
      'obturator_sign': 'Negative',
      'bowel_sounds': 'Hypoactive'
    },
    labData: {
      'wbc': 'Elevated (14,500)',
      'neutrophils': '85% with left shift',
      'pregnancy_test': 'Negative',
      'urinalysis': 'Normal',
      'ct_abdomen': 'Enlarged appendix with periappendiceal fat stranding'
    },
    essentialQuestions: [
      'location', 'onset', 'character', 'severity', 'migration',
      'nausea', 'vomiting', 'fever', 'last menstrual period'
    ],
    helpfulQuestions: [
      'aggravating', 'anorexia', 'previous surgeries', 'urinary symptoms',
      'diarrhea', 'pregnancy possibility'
    ],
    unnecessaryQuestions: [
      'sexual history details', 'family medical history', 'occupation',
      'exercise habits', 'diet', 'alcohol use', 'drug use'
    ],
    correctDiagnosis: 'Acute appendicitis',
    differentialDiagnoses: [
      'Ectopic pregnancy',
      'Ovarian torsion',
      'Pelvic inflammatory disease',
      'Gastroenteritis',
      'Kidney stone'
    ],
    idealWorkup: [
      'CBC with differential',
      'Pregnancy test',
      'Urinalysis',
      'CT abdomen/pelvis with IV contrast',
      'Surgical consultation'
    ],
    teachingPoints: [
      'Classic presentation: periumbilical pain migrating to RLQ (McBurney\'s point)',
      'Associated with anorexia, nausea, vomiting, low-grade fever',
      'Physical exam: RLQ tenderness, positive Rovsing\'s, psoas, and obturator signs',
      'Must rule out ectopic pregnancy in women of childbearing age',
      'CT scan is gold standard for diagnosis in adults'
    ]
  }
];

/**
 * Get a random patient encounter case
 * Can return static cases or dynamically generated ones
 */
export function getRandomEncounterCase(preferGenerated: boolean = false): PatientEncounterCase {
  // If we want to prefer generated content or randomly mix them
  if (preferGenerated && Math.random() > 0.3) {
    // Use dynamic generation 70% of the time when preferGenerated is true
    try {
      const { generatePatientEncounterFromCondition } = require('@/services/patientEncounterGenerator');
      return generatePatientEncounterFromCondition();
    } catch (error) {
      console.warn('Failed to generate dynamic patient case from condition content. Falling back to static cases. Error:', error);
      console.info('If this persists, check that conditionContent.generated.json is accessible and properly formatted.');
      // Fallback to static
    }
  }
  
  return PATIENT_ENCOUNTER_CASES[Math.floor(Math.random() * PATIENT_ENCOUNTER_CASES.length)];
}

/**
 * Evaluate user's question for relevance
 */
export function evaluateQuestion(
  question: string,
  patientCase: PatientEncounterCase
): { relevance: QuestionRelevance; response: string } {
  const lowerQuestion = question.toLowerCase();
  
  // Check if question matches essential keywords
  for (const essential of patientCase.essentialQuestions) {
    if (lowerQuestion.includes(essential.toLowerCase())) {
      const response = getResponseForKeyword(essential, patientCase);
      return { relevance: 'essential', response };
    }
  }
  
  // Check if question matches helpful keywords
  for (const helpful of patientCase.helpfulQuestions) {
    if (lowerQuestion.includes(helpful.toLowerCase())) {
      const response = getResponseForKeyword(helpful, patientCase);
      return { relevance: 'helpful', response };
    }
  }
  
  // Check if question matches unnecessary keywords
  for (const unnecessary of patientCase.unnecessaryQuestions) {
    if (lowerQuestion.includes(unnecessary.toLowerCase())) {
      return { 
        relevance: 'unnecessary', 
        response: `This information is not particularly relevant to the current presentation.` 
      };
    }
  }
  
  // Default response for unrecognized questions
  return { 
    relevance: 'helpful', 
    response: 'I\'m not sure about that. Could you ask me something else?' 
  };
}

/**
 * Helper function to get response based on keyword and patient data
 */
function getResponseForKeyword(keyword: string, patientCase: PatientEncounterCase): string {
  // Check history data
  if (patientCase.historyData[keyword]) {
    return patientCase.historyData[keyword];
  }
  
  // Check physical exam data
  if (patientCase.physicalExamData[keyword]) {
    return patientCase.physicalExamData[keyword];
  }
  
  // Check lab data
  if (patientCase.labData[keyword]) {
    return patientCase.labData[keyword];
  }
  
  // Generic response if no specific data found
  return `The patient reports: "${keyword}" - information available in the chart.`;
}

/**
 * Calculate score for encounter session
 */
export function calculateEncounterScore(
  questions: PatientQuestion[],
  patientCase: PatientEncounterCase
): { efficiency: number; thoroughness: number; overall: number } {
  // Calculate thoroughness: percentage of essential questions asked
  const essentialAsked = questions.filter(q => q.relevance === 'essential').length;
  const thoroughness = Math.min(100, (essentialAsked / patientCase.essentialQuestions.length) * 100);
  
  // Calculate efficiency: penalize for unnecessary questions
  const unnecessaryAsked = questions.filter(q => q.relevance === 'unnecessary').length;
  const totalQuestions = questions.length || 1;
  const efficiency = Math.max(0, 100 - (unnecessaryAsked / totalQuestions) * 50);
  
  // Overall score is weighted average
  const overall = (thoroughness * 0.6) + (efficiency * 0.4);
  
  return { efficiency, thoroughness, overall };
}
