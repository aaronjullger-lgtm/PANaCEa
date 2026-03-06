/**
 * Higher-Order Component (HOC) for Gemini Error Boundary
 *
 * Wraps AI-dependent components with error handling for Gemini API failures.
 * Use this for any component that makes Gemini API calls.
 *
 * @example
 * // In App.tsx
 * const ProtectedDDxTrainer = withGeminiErrorBoundary(DdxTrainer, 'ddx_compare');
 *
 * // Or inline:
 * {view === "ddx_compare" && (
 *   <WithGeminiErrorBoundary viewName="ddx_compare" onRetry={handleRetry}>
 *     <DdxTrainer {...props} />
 *   </WithGeminiErrorBoundary>
 * )}
 */

import React, { ComponentType, ReactNode } from 'react';
import { GeminiErrorBoundary } from '@/components/error/GeminiErrorBoundary';

/**
 * List of AI-dependent views that should have error boundaries
 */
export const AI_DEPENDENT_VIEWS = [
  'quiz',
  'patient_encounter',
  'cram_mode',
  'ddx_compare',
  'grand_rounds',
  'physiology_drill',
  'guideline_drill',
  'system_drill',
  'condition_drill',
  'panre_la',
  'ecg_drill',
  'derm_drill',
  'imaging_drill',
  'antibiotic_mode',
  'fluid_electrolyte',
  'code_blue_speed',
  'rapid_recall',
] as const;

export type AIDependentView = (typeof AI_DEPENDENT_VIEWS)[number];

interface WithGeminiErrorBoundaryProps {
  children: ReactNode;
  viewName: string;
  onRetry: () => void;
}

/**
 * Component wrapper for Gemini error handling
 * Use this to wrap AI-dependent components inline
 */
export const WithGeminiErrorBoundary: React.FC<WithGeminiErrorBoundaryProps> = ({
  children,
  viewName,
  onRetry,
}) => {
  return <GeminiErrorBoundary key={viewName} onRetry={onRetry}>{children}</GeminiErrorBoundary>;
};

/**
 * HOC that wraps a component with Gemini error boundary
 *
 * @param WrappedComponent - The component to wrap
 * @param viewName - The view name for retry navigation
 * @returns Wrapped component with error boundary
 */
export function withGeminiErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  viewName: string
) {
  const WithBoundary: React.FC<P & { onRetry?: () => void }> = (props) => {
    const { onRetry, ...rest } = props;

    const handleRetry =
      onRetry ||
      (() => {
        // Default retry behavior - just re-render
        window.location.reload();
      });

    return (
      <GeminiErrorBoundary onRetry={handleRetry}>
        <WrappedComponent {...(rest as P)} />
      </GeminiErrorBoundary>
    );
  };

  WithBoundary.displayName = `withGeminiErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return WithBoundary;
}

/**
 * Check if a view is AI-dependent and needs error boundary
 */
export function isAIDependentView(view: string): view is AIDependentView {
  return AI_DEPENDENT_VIEWS.includes(view as AIDependentView);
}

export default withGeminiErrorBoundary;
