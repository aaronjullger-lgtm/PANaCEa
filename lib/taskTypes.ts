/**
 * Task Types for Sub-Topic SRS Tracking
 * 
 * Each condition can have separate FSRS tracks for different task types,
 * allowing users to master different aspects of a condition independently.
 */

export const TASK_TYPES = {
  DIAGNOSIS: 'diagnosis',
  TREATMENT: 'treatment',
  MECHANISM: 'mechanism',
  WORKUP: 'workup',
  PREVENTION: 'prevention',
  PROGNOSIS: 'prognosis',
  COMPLICATION: 'complication',
  CLINICAL_PEARL: 'clinical_pearl',
} as const;

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];

/**
 * Get human-readable label for task type
 */
export function getTaskTypeLabel(taskType: TaskType): string {
  const labels: Record<TaskType, string> = {
    diagnosis: 'Diagnosis',
    treatment: 'Treatment',
    mechanism: 'Mechanism/Pathophysiology',
    workup: 'Diagnostic Workup',
    prevention: 'Prevention/Screening',
    prognosis: 'Prognosis/Outcomes',
    complication: 'Complications',
    clinical_pearl: 'Clinical Pearls',
  };

  return labels[taskType] || taskType;
}

/**
 * Get description for task type
 */
export function getTaskTypeDescription(taskType: TaskType): string {
  const descriptions: Record<TaskType, string> = {
    diagnosis: 'What is the most likely diagnosis?',
    treatment: 'What is the appropriate treatment/management?',
    mechanism: 'What is the underlying pathophysiology?',
    workup: 'What is the next best diagnostic step?',
    prevention: 'What preventive measures or screening is recommended?',
    prognosis: 'What is the expected outcome/prognosis?',
    complication: 'What complications should be monitored?',
    clinical_pearl: 'Key clinical pearls and high-yield facts.',
  };

  return descriptions[taskType] || '';
}

/**
 * All task types as array
 */
export const ALL_TASK_TYPES: TaskType[] = Object.values(TASK_TYPES);

/**
 * Infer task type from question text
 */
export function inferTaskType(questionText: string): TaskType {
  const lowerQuestion = questionText.toLowerCase();

  if (
    lowerQuestion.includes('most likely diagnosis') ||
    lowerQuestion.includes('presenting with') ||
    lowerQuestion.includes('what is the diagnosis')
  ) {
    return TASK_TYPES.DIAGNOSIS;
  }

  if (
    lowerQuestion.includes('treatment') ||
    lowerQuestion.includes('management') ||
    lowerQuestion.includes('first-line') ||
    lowerQuestion.includes('therapy')
  ) {
    return TASK_TYPES.TREATMENT;
  }

  if (
    lowerQuestion.includes('mechanism') ||
    lowerQuestion.includes('pathophysiology') ||
    lowerQuestion.includes('cause')
  ) {
    return TASK_TYPES.MECHANISM;
  }

  if (
    lowerQuestion.includes('next step') ||
    lowerQuestion.includes('diagnostic test') ||
    lowerQuestion.includes('workup') ||
    lowerQuestion.includes('confirm the diagnosis')
  ) {
    return TASK_TYPES.WORKUP;
  }

  if (
    lowerQuestion.includes('prevent') ||
    lowerQuestion.includes('screening') ||
    lowerQuestion.includes('prophylaxis')
  ) {
    return TASK_TYPES.PREVENTION;
  }

  if (
    lowerQuestion.includes('prognosis') ||
    lowerQuestion.includes('outcome') ||
    lowerQuestion.includes('expected course')
  ) {
    return TASK_TYPES.PROGNOSIS;
  }

  if (
    lowerQuestion.includes('complication') ||
    lowerQuestion.includes('adverse effect') ||
    lowerQuestion.includes('monitor for')
  ) {
    return TASK_TYPES.COMPLICATION;
  }

  if (
    lowerQuestion.includes('clinical pearl') ||
    lowerQuestion.includes('key takeaway') ||
    lowerQuestion.includes('high-yield')
  ) {
    return TASK_TYPES.CLINICAL_PEARL;
  }

  // Default to diagnosis if unclear
  return TASK_TYPES.DIAGNOSIS;
}
