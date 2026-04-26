/**
 * CommandPalette — ⌘K / Ctrl+K quick navigation overlay.
 *
 * Uses cmdk (via shadcn/ui Command component) for fuzzy search
 * across navigation routes, conditions, drugs, and drills.
 *
 * Lazy-loaded at the app root via React.lazy().
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  BookOpen,
  Target,
  BarChart3,
  Stethoscope,
  Brain,
  Pill,
  GraduationCap,
  Settings,
  Search,
  Zap,
  Eye,
  Database,
  FlaskConical,
} from '@/components/ui/icons';

// ── Static navigation items ──
const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, group: 'Navigation' },
  { label: 'Practice Questions', path: '/practice', icon: Target, group: 'Navigation' },
  { label: 'Progress & Analytics', path: '/progress', icon: BarChart3, group: 'Navigation' },
  { label: 'Knowledge Base', path: '/study/knowledge', icon: BookOpen, group: 'Navigation' },
  { label: 'Clinical Library', path: '/medical-database', icon: Stethoscope, group: 'Navigation' },
  { label: 'Study Path', path: '/study/path', icon: GraduationCap, group: 'Navigation' },
  { label: 'Gap Analysis', path: '/gap-analysis', icon: Brain, group: 'Navigation' },
  { label: 'Clinical Profile', path: '/clinical-profile', icon: Stethoscope, group: 'Navigation' },
  { label: 'Daily Challenges', path: '/daily-challenges', icon: Zap, group: 'Navigation' },
  { label: 'Toolkit & Utilities', path: '/study/utilities', icon: Settings, group: 'Navigation' },
  { label: 'Clinical Eye (Visual Dx)', path: '/clinical-eye', icon: Eye, group: 'Navigation' },
  { label: 'Explorer', path: '/explorer', icon: Search, group: 'Navigation' },
  { label: 'Knowledge Visualizer', path: '/visualizer', icon: Database, group: 'Navigation' },
] as const;

// ── Drill quick-launch items ──
const DRILL_ITEMS = [
  { label: 'Pharmacology Drill', path: '/practice?drill=pharm', icon: Pill, group: 'Drills' },
  { label: 'Lab Interpretation Drill', path: '/practice?drill=minilab', icon: FlaskConical, group: 'Drills' },
  { label: 'DDx Drill', path: '/practice?drill=ddx', icon: Brain, group: 'Drills' },
  { label: 'ECG Drill', path: '/practice?drill=ecg', icon: Zap, group: 'Drills' },
  { label: 'Imaging Drill', path: '/practice?drill=imaging', icon: Eye, group: 'Drills' },
  { label: 'Anatomy Drill', path: '/practice?drill=anatomy', icon: Stethoscope, group: 'Drills' },
] as const;

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const openPalette = () => setOpen(true);
    document.addEventListener('keydown', down);
    window.addEventListener('panacea:open-command-palette', openPalette);
    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener('panacea:open-command-palette', openPalette);
    };
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      navigate(path);
    },
    [navigate],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, drills, conditions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.path}
              value={item.label}
              onSelect={() => handleSelect(item.path)}
            >
              <item.icon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Drills">
          {DRILL_ITEMS.map((item) => (
            <CommandItem
              key={item.path}
              value={item.label}
              onSelect={() => handleSelect(item.path)}
            >
              <item.icon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
