/**
 * useAppNavigation
 *
 * Manages the URL-to-view mapping and notFound state for the main App shell.
 * Extracts routing logic from App.tsx so the component can focus on UI rendering.
 *
 * Route validation uses isKnownPath() from config/navigation.ts to ensure
 * a single source of truth for all canonical routes.
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isValidRoute, getViewForPath } from '../lib/constants/routes';
import type { View } from '../config/appViews';

function pathToView(path: string, navigate: ReturnType<typeof useNavigate>): View | 'redirect' | null {
  // Canonical root redirect: "/" → "/study" so authenticated users always get a consistent URL
  if (path === '/') {
    navigate('/study', { replace: true });
    return 'redirect';
  }

  // Handle legacy redirects
  if (path.startsWith('/study/reference')) {
    navigate('/study/knowledge', { replace: true });
    return 'redirect';
  }
  if (path.startsWith('/study/toolkit')) {
    navigate('/study/utilities', { replace: true });
    return 'redirect';
  }
  if (path === '/study/main-session' || path === '/study/main-session/') {
    navigate('/study', { replace: true });
    return 'redirect';
  }

  // Use unified route registry to determine view
  const view = getViewForPath(path);

  // If view is null, it means the route is handled by React Router (not view-state)
  // Return null so useAppNavigation doesn't try to set view for it
  return view as View | null;
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

    if (!isValidRoute(path)) {
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
