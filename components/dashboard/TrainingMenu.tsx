'use client';

import React, { useState } from 'react';
import {
  Brain,
  Image,
  Zap,
  GitCompare,
  FileText,
  Flame,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';
import { MODE_REGISTRY, TrainingModeConfig } from '@/config/training-modes';

/**
 * Icon mapping helper to map string names from the config to Lucide React components.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Image,
  Zap,
  GitCompare,
  FileText,
  Flame,
};

type FocusOption = 'all' | 'growth' | 'flagged';

interface TrainingMenuProps {
  onStartSession?: (modeId: string, focus?: FocusOption) => void;
}

/**
 * TrainingMenu Component
 *
 * Renders the "Training Command Center" modal body with:
 * - Section A: A prominent Hero card for the Core Adaptive session
 * - Section B: A Bento-style grid for specific Drill Modes
 */
const TrainingMenu: React.FC<TrainingMenuProps> = ({ onStartSession }) => {
  // Localized state for the Core Adaptive focus toggle
  const [focus, setFocus] = useState<FocusOption>('all');

  // Get the core adaptive mode from registry
  const coreMode = MODE_REGISTRY.find((mode) => mode.category === 'core' && mode.id === 'core_adaptive');

  // Filter out the core category for the Bento grid
  const drillModes = MODE_REGISTRY.filter((mode) => mode.category !== 'core');

  /**
   * Get background color class based on theme
   */
  const getThemeBackground = (theme: string): string => {
    const themeMap: Record<string, string> = {
      stone: 'bg-stone-100',
      slate: 'bg-slate-100',
      amber: 'bg-amber-100',
      blue: 'bg-blue-100',
      teal: 'bg-teal-100',
      red: 'bg-red-100',
    };
    return themeMap[theme] || 'bg-gray-100';
  };

  /**
   * Handle drill mode card click
   */
  const handleDrillClick = (mode: TrainingModeConfig) => {
    if (mode.isComingSoon) return;
    onStartSession?.(mode.id);
  };

  /**
   * Handle core session start
   */
  const handleCoreStart = () => {
    if (coreMode) {
      onStartSession?.(coreMode.id, focus);
    }
  };

  /**
   * Render focus toggle (segmented control)
   */
  const renderFocusToggle = () => {
    const options: { value: FocusOption; label: string }[] = [
      { value: 'all', label: 'All Topics' },
      { value: 'growth', label: 'Growth Areas' },
      { value: 'flagged', label: 'Flagged' },
    ];

    return (
      <div className="flex rounded-full bg-stone-200 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => setFocus(option.value)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
              focus === option.value
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  };

  /**
   * Render drill mode card
   */
  const renderDrillCard = (mode: TrainingModeConfig) => {
    const IconComponent = ICON_MAP[mode.iconName] ?? HelpCircle;
    const isDisabled = mode.isComingSoon;

    return (
      <button
        key={mode.id}
        onClick={() => handleDrillClick(mode)}
        disabled={isDisabled}
        className={`
          relative p-5 rounded-2xl border border-stone-200
          text-left transition-transform
          ${getThemeBackground(mode.theme)}
          ${isDisabled 
            ? 'opacity-50 cursor-not-allowed grayscale' 
            : 'hover:scale-[1.02] cursor-pointer shadow-sm hover:shadow-md'
          }
        `}
      >
        {isDisabled && (
          <span className="absolute top-2 right-2 text-xs font-medium text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full">
            Coming Soon
          </span>
        )}
        <div className="flex flex-col gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shadow-sm">
            <IconComponent className="w-5 h-5 text-stone-700" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 text-base">{mode.label}</h3>
            <p className="text-sm text-stone-600 mt-1 line-clamp-2">{mode.description}</p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section A: The Core Adaptive Card */}
      {coreMode && (
        <div className="bg-gradient-to-br from-stone-50 to-stone-100 rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left side: Icon and content */}
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-stone-200">
                  <Brain className="w-7 h-7 text-stone-700" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-stone-900">
                    Core PANCE Simulation
                  </h2>
                  <p className="text-stone-600 mt-1">
                    The gold standard adaptive quiz engine. Practice PANCE-level questions
                    tailored to your knowledge gaps and performance history.
                  </p>
                </div>
              </div>

              {/* Focus Toggle (Segmented Control) */}
              <div className="mt-5">
                {renderFocusToggle()}
              </div>
            </div>

            {/* Right side: Start button */}
            <div className="flex items-center">
              <button
                onClick={handleCoreStart}
                className="w-full md:w-auto px-8 py-3.5 bg-[#3D1B0E] text-white font-semibold rounded-xl hover:bg-[#2b130a] transition-colors shadow-md hover:shadow-lg"
              >
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section B: The Bento Grid */}
      <div>
        <h3 className="text-lg font-semibold text-stone-800 mb-4">Drill Modes</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {drillModes.map((mode) => renderDrillCard(mode))}
        </div>
      </div>
    </div>
  );
};

export default TrainingMenu;
