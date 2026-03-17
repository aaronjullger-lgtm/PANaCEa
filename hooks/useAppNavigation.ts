/**
 * useAppNavigation
 *
 * Manages the URL-to-view mapping and notFound state for the main App shell.
 * Extracts routing logic from App.tsx so the component can focus on UI rendering.
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TRAINING_MODES } from '../config/training-modes';
import type { View } from '../config/appViews';

const KNOWN_EXACT_PATHS = new Set([
  '/',
  '/menu',
  '/study',
  '/study/',
  '/study/path',
  '/study/knowledge',
  '/study/utilities',
  '/practice',
  '/progress',
  '/daily-challenges',
  '/study/main-session',
  '/study/main-session/',
  '/admin',
  '/admin/curation',
  '/admin/refinery',
  '/admin/taxonomies',
  '/admin/system-mappings',
  '/admin/question-generator',
  '/clinical-eye',
  '/visualizer',
  '/gap-analysis',
  '/clinical-profile',
  '/medical-database',
  '/live-collaboration',
  '/explorer',
  '/study/library',
  '/study/tutor',
  '/study/companion',
  '/study/flashcards',
  '/study/pearls',
]);

function isKnownPath(path: string): boolean {
  if (KNOWN_EXACT_PATHS.has(path)) return true;
  return (
    path.startsWith('/study/knowledge') ||
    path.startsWith('/study/utilities') ||
    path.startsWith('/study/reference') ||
    path.startsWith('/study/toolkit') ||
    path.startsWith('/study/path') ||
    path.startsWith('/gap-analysis') ||
    path.startsWith('/clinical-profile') ||
    path.startsWith('/modes/') ||
    path === '/core-adaptive' ||
    path.startsWith('/medical-database') ||
    path.startsWith('/live-collaboration') ||
    path.startsWith('/explorer') ||
    path.startsWith('/session/')
  );
}

/** Build route→view map once (TRAINING_MODES is static) */
const ROUTE_TO_VIEW: Record<string, View> = (() => {
  const map: Record<string, View> = {};
  for (const mode of TRAINING_MODES) {
    map[mode.route] = mode.id as View;
  }
  return map;
})();

function pathToView(path: string, navigate: ReturnType<typeof useNavigate>): View | 'redirect' | null {
  // Legacy redirect: /study/reference → /study/knowledge
  if (path.startsWith('/study/reference')) {
    navigate('/study/knowledge', { replace: true });
    return 'redirect';
  }
  // Legacy redirect: /study/toolkit → /study/utilities
  if (path.startsWith('/study/toolkit')) {
    navigate('/study/utilities', { replace: true });
    return 'redirect';
  }
  // Legacy redirect: /study/main-session → /study
  if (path === '/study/main-session' || path === '/study/main-session/') {
    navigate('/study', { replace: true });
    return 'redirect';
  }

  if (path.startsWith('/session/')) return 'session_runner';

  // Training mode deep links: /modes/ecg-drill → ecg_drill
  if (path.startsWith('/modes/') || path === '/core-adaptive') {
    return ROUTE_TO_VIEW[path] ?? null;
  }

  // React Router routes - these are handled by <Route> components, not view-state
  // Return null so useAppNavigation doesn't try to set view for them
  if (path === '/' || path === '') return 'command_center';
  if (path === '/menu') return 'menu';
  if (path === '/study' || path === '/study/') return 'command_center';
  if (path.startsWith('/study/knowledge')) return null; // Now a React Router route
  if (path.startsWith('/study/utilities')) return null; // Now a React Router route
  if (path.startsWith('/study/path')) return null; // Now a React Router route
  if (path.startsWith('/study/library')) return null; // Now a React Router route
  if (path.startsWith('/study/tutor')) return null; // Now a React Router route
  if (path.startsWith('/study/companion')) return null; // Now a React Router route
  if (path.startsWith('/study/flashcards')) return null; // Now a React Router route
  if (path.startsWith('/study/pearls')) return null; // Now a React Router route
  if (path === '/gap-analysis' || path.startsWith('/gap-analysis')) return null; // Now a React Router route
  if (path === '/clinical-profile' || path.startsWith('/clinical-profile')) return null; // Now a React Router route
  if (path === '/medical-database' || path.startsWith('/medical-database')) return null; // Now a React Router route
  if (path === '/live-collaboration' || path.startsWith('/live-collaboration')) return null; // Now a React Router route
  if (path.startsWith('/explorer')) return null; // Now a React Router route

  return null;
}

interface UseAppNavigationReturn {
  view: View;
  setView: (v: View) => void;
  showNotFound: boolean;
}

export function useAppNavigation(): UseAppNavigationReturn {
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState<View>('command_center');
  const [showNotFound, setShowNotFound] = useState(false);

  // Sync URL to view — single source of truth
  // Note: React Router routes return null from pathToView and are handled by <Route> components
  useEffect(() => {
    const path = location.pathname;

    if (!isKnownPath(path)) {
      setShowNotFound(true);
      return;
    }

    setShowNotFound(false);

    const resolvedView = pathToView(path, navigate);
    if (resolvedView === 'redirect' || resolvedView === null) {
      // null means it's a React Router route, handled by <Route> components
      // Don't set view state for React Router routes
      return;
    }

    setView(resolvedView);
  }, [location.pathname, navigate]);

  // Accessibility: focus main-content after navigation
  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.setAttribute('tabindex', '-1');
      mainContent.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return { view, setView, showNotFound };
}
