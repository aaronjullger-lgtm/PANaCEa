export interface PromptValidationResult {
  isValid: boolean;
  reason?: string;
}

const MEDICAL_KEYWORDS = [
  'diagnosis',
  'treatment',
  'symptom',
  'symptoms',
  'patient',
  'patients',
  'clinical',
  'history',
  'hx',
  'exam',
  'physical exam',
  'lab',
  'labs',
  'laboratory',
  'medication',
  'medications',
  'drug',
  'dose',
  'dosing',
  'differential',
  'differential diagnosis',
  'etiology',
  'pathophysiology',
  'management',
  'prognosis',
  'contraindication',
  'contraindications',
  'anatomy',
  'physiology',
  'guideline',
  'guidelines',
  'criteria',
  'workup',
  'follow-up',
  'follow up',
  'screening',
  'imaging',
  'radiology',
  'ct',
  'mri',
  'ultrasound',
  'vital signs',
  'review of systems',
  'ros',
  'plan',
  'assessment',
  'soap note',
  'pance',
  'panre',
  'board exam',
  'case vignette',
  'osce',
];

const JAILBREAK_PATTERNS: RegExp[] = [
  /ignore\s+all\s+previous\s+instructions/i,
  /ignore\s+previous\s+instructions/i,
  /forget\s+your\s+rules/i,
  /you\s+are\s+now\s+.+/i,
  /you\s+are\s+no\s+longer\s+bound/i,
  /dan\s+mode/i,
  /developer\s+mode/i,
  /system\s+prompt/i,
  /jailbreak/i,
  /(write|create|generate)\s+(a\s+)?(poem|story|song|lyrics)/i,
];

const MAX_PROMPT_LENGTH = 2000;

export function validateMedicalPrompt(prompt: string): PromptValidationResult {
  if (typeof prompt !== 'string') {
    return { isValid: false, reason: 'Prompt must be a string' };
  }

  let normalized = prompt.trim();

  if (!normalized) {
    return { isValid: false, reason: 'Prompt is empty' };
  }

  if (normalized.length > MAX_PROMPT_LENGTH) {
    normalized = normalized.slice(0, MAX_PROMPT_LENGTH);
  }

  const lower = normalized.toLowerCase();

  const hasMedicalContext = MEDICAL_KEYWORDS.some((keyword) =>
    lower.includes(keyword.toLowerCase())
  );

  if (!hasMedicalContext) {
    return {
      isValid: false,
      reason: 'Prompt must be related to medical education or clinical content',
    };
  }

  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isValid: false,
        reason: 'Prompt contains patterns associated with prompt injection or jailbreak attempts',
      };
    }
  }

  return { isValid: true };
}
