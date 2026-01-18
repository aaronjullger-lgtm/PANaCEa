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
 * Strict structure for Hub Pages navigation
 */
export const NAVIGATION_CONFIG: NavigationCategory[] = [
  {
    category: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
      { label: 'Analytics', path: '/analytics', icon: 'LineChart' },
    ],
  },
  {
    category: 'Core Modules',
    items: [
      { label: 'Education & Retention', path: '/education', icon: 'GraduationCap' },
      { label: 'Clinical Reference', path: '/reference', icon: 'Library' },
      { label: 'Skill Refinement', path: '/skills', icon: 'Zap' },
    ],
  },
  {
    category: 'Account',
    items: [
      { label: 'Profile & Settings', path: '/settings', icon: 'Settings' },
      { label: 'Subscription', path: '/subscription', icon: 'CreditCard' },
    ],
  },
];

/**
 * Legacy navigation structure - kept for backward compatibility
 * @deprecated Use NAVIGATION_CONFIG instead
 */
export const NAVIGATION_STRUCTURE: NavigationCategory[] = [
  {
    category: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
      { label: 'Performance', path: '/stats', icon: 'LineChart' },
    ],
  },
  {
    category: 'Education',
    items: [
      { label: 'Adaptive Review', path: '/education/adaptive', icon: 'BrainCircuit' },
      { label: 'Question Bank', path: '/education/qbank', icon: 'Library' },
      { label: 'Simulated Exams', path: '/education/simulator', icon: 'Timer' },
      { label: 'Case Studies', path: '/education/cases', icon: 'FileText' },
    ],
  },
  {
    category: 'Reference',
    items: [
      { label: 'Conditions', path: '/reference/conditions', icon: 'Stethoscope' },
      { label: 'Pharmacology', path: '/reference/drugs', icon: 'Pill' },
      { label: 'Diagnostics', path: '/reference/diagnostics', icon: 'Microscope' },
      { label: 'Guidelines', path: '/reference/guidelines', icon: 'FileText' },
    ],
  },
  {
    category: 'Skills',
    items: [
      { label: 'Medical Terminology', path: '/skills/terminology', icon: 'BookA' },
      { label: 'Rapid Recall', path: '/skills/rapid', icon: 'Zap' },
      { label: 'Visual Diagnostics', path: '/skills/visuals', icon: 'Eye' },
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
