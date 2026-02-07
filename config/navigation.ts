import { LucideIcon } from 'lucide-react';
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
};
/**
 * Universal Medical Companion - Main Navigation Configuration
 *
 * NAVIGATION ARCHITECTURE (single source of truth):
 * - NavRail (components/layout/NavRail.tsx) is the only active navigation.
 *   Exactly five items, URL-driven; App.tsx syncs path → view.
 *   Study: Home (/study), Practice (/menu), Progress (/study?tab=analytics).
 *   Resources: Reference (/study/reference), Toolkit (/study/toolkit).
 * - NAVIGATION_CONFIG only contains paths that map to real routes or views in App.tsx.
 *   Dead links (/education, /settings, /subscription, /skills) have been removed.
 *   Settings is accessed via header button (modal), not a route.
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
      { label: 'Clinical Reference', path: '/study/reference', icon: 'Library' },
      { label: 'Toolkit', path: '/study/toolkit', icon: 'Zap' },
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
      { label: 'Clinical Reference', path: '/study/reference', icon: 'Library' },
      { label: 'Toolkit', path: '/study/toolkit', icon: 'Zap' },
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
