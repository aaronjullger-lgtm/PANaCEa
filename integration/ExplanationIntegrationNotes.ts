/**
 * ExplanationIntegrationNotes
 * 
 * Guidance for integrating the ExplanationPanel component to replace the 
 * current static explanation text in Question View with the new high-yield,
 * Glass/Slate styled rationale experience.
 * 
 * This file provides integration patterns and examples for developers.
 */

/**
 * INTEGRATION OVERVIEW
 * ====================
 * 
 * The ExplanationPanel component is designed to replace the current static 
 * rationale display in QuizView.tsx with a more interactive, high-yield 
 * learning experience.
 * 
 * Key Features:
 * - Compressed bullet points (3-6 max) highlighting key concepts
 * - Buzzwords & Clues section with pathognomonic terms
 * - Collapsible accordion for "Why others were wrong"
 * - "Teach Me This" button for deep-dive learning
 * - Helpful/Not Helpful feedback for analytics
 * - Glass/Slate visual styling with correct/incorrect highlighting
 * - Framer Motion animations for smooth fade-in
 */

/**
 * STEP 1: Import the Component
 * ============================
 * 
 * In QuizView.tsx or your question display component:
 * 
 * ```typescript
 * import ExplanationPanel from '../components/ExplanationPanel';
 * import type { DifferentialItem } from '../components/ExplanationPanel';
 * ```
 */

/**
 * STEP 2: Prepare Differential Data
 * ==================================
 * 
 * Convert incorrect answer options into DifferentialItem format:
 * 
 * ```typescript
 * const buildDifferentials = (
 *   question: Question, 
 *   selectedIndex: number
 * ): DifferentialItem[] => {
 *   return question.options
 *     .map((option, index) => ({
 *       option,
 *       index,
 *       isCorrect: index === question.correctAnswerIndex,
 *       isSelected: index === selectedIndex,
 *     }))
 *     .filter(item => !item.isCorrect)
 *     .map(item => ({
 *       option: item.option,
 *       reasoning: `This option is incorrect because it does not match the 
 *                   clinical presentation. The correct answer is ${
 *                     question.options[question.correctAnswerIndex]
 *                   } based on the key findings.`,
 *     }));
 * };
 * ```
 */

/**
 * STEP 3: Replace Static Rationale Display
 * =========================================
 * 
 * Replace the current rationale section in QuizView.tsx:
 * 
 * BEFORE (current implementation):
 * ```tsx
 * <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg feedback-content">
 *   <h3 className="font-bold text-lg mb-2">Rationale</h3>
 *   <div dangerouslySetInnerHTML={{ __html: currentQuestion.rationale }} />
 * </div>
 * ```
 * 
 * AFTER (with ExplanationPanel):
 * ```tsx
 * <ExplanationPanel
 *   explanation={currentQuestion.rationale}
 *   condition={currentQuestion.condition}
 *   isCorrect={selectedAnswerIndex === currentQuestion.correctAnswerIndex}
 *   differentials={buildDifferentials(currentQuestion, selectedAnswerIndex)}
 *   onTeach={() => {
 *     // Navigate to 5-Stage Drill or deep-dive learning
 *     console.log('Navigate to deep learning for:', currentQuestion.condition);
 *   }}
 *   onFeedback={(helpful) => {
 *     // Log analytics event
 *     console.log('Explanation feedback:', helpful ? 'helpful' : 'not helpful');
 *   }}
 *   questionId={currentQuestion.conditionId}
 * />
 * ```
 */

/**
 * STEP 4: Implement onTeach Callback
 * ==================================
 * 
 * The "Teach Me This" button should navigate to a deep-dive learning experience.
 * Suggested implementations:
 * 
 * Option A: Navigate to Condition Detail Modal
 * ```typescript
 * const handleTeach = useCallback(() => {
 *   setSelectedCondition(currentQuestion.condition);
 *   setShowConditionModal(true);
 * }, [currentQuestion]);
 * ```
 * 
 * Option B: Start a 5-Stage Drill Session
 * ```typescript
 * const handleTeach = useCallback(() => {
 *   startDrillSession({
 *     focus: 'condition',
 *     conditionId: currentQuestion.conditionId,
 *     mode: 'intensive',
 *   });
 * }, [currentQuestion, startDrillSession]);
 * ```
 */

/**
 * STEP 5: Implement onFeedback Callback for Analytics
 * ====================================================
 * 
 * The feedback buttons track user satisfaction with explanations:
 * 
 * ```typescript
 * import { storeUserReaction } from '../lib/services/explanationCompressionService';
 * 
 * const handleFeedback = useCallback((helpful: boolean) => {
 *   storeUserReaction(
 *     currentQuestion.conditionId,
 *     helpful ? 'helpful' : 'not_helpful'
 *   );
 *   
 *   // Optional: Send to analytics service
 *   analytics.track('explanation_feedback', {
 *     questionId: currentQuestion.conditionId,
 *     condition: currentQuestion.condition,
 *     wasCorrect: isCorrect,
 *     helpful,
 *   });
 * }, [currentQuestion, isCorrect]);
 * ```
 */

/**
 * STEP 6: Styling Customization
 * =============================
 * 
 * The ExplanationPanel uses Glass/Slate theming that adapts to light/dark mode.
 * Customize colors by updating CSS variables in index.css:
 * 
 * ```css
 * :root {
 *   --color-glass-bg: rgba(255, 255, 255, 0.7);
 *   --color-glass-border: rgba(148, 163, 184, 0.3);
 * }
 * 
 * .dark {
 *   --color-glass-bg: rgba(30, 41, 59, 0.8);
 *   --color-glass-border: rgba(255, 255, 255, 0.08);
 * }
 * ```
 */

/**
 * FULL INTEGRATION EXAMPLE
 * ========================
 * 
 * Here's a complete example showing how to integrate ExplanationPanel
 * into an existing question view component:
 */

export const INTEGRATION_EXAMPLE = `
// In QuizView.tsx or similar component

import React, { useState, useCallback } from 'react';
import ExplanationPanel from '../components/ExplanationPanel';
import type { DifferentialItem } from '../components/ExplanationPanel';
import { storeUserReaction } from '../lib/services/explanationCompressionService';

// Inside your component:

const [isAnswered, setIsAnswered] = useState(false);
const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);

// Build differentials for incorrect answers
const differentials: DifferentialItem[] = useMemo(() => {
  if (!currentQuestion || selectedAnswerIndex === null) return [];
  
  return currentQuestion.options
    .filter((_, index) => index !== currentQuestion.correctAnswerIndex)
    .map((option) => ({
      option,
      reasoning: \`This is not the best answer. Consider the key clinical features 
                  that point toward \${currentQuestion.condition}.\`,
    }));
}, [currentQuestion, selectedAnswerIndex]);

// Handle "Teach Me This" action
const handleTeach = useCallback(() => {
  // Navigate to detailed condition study
  console.log('Starting deep dive for:', currentQuestion.condition);
  // Your navigation logic here
}, [currentQuestion]);

// Handle feedback
const handleFeedback = useCallback((helpful: boolean) => {
  if (currentQuestion) {
    storeUserReaction(
      currentQuestion.conditionId, 
      helpful ? 'helpful' : 'not_helpful'
    );
  }
}, [currentQuestion]);

// In your JSX, replace the rationale section:
return (
  <div>
    {/* Question and answers... */}
    
    {isAnswered && currentQuestion && (
      <ExplanationPanel
        explanation={currentQuestion.rationale}
        condition={currentQuestion.condition}
        isCorrect={selectedAnswerIndex === currentQuestion.correctAnswerIndex}
        differentials={differentials}
        onTeach={handleTeach}
        onFeedback={handleFeedback}
        questionId={currentQuestion.conditionId}
      />
    )}
  </div>
);
`;

/**
 * MIGRATION CHECKLIST
 * ===================
 * 
 * Before deploying the ExplanationPanel integration:
 * 
 * [ ] Import ExplanationPanel component
 * [ ] Build differentials array from incorrect options
 * [ ] Implement onTeach callback (link to 5-Stage Drill or Condition Modal)
 * [ ] Implement onFeedback callback (connect to analytics)
 * [ ] Test with both correct and incorrect answers
 * [ ] Verify Glass/Slate styling in light and dark modes
 * [ ] Confirm Framer Motion animations are smooth
 * [ ] Test collapsible accordion behavior
 * [ ] Verify buzzword highlighting
 * [ ] Test mnemonic display (when available)
 */

export default {
  INTEGRATION_EXAMPLE,
};
