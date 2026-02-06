/**
 * Unified Navigation
 * 
 * Cross-module navigation bar with seamless transitions.
 * Shows progress, preserves context, provides quick access to all modules.
 */

import React from 'react';
import { MessageSquare, Eye, Wrench, FileText, LayoutDashboard } from 'lucide-react';

interface UnifiedNavigationProps {
  currentModule: 'dashboard' | 'osce' | 'clinical_eye' | 'sim_lab' | 'review';
  onNavigate: (module: string) => void;
  progress?: {
    osce?: number;
    clinicalEye?: number;
    simLab?: number;
  };
  className?: string;
}

export function UnifiedNavigation({
  currentModule,
  onNavigate,
  progress = {},
  className = '',
}: UnifiedNavigationProps) {
  const modules = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: LayoutDashboard,
      shortcut: 'Cmd+1',
    },
    {
      id: 'osce',
      name: 'OSCE',
      icon: MessageSquare,
      shortcut: 'Cmd+2',
      progress: progress.osce,
    },
    {
      id: 'clinical_eye',
      name: 'Clinical Eye',
      icon: Eye,
      shortcut: 'Cmd+3',
      progress: progress.clinicalEye,
    },
    {
      id: 'sim_lab',
      name: 'Sim Lab',
      icon: Wrench,
      shortcut: 'Cmd+4',
      progress: progress.simLab,
    },
    {
      id: 'review',
      name: 'Review',
      icon: FileText,
      shortcut: 'Cmd+5',
    },
  ];

  return (
    <nav
      className={`flex items-center gap-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-1 ${className}`}
    >
      {modules.map((module) => {
        const Icon = module.icon;
        const isActive = currentModule === module.id;

        return (
          <button
            key={module.id}
            onClick={() => onNavigate(module.id)}
            className={`flex-1 px-4 py-2 rounded-lg transition-all ${
              isActive
                ? 'bg-[var(--color-accent)] text-white shadow-md'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
            title={`${module.name} (${module.shortcut})`}
          >
            <div className="flex flex-col items-center gap-1">
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{module.name}</span>
              {module.progress !== undefined && (
                <div className="w-full h-1 bg-[var(--color-bg-tertiary)] rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)]"
                    style={{ width: `${module.progress}%` }}
                  />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
