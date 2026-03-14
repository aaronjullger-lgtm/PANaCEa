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
  '/practice',
  '/progress',
  '/study/main-session',
  '/study/main-session/',
  '/admin',
  '/clinical-eye',
  '/visualizer',
  '/medical-database',
  '/live-collaboration',
  '/explorer',
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

  if (path === '/' || path === '') return 'command_center';
  if (path === '/menu') return 'menu';
  if (path === '/study' || path === '/study/') return 'command_center';
  if (path.startsWith('/study/knowledge')) return 'reference_library';
  if (path.startsWith('/study/utilities')) return 'toolkit';
  if (path.startsWith('/study/path')) return 'study_path_dashboard';
  if (path === '/gap-analysis' || path.startsWith('/gap-analysis')) return 'gap_analysis';
  if (path === '/clinical-profile' || path.startsWith('/clinical-profile')) return 'clinical_profile';
  if (path === '/medical-database' || path.startsWith('/medical-database')) return 'medical_database';
  if (path === '/live-collaboration' || path.startsWith('/live-collaboration')) return 'live_collaboration';
  if (path.startsWith('/explorer')) return 'cross_system_explorer';

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
  useEffect(() => {
    const path = location.pathname;

    if (!isKnownPath(path)) {
      setShowNotFound(true);
      return;
    }

    setShowNotFound(false);

    const resolvedView = pathToView(path, navigate);
    if (resolvedView === 'redirect' || resolvedView === null) return;

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
