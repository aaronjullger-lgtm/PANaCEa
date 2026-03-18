import { LucideIcon } from 'lucide-react';
import { isKnownPath as checkKnownPath, CANONICAL_PATHS as REGISTRY_CANONICAL_PATHS } from './routeRegistry';
import {
  LayoutDashboard,
  LineChart,
  BrainCircuit,
  Library,
  Timer,
  Stethoscope,
  Pill,
  Microscope,
  Zap,
  FileText,
  BookA,
  Eye,
  GraduationCap,
  Settings,
  CreditCard,
  Database,
  Users,
  Home,
  Dumbbell,
  BarChart3,
  TrendingUp,
  BookOpen,
  Calculator,
  Calendar,
} from 'lucide-react';

export interface NavigationItem {
  label: string;
  path: string;
  icon: string;
  iconComponent?: LucideIcon;
}

export interface NavigationCategory {
  category: string;
  items: NavigationItem[];
}
export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  LineChart,
  BrainCircuit,
  Library,
  Timer,
  Stethoscope,
  Pill,
  Microscope,
  Zap,
  FileText,
  BookA,
  Eye,
  GraduationCap,
  Settings,
  CreditCard,
  Database,
  Users,
  Home,
  Dumbbell,
  BarChart3,
  TrendingUp,
  BookOpen,
  Calculator,
  Calendar,
};

/**
 * Nav rail item shape for the primary app navigation (NavRail).
 * Single source of truth for rail labels, paths, and icons.
 */
export interface NavRailItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  section: 'study' | 'resources';
  showInBottomBar: boolean;
}

/**
 * Canonical nav rail items. Used by NavRail and referenced in docs.
 * Exactly five items in mobile bottom bar; Study Path is rail-only on desktop.
 */
export const NAV_RAIL_ITEMS: NavRailItem[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/study',
    icon: Home,
    section: 'study',
    showInBottomBar: true,
  },
  {
    id: 'practice',
    label: 'Practice',
    path: '/practice',
    icon: Dumbbell,
    section: 'study',
    showInBottomBar: true,
  },
  {
    id: 'progress',
    label: 'Progress',
    path: '/progress',
    icon: BarChart3,
    section: 'study',
    showInBottomBar: true,
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    path: '/study/knowledge',
    icon: BookOpen,
    section: 'resources',
    showInBottomBar: true,
  },
  {
    id: 'utilities',
    label: 'Tools',
    path: '/study/utilities',
    icon: Calculator,
    section: 'resources',
    showInBottomBar: true,
  },
  {
    id: 'study_path',
    label: 'Study Path',
    path: '/study/path',
    icon: TrendingUp,
    section: 'resources',
    showInBottomBar: false,
  },
  {
    id: 'daily_challenges',
    label: 'Daily',
    path: '/daily-challenges',
    icon: Calendar,
    section: 'resources',
    showInBottomBar: false,
  },
];

/**
 * Paths that map to app views or explicit routes. Used for 404 detection in App.tsx.
 *
 * DERIVED FROM routeRegistry.ts — the single source of truth.
 * Do NOT add routes here; add them to ROUTE_REGISTRY in config/routeRegistry.ts instead.
 *
 * The extra trailing-slash variants (/study/, /study/main-session/) are kept for
 * backward-compat 404 detection; routeRegistry handles prefix matching for those.
 */
export const CANONICAL_PATHS: string[] = REGISTRY_CANONICAL_PATHS;
/**
 * Universal Medical Companion - Main Navigation Configuration
 *
 * SOURCE OF TRUTH:
 * - NAV_RAIL_ITEMS: Primary nav (NavRail, Command Palette). Add or change rail items here only.
 * - CANONICAL_PATHS: Paths used for 404 detection in App.tsx. Add new routes here.
 * - NAVIGATION_CONFIG / NAVIGATION_STRUCTURE: Legacy. Do not use for new features; see NAV_RAIL_ITEMS.
 */
export const NAVIGATION_CONFIG: NavigationCategory[] = [
  {
    category: 'Overview',
    items: [
      { label: 'Dashboard', path: '/study', icon: 'LayoutDashboard' },
      { label: 'Analytics', path: '/study?tab=analytics', icon: 'LineChart' },
    ],
  },
  {
    category: 'Resources',
    items: [
      { label: 'Clinical Reference', path: '/study/knowledge', icon: 'Library' },
      { label: 'Toolkit', path: '/study/utilities', icon: 'Zap' },
      { label: 'Medical Databases', path: '/medical-database', icon: 'Database' },
      { label: 'Live Collaboration', path: '/live-collaboration', icon: 'Users' },
      { label: 'Cross‑System Explorer', path: '/explorer', icon: 'BrainCircuit' },
    ],
  },
];

/**
 * @deprecated NAVIGATION_STRUCTURE contains many dead links and should NOT be used.
 * Paths like /education, /stats, /settings, /subscription, /reference/*, /skills/* do not
 * have routes in App.tsx and will show wrong content. Use NAVIGATION_CONFIG instead.
 *
 * This export is kept only for legacy compatibility; any code using it should migrate to
 * NAVIGATION_CONFIG or NavRail, which only expose valid paths.
 *
 * See: docs/GAP_ANALYSIS_AND_IMPROVEMENT_PLAN.md and docs/EXTRAPOLATED_DEVELOPMENT_AUDIT.md
 */
export const NAVIGATION_STRUCTURE: NavigationCategory[] = [
  {
    category: 'Overview',
    items: [
      { label: 'Dashboard', path: '/study', icon: 'LayoutDashboard' },
      { label: 'Analytics', path: '/study?tab=analytics', icon: 'LineChart' },
    ],
  },
  {
    category: 'Resources',
    items: [
      { label: 'Clinical Reference', path: '/study/knowledge', icon: 'Library' },
      { label: 'Toolkit', path: '/study/utilities', icon: 'Zap' },
      { label: 'Medical Databases', path: '/medical-database', icon: 'Database' },
      { label: 'Live Collaboration', path: '/live-collaboration', icon: 'Users' },
      { label: 'Cross‑System Explorer', path: '/explorer', icon: 'BrainCircuit' },
    ],
  },
];

// Add icon components to navigation items
export const getNavigationWithIcons = (): NavigationCategory[] => {
  return NAVIGATION_STRUCTURE.map((category) => ({
    ...category,
    items: category.items.map((item) => ({
      ...item,
      iconComponent: ICON_MAP[item.icon],
    })),
  }));
};

/**
 * Get all known paths in the application.
 * SINGLE SOURCE OF TRUTH for route validation.
 *
 * Combines:
 * - CANONICAL_PATHS (static app routes)
 * - TRAINING_MODES routes (dynamic drill/mode routes)
 *
 * Used by useAppNavigation for 404 detection.
 */
export const getKnownPaths = (): string[] => {
  // Import here to avoid circular dependency at module load time
  // (navigation.ts is imported early, training-modes may import from navigation)
  const { TRAINING_MODES } = require('./training-modes');

  const paths = new Set<string>(CANONICAL_PATHS);

  // Add all training mode routes
  for (const mode of TRAINING_MODES) {
    paths.add(mode.route);
  }

  return Array.from(paths);
};

/**
 * Check if a path is a known, valid application route.
 * Delegates to config/routeRegistry.ts for the unified validation logic.
 *
 * Used by useAppNavigation for 404 detection.
 *
 * @deprecated Use lib/constants/routes.ts or config/routeRegistry.ts instead
 */
export const isKnownPath = checkKnownPath;
