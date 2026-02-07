/**
 * SRS Flashcard View (Pillar 4: FSRS Generative Mnemonics)
 *
 * Uses GET /api/srs/next and POST /api/srs/submit. When user rates Hard (1),
 * backend returns triggerVisualRegeneration; we call requestMnemonicImage
 * and show the generated image with a flip animation.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Loader2, RotateCcw, ImagePlus } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import {
  fetchNextVariantCard,
  submitVariantReview,
  requestMnemonicImage,
  type VariantNextResponse,
} from '@/lib/services/srsService';

interface SrsFlashcardViewProps {
  onExit: () => void;
}

const RATING_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
};

type CardData = VariantNextResponse & { questionId: string; front: string; back: string };

function getCardPayload(data: VariantNextResponse | null | undefined): CardData | null {
  const q = data?.question as Record<string, unknown> | undefined;
  if (!data || !q) return null;
  const questionId = (q.id ?? q.baseQuestionId) as string;
  const front = (q.question ?? q.stem ?? '') as string;
  const back = (q.rationale ?? q.correctOption ?? '') as string;
  if (!questionId || !front.trim()) return null;
  const backText = back && String(back).trim();
  return {
    ...data,
    questionId,
    front: front.trim(),
    back: backText || front.trim(),
  };
}

export function SrsFlashcardView({ onExit }: Readonly<SrsFlashcardViewProps>) {
  const { getToken } = useAuth();
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mnemonicImage, setMnemonicImage] = useState<string | null>(null);
  const [mnemonicLoading, setMnemonicLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = React.useRef<number>(0);
  const srsAuth = useCallback(() => ({ getToken }), [getToken]);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCard(null);
    setFlipped(false);
    setMnemonicImage(null);
    try {
      const raw = await fetchNextVariantCard(srsAuth());
      const data = (raw && 'data' in raw ? (raw as { data: VariantNextResponse }).data : raw) as
        | VariantNextResponse
        | null
        | undefined;
      if (!data) {
        setError('Could not load next card.');
        setLoading(false);
        return;
      }
      const noQuestion = 'message' in data && data.message && !data.question;
      if (noQuestion) {
        const msg = data.message === 'No items due' ? 'No cards due right now.' : String(data.message);
        setError(msg);
        setLoading(false);
        return;
      }
      const payload = getCardPayload(data);
      if (!payload) {
        setError('Invalid card data.');
        setLoading(false);
        return;
      }
      setCard(payload);
      startTimeRef.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load card.');
    } finally {
      setLoading(false);
    }
  }, [srsAuth]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  const handleSubmit = useCallback(
    async (rating: number) => {
      if (!card || submitting) return;
      setSubmitting(true);
      const timeSpent = Math.round(Date.now() - startTimeRef.current);
      const isCorrect = rating >= 3;
      try {
        const result = await submitVariantReview(
          {
            srsItemId: card.srsItemId ?? undefined,
            topicProgressId: card.topicProgressId,
            questionId: card.questionId,
            rating,
            isCorrect,
            timeSpent,
            variantId: card.isVariant ? (card.question as { id?: string })?.id : undefined,
          },
          srsAuth()
        );
        setSubmitting(false);
        if (!result) return;
        if (result.triggerVisualRegeneration) {
          setMnemonicLoading(true);
          const visual = await requestMnemonicImage(card.front, card.back, {
            style: 'exaggerated',
            questionId: card.questionId,
            conditionId: (card.question as { conditionId?: string })?.conditionId,
            getToken,
          });
          setMnemonicLoading(false);
          if (visual?.data?.imageBase64) {
            setMnemonicImage(`data:${visual.data.imageMime};base64,${visual.data.imageBase64}`);
          }
          setFlipped(true);
        } else {
          void loadNext();
        }
      } catch {
        setSubmitting(false);
      }
    },
    [card, submitting, loadNext, srsAuth, getToken]
  );

  const handleContinueAfterMnemonic = useCallback(() => {
    setMnemonicImage(null);
    void loadNext();
  }, [loadNext]);

  if (loading && !card) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] p-6">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)] mb-4" />
        <p className="text-sm text-[var(--color-text-muted)]">Loading next card…</p>
      </div>
    );
  }

  if (error && !card) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] p-6 text-center">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">{error}</p>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={onExit}
          className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer inline-flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]" data-testid="srs-flashcards-heading">
          SRS Flashcards
        </h1>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <motion.div
          className="relative w-full aspect-[4/3] max-h-[320px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden cursor-pointer select-none min-h-[120px]"
          style={{ perspective: 1000 }}
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
          aria-label={flipped ? 'Show question (front of card)' : 'Show answer (back of card)'}
        >
          <AnimatePresence mode="wait">
            {flipped ? (
              <motion.div
                key="back"
                initial={{ opacity: 0, rotateY: 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: -90 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-auto"
              >
                {mnemonicLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-secondary)]/90 z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
                  </div>
                )}
                {mnemonicImage && (
                  <img
                    src={mnemonicImage}
                    alt="Mnemonic"
                    className="w-full h-auto max-h-48 object-contain rounded-lg mb-3"
                  />
                )}
                <p className="text-[var(--color-text-secondary)] text-center text-sm leading-relaxed">
                  {card.back}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="front"
                initial={{ opacity: 0, rotateY: -90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 90 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex items-center justify-center p-6"
              >
                <p className="text-[var(--color-text-primary)] text-center text-lg leading-relaxed">
                  {card.front}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-pointer inline-flex items-center justify-center"
            title="Flip card"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {([1, 2, 3, 4] as const).map((rating) => (
            <button
              key={rating}
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(rating)}
              className="min-h-[44px] min-w-[44px] px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm font-medium disabled:opacity-50 hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
            >
              {RATING_LABELS[rating]}
            </button>
          ))}
        </div>

        {mnemonicImage && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleContinueAfterMnemonic}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" />
              Next card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SrsFlashcardView;
