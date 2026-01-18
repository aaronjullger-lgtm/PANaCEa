export const TASK_TYPES = {
  DIAGNOSIS: 'diagnosis',
  TREATMENT: 'treatment',
  MECHANISM: 'mechanism',
  WORKUP: 'workup',
  PREVENTION: 'prevention',
  CLINICAL_PEARL: 'clinical_pearl',
} as const;

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];

export const VALID_TASK_TYPES = Object.values(TASK_TYPES);

export function getTaskTypeFromContent(content: string, title?: string): TaskType {
  const lowerContent = (content + ' ' + (title || '')).toLowerCase();

  if (
    lowerContent.includes('treatment') ||
    lowerContent.includes('management') ||
    lowerContent.includes('therapy')
  ) {
    return TASK_TYPES.TREATMENT;
  }
  if (
    lowerContent.includes('diagnos') ||
    lowerContent.includes('presentation') ||
    lowerContent.includes('symptom')
  ) {
    return TASK_TYPES.DIAGNOSIS;
  }
  if (lowerContent.includes('mechanism') || lowerContent.includes('pathophys')) {
    return TASK_TYPES.MECHANISM;
  }
  if (
    lowerContent.includes('workup') ||
    lowerContent.includes('test') ||
    lowerContent.includes('lab')
  ) {
    return TASK_TYPES.WORKUP;
  }
  if (lowerContent.includes('prevent') || lowerContent.includes('prophyla')) {
    return TASK_TYPES.PREVENTION;
  }

  return TASK_TYPES.DIAGNOSIS; // Default
}
