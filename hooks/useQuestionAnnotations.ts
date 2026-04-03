/**
 * useQuestionAnnotations — Manages per-question highlight and strikethrough state.
 *
 * Stores annotations in refs to avoid re-renders, exposes callbacks for
 * adding/removing highlights and toggling strikethroughs on answer options.
 * State persists across question navigation within a session.
 *
 * @see components/session/HighlightToolbar.tsx
 * @see components/session/QuizView.tsx
 */

import { useRef, useCallback, useState } from 'react';

export interface HighlightData {
  id: string;
  /** Serialized range info for re-application */
  startOffset: number;
  endOffset: number;
  text: string;
  color: HighlightColor;
}

export type HighlightColor = 'yellow' | 'green' | 'blue';

export type AnnotationMode = 'none' | 'highlight' | 'strikethrough';

export interface QuestionAnnotationState {
  highlights: HighlightData[];
  strikethroughs: Set<number>; // option indices
}

export function useQuestionAnnotations() {
  const annotationsRef = useRef<Map<string, QuestionAnnotationState>>(new Map());
  const [activeMode, setActiveMode] = useState<AnnotationMode>('none');
  const [activeColor, setActiveColor] = useState<HighlightColor>('yellow');
  // Increment to force re-render when annotations change
  const [revision, setRevision] = useState(0);

  const getState = useCallback((questionId: string): QuestionAnnotationState => {
    if (!annotationsRef.current.has(questionId)) {
      annotationsRef.current.set(questionId, {
        highlights: [],
        strikethroughs: new Set(),
      });
    }
    return annotationsRef.current.get(questionId)!;
  }, []);

  const addHighlight = useCallback(
    (questionId: string, text: string, startOffset: number, endOffset: number) => {
      const state = getState(questionId);
      state.highlights.push({
        id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startOffset,
        endOffset,
        text,
        color: activeColor,
      });
      setRevision((r) => r + 1);
    },
    [getState, activeColor]
  );

  const removeHighlight = useCallback(
    (questionId: string, highlightId: string) => {
      const state = getState(questionId);
      state.highlights = state.highlights.filter((h) => h.id !== highlightId);
      setRevision((r) => r + 1);
    },
    [getState]
  );

  const toggleStrikethrough = useCallback(
    (questionId: string, optionIndex: number) => {
      const state = getState(questionId);
      if (state.strikethroughs.has(optionIndex)) {
        state.strikethroughs.delete(optionIndex);
      } else {
        state.strikethroughs.add(optionIndex);
      }
      setRevision((r) => r + 1);
    },
    [getState]
  );

  const isStrikethrough = useCallback(
    (questionId: string, optionIndex: number): boolean => {
      const state = getState(questionId);
      return state.strikethroughs.has(optionIndex);
    },
    [getState]
  );

  const getHighlights = useCallback(
    (questionId: string): HighlightData[] => {
      return getState(questionId).highlights;
    },
    [getState]
  );

  const clearAnnotations = useCallback(
    (questionId: string) => {
      annotationsRef.current.set(questionId, {
        highlights: [],
        strikethroughs: new Set(),
      });
      setRevision((r) => r + 1);
    },
    []
  );

  const clearAll = useCallback(() => {
    annotationsRef.current.clear();
    setRevision((r) => r + 1);
  }, []);

  const toggleMode = useCallback(
    (mode: AnnotationMode) => {
      setActiveMode((prev) => (prev === mode ? 'none' : mode));
    },
    []
  );

  return {
    activeMode,
    activeColor,
    revision, // include in deps to trigger re-renders
    setActiveMode,
    setActiveColor,
    toggleMode,
    addHighlight,
    removeHighlight,
    toggleStrikethrough,
    isStrikethrough,
    getHighlights,
    clearAnnotations,
    clearAll,
  };
}
