import { LucideIcon } from 'lucide-react';
import { CANONICAL_PATHS as REGISTRY_CANONICAL_PATHS } from './routeRegistry';
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
  RotateCcw,
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
  RotateCcw,
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
  section: 'study' | 'knowledge' | 'plan';
  showInBottomBar: boolean;
}

/**
 * Canonical nav rail items. Used by NavRail and referenced in docs.
 * Kept intentionally small for the signed-in shell: one study entry point,
 * one practice entry point, review, knowledge, progress, and the long-range plan.
 */
export const NAV_RAIL_ITEMS: NavRailItem[] = [
  {
    id: 'home',
    label: 'Study',
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
    id: 'review',
    label: 'Review',
    path: '/study?mode=review',
    icon: RotateCcw,
    section: 'study',
    showInBottomBar: true,
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    path: '/study/knowledge',
    icon: BookOpen,
    section: 'knowledge',
    showInBottomBar: true,
  },
  {
    id: 'progress',
    label: 'Progress',
    path: '/progress',
    icon: BarChart3,
    section: 'plan',
    showInBottomBar: true,
  },
  {
    id: 'study_path',
    label: 'Plan',
    path: '/study/path',
    icon: TrendingUp,
    section: 'plan',
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
 */

// NAVIGATION_CONFIG removed — had dead links (/medical-database, /live-collaboration, /explorer
// are view-state routes with no <Route> element). Use NAV_RAIL_ITEMS for navigation configuration.

// getKnownPaths() and isKnownPath re-exports removed — import from config/routeRegistry.ts or
// lib/constants/routes.ts instead.
