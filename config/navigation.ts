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

// NAVIGATION_STRUCTURE and getNavigationWithIcons removed — contained dead links.
// Use NAVIGATION_CONFIG or NAV_RAIL_ITEMS instead.

/**
 * Get all known paths in the application.
 *
 * @deprecated Prefer importing KNOWN_PATHS or isKnownPath from config/routeRegistry.ts.
 * Training mode routes are already included in the registry (spread from TRAINING_MODES).
 * This function is kept only for backward compatibility.
 */
export const getKnownPaths = (): string[] => {
  return Array.from(new Set(CANONICAL_PATHS));
};

/**
 * Check if a path is a known, valid application route.
 *
 * @deprecated Import isKnownPath from config/routeRegistry.ts or lib/constants/routes.ts instead.
 */
export const isKnownPath = checkKnownPath;
