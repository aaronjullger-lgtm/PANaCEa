/**
 * NotFoundPage - Branded 404 page with design system tokens
 *
 * Route-aware: when path is /study/path, shows "Study Path is coming soon" messaging.
 * Uses semantic tokens and primary CTA styles per UI design system.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Target } from 'lucide-react';

interface NotFoundPageProps {
  currentPath: string;
  onGoToDashboard: () => void;
  onNavigateToPractice?: () => void;
  onNavigateToKnowledge?: () => void;
}

const isStudyPath = (path: string) =>
  path === '/study/path' || path.startsWith('/study/path/');

/**
 * Branded 404 page with design tokens and contextual messaging
 */
export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  currentPath,
  onGoToDashboard,
  onNavigateToPractice,
  onNavigateToKnowledge,
}) => {
  const showStudyPathMessage = isStudyPath(currentPath);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-[var(--color-text-primary)] mb-4">
            404
          </h1>
          {showStudyPathMessage ? (
            <>
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
                Page Not Found
              </h2>
              <p className="text-[var(--color-text-muted)] mb-6">
                This section is not currently available. Explore Practice & Training or Knowledge Base instead.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {onNavigateToPractice && (
                  <Link
                    to="/practice"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigateToPractice();
                    }}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-xl font-medium hover:opacity-90 transition-opacity min-h-[44px]"
                  >
                    <Target className="w-5 h-5" />
                    Practice & Training
                  </Link>
                )}
                {onNavigateToKnowledge && (
                  <Link
                    to="/study/knowledge"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigateToKnowledge();
                    }}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl font-medium hover:bg-[var(--color-bg-tertiary)] transition-colors min-h-[44px]"
                  >
                    <BookOpen className="w-5 h-5" />
                    Knowledge Base
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
                Page Not Found
              </h2>
              <p className="text-[var(--color-text-muted)] mb-6">
                The page you're looking for doesn't exist or has been moved.
              </p>
            </>
          )}
        </div>
        <Link
          to="/study"
          onClick={onGoToDashboard}
          className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-xl font-medium hover:opacity-90 transition-opacity min-h-[44px] min-w-[44px]"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
