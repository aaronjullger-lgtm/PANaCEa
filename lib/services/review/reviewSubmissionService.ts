import { offlineSyncService } from '../offline/offlineSyncService';

export interface ReviewSubmission {
  questionId: string;
  wasCorrect: boolean;
  timeSpentMs?: number;
  quality?: number;
  srsItemId?: string;
  conditionId?: string;
}

export class ReviewSubmissionService {
  public async submitReview(submission: ReviewSubmission): Promise<void> {
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submission),
    };

    if (navigator.onLine) {
      try {
        const response = await fetch('/api/questions/review', options);
        if (!response.ok) {
          throw new Error('Failed to submit review');
        }
      } catch (error) {
        console.error('Failed to submit review, queueing request:', error);
        this.queueFailedRequest('/api/questions/review', options);
      }
    } else {
      this.queueFailedRequest('/api/questions/review', options);
    }
  }

  private queueFailedRequest(url: string, options: RequestInit): void {
    offlineSyncService.queueRequest(url, options);
  }
}

export const reviewSubmissionService = new ReviewSubmissionService();
