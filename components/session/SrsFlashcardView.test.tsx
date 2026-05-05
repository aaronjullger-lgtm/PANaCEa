import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SrsFlashcardView } from './SrsFlashcardView';

const mockFetchNextVariantCard = vi.hoisted(() => vi.fn());
const mockSubmitVariantReview = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockGetToken = vi.hoisted(() => vi.fn().mockResolvedValue('token'));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

vi.mock('@/lib/services/srsReviewClient', () => ({
  fetchNextVariantCard: (...args: unknown[]) => mockFetchNextVariantCard(...args),
  submitVariantReview: (...args: unknown[]) => mockSubmitVariantReview(...args),
}));

vi.mock('@/lib/toast', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    info: vi.fn(),
  },
}));

const nextQuestion = {
  srsItemId: null,
  cardId: 'card-1',
  isVariant: false,
  taskType: 'review',
  progressContext: 'TARGETED',
  question: {
    id: 'question-1',
    question: 'Which medication is first-line?',
    options: ['Aspirin', 'Warfarin', 'Heparin', 'Digoxin'],
    correctAnswer: 'Aspirin',
    explanation: 'Aspirin is first-line in this scenario.',
  },
};

describe('SrsFlashcardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchNextVariantCard.mockResolvedValue(nextQuestion);
  });

  it('does not reveal the answer when the canonical review write fails', async () => {
    mockSubmitVariantReview.mockResolvedValue(null);

    render(<SrsFlashcardView onExit={vi.fn()} />);

    await screen.findByText('Which medication is first-line?');
    fireEvent.click(screen.getByRole('button', { name: /aspirin/i }));
    fireEvent.click(screen.getByTestId('srs-review-submit'));

    await screen.findByTestId('srs-review-submit-error');
    expect(screen.getByTestId('srs-review-submit-error').textContent).toContain(
      'Review was not saved'
    );
    expect(screen.queryByText('Explanation')).toBeNull();
    expect(screen.queryByTestId('srs-review-next')).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Review was not saved'));
  });

  it('reveals the explanation only after a saved review response', async () => {
    mockSubmitVariantReview.mockResolvedValue({ success: true });

    render(<SrsFlashcardView onExit={vi.fn()} />);

    await screen.findByText('Which medication is first-line?');
    fireEvent.click(screen.getByRole('button', { name: /aspirin/i }));
    fireEvent.click(screen.getByTestId('srs-review-submit'));

    await waitFor(() => {
      expect(screen.getByText('Explanation')).toBeTruthy();
    });
    expect(screen.getByTestId('srs-review-next')).toBeTruthy();
    expect(screen.queryByTestId('srs-review-submit-error')).toBeNull();
  });
});
