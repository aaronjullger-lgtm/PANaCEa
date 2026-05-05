export interface SRSScheduleResult {
  interval: number;
  repetition: number;
  easiness: number;
  dueDate: Date;
  difficulty: number;
  stabilityScore: number;
  qualityAdjusted: number;
  modifiersApplied: string[];
}
