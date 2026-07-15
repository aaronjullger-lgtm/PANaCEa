export type ContentFlagDecision = 'approve' | 'reject' | 'requeue';

export interface ContentFlagReviewInput {
  flagId: string;
  questionId: string;
  flagType: string;
  reviewerId?: string;
  reviewTimeout?: string;
}

export interface ContentFlagReviewDecision {
  decision: ContentFlagDecision;
  reviewerId: string;
  notes?: string;
}

export interface ContentFlagReviewResult {
  flagId: string;
  decision: ContentFlagDecision;
  reviewerId: string;
  applied: boolean;
  timedOut: boolean;
  reportPaths: { jsonPath: string; markdownPath: string };
  summary: {
    total: number;
    completed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}
