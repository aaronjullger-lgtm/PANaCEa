/**
 * Pharmacology Drug Card Renderer
 *
 * Interactive drug card template displaying:
 * - Mechanism of action
 * - Side effects with visual indicators
 * - Drug interactions
 * - Clinical pearls
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill,
  AlertTriangle,
  Activity,
  Target,
  Heart,
  Brain,
  Zap,
  Info,
  ChevronRight,
  X,
  Gem,
} from 'lucide-react';

export interface DrugCard {
  name: string;
  genericName?: string;
  class: string;
  mechanism: string;
  indications: string[];
  sideEffects: SideEffect[];
  interactions: string[];
  contraindications: string[];
  dosing: string;
  pearls: string[];
}

export interface SideEffect {
  name: string;
  severity: 'common' | 'serious' | 'rare';
  system: 'cardiac' | 'neuro' | 'gi' | 'derm' | 'other';
  visualization?: 'ekg' | 'wave' | 'alert';
}

interface DrugCardRendererProps {
  drug: DrugCard;
  onClose?: () => void;
  theme?: 'light' | 'dark';
}

export default function DrugCardRenderer({
  drug,
  onClose,
  theme = 'light',
}: DrugCardRendererProps): React.ReactElement {
  const [expandedSection, setExpandedSection] = useState<string>('mechanism');
  const [highlightedEffect, setHighlightedEffect] = useState<SideEffect | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-xl shadow-2xl overflow-hidden ${
        theme === 'light' ? 'bg-white' : 'bg-gray-900'
      }`}
      style={{ maxWidth: '800px', maxHeight: '90vh' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Pill className="w-6 h-6" />
              <h2 className="text-2xl font-bold">{drug.name}</h2>
            </div>
            {drug.genericName && <p className="text-sm opacity-90 mb-1">({drug.genericName})</p>}
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
              {drug.class}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
        {/* Mechanism of Action */}
        <Section
          title="Mechanism of Action"
          icon={<Target className="w-5 h-5" />}
          isExpanded={expandedSection === 'mechanism'}
          onToggle={() => toggleSection('mechanism')}
          theme={theme}
        >
          <p className={theme === 'light' ? 'text-gray-700' : 'text-gray-300'}>{drug.mechanism}</p>
        </Section>

        {/* Indications */}
        <Section
          title="Indications"
          icon={<Info className="w-5 h-5" />}
          isExpanded={expandedSection === 'indications'}
          onToggle={() => toggleSection('indications')}
          theme={theme}
        >
          <ul className="list-disc pl-5 space-y-1">
            {drug.indications.map((indication, idx) => (
              <li key={idx} className={theme === 'light' ? 'text-gray-700' : 'text-gray-300'}>
                {indication}
              </li>
            ))}
          </ul>
        </Section>

        {/* Side Effects with Visualization */}
        <Section
          title="Side Effects"
          icon={<AlertTriangle className="w-5 h-5" />}
          isExpanded={expandedSection === 'sideEffects'}
          onToggle={() => toggleSection('sideEffects')}
          theme={theme}
          badge={drug.sideEffects.length}
        >
          <div className="space-y-3">
            {drug.sideEffects.map((effect, idx) => (
              <motion.div
                key={idx}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  highlightedEffect === effect
                    ? theme === 'light'
                      ? 'bg-red-100 border-2 border-red-500'
                      : 'bg-red-900/30 border-2 border-red-500'
                    : theme === 'light'
                      ? 'bg-gray-50 hover:bg-gray-100'
                      : 'bg-gray-800 hover:bg-gray-700'
                }`}
                onMouseEnter={() => setHighlightedEffect(effect)}
                onMouseLeave={() => setHighlightedEffect(null)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSystemIcon(effect.system)}
                    <div>
                      <p
                        className={`font-medium ${
                          theme === 'light' ? 'text-gray-900' : 'text-white'
                        }`}
                      >
                        {effect.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {effect.system} • {effect.severity}
                      </p>
                    </div>
                  </div>
                  {getSeverityBadge(effect.severity, theme)}
                </div>

                {/* Visualization on hover */}
                <AnimatePresence>
                  {highlightedEffect === effect && effect.visualization && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600"
                    >
                      {renderVisualization(effect, theme)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* Drug Interactions */}
        <Section
          title="Drug Interactions"
          icon={<Zap className="w-5 h-5" />}
          isExpanded={expandedSection === 'interactions'}
          onToggle={() => toggleSection('interactions')}
          theme={theme}
          badge={drug.interactions.length}
        >
          <ul className="space-y-2">
            {drug.interactions.map((interaction, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-2 p-2 rounded ${
                  theme === 'light' ? 'bg-yellow-50' : 'bg-yellow-900/20'
                }`}
              >
                <AlertTriangle
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    theme === 'light' ? 'text-yellow-600' : 'text-yellow-400'
                  }`}
                />
                <span
                  className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}
                >
                  {interaction}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Dosing */}
        <Section
          title="Dosing"
          icon={<Pill className="w-5 h-5" />}
          isExpanded={expandedSection === 'dosing'}
          onToggle={() => toggleSection('dosing')}
          theme={theme}
        >
          <p
            className={`font-mono text-sm whitespace-pre-line ${
              theme === 'light' ? 'text-gray-700' : 'text-gray-300'
            }`}
          >
            {drug.dosing}
          </p>
        </Section>

        {/* Clinical Pearls */}
        <Section
          title="Clinical Pearls"
          icon={<Zap className="w-5 h-5 text-yellow-500" />}
          isExpanded={expandedSection === 'pearls'}
          onToggle={() => toggleSection('pearls')}
          theme={theme}
        >
          <ul className="space-y-2">
            {drug.pearls.map((pearl, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-2 p-3 rounded-lg ${
                  theme === 'light'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-yellow-900/20 border border-yellow-800'
                }`}
              >
                <Gem
                  className={`w-5 h-5 flex-shrink-0 ${
                    theme === 'light' ? 'text-amber-500' : 'text-amber-400'
                  }`}
                />
                <span
                  className={`text-sm ${theme === 'light' ? 'text-yellow-900' : 'text-yellow-100'}`}
                >
                  {pearl}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </motion.div>
  );
}

/**
 * Collapsible Section Component
 */
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  theme: 'light' | 'dark';
  badge?: number;
}

function Section({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
  theme,
  badge,
}: SectionProps): React.ReactElement {
  return (
    <div className={`border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 transition-colors ${
          theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-gray-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={theme === 'light' ? 'text-blue-600' : 'text-blue-400'}>{icon}</span>
          <h3 className={`font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            {title}
          </h3>
          {badge !== undefined && (
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                theme === 'light' ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/30 text-blue-400'
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-5 h-5" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Get icon for body system
 */
function getSystemIcon(system: SideEffect['system']): React.ReactNode {
  const iconClass = 'w-5 h-5';

  switch (system) {
    case 'cardiac':
      return <Heart className={`${iconClass} text-red-500`} />;
    case 'neuro':
      return <Brain className={`${iconClass} text-purple-500`} />;
    case 'gi':
      return <Activity className={`${iconClass} text-orange-500`} />;
    case 'derm':
      return <AlertTriangle className={`${iconClass} text-yellow-500`} />;
    default:
      return <Info className={`${iconClass} text-gray-500`} />;
  }
}

/**
 * Get severity badge
 */
function getSeverityBadge(
  severity: SideEffect['severity'],
  theme: 'light' | 'dark'
): React.ReactNode {
  const baseClass = 'text-xs px-2 py-1 rounded-full font-medium';

  switch (severity) {
    case 'serious':
      return (
        <span
          className={`${baseClass} ${
            theme === 'light' ? 'bg-red-100 text-red-700' : 'bg-red-900/30 text-red-400'
          }`}
        >
          Serious
        </span>
      );
    case 'common':
      return (
        <span
          className={`${baseClass} ${
            theme === 'light' ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/30 text-blue-400'
          }`}
        >
          Common
        </span>
      );
    case 'rare':
      return (
        <span
          className={`${baseClass} ${
            theme === 'light' ? 'bg-gray-100 text-gray-700' : 'bg-gray-700 text-gray-400'
          }`}
        >
          Rare
        </span>
      );
  }
}

/**
 * Render visualization for side effect
 */
function renderVisualization(effect: SideEffect, theme: 'light' | 'dark'): React.ReactNode {
  if (!effect.visualization) return null;

  const bgClass = theme === 'light' ? 'bg-gray-100' : 'bg-gray-800';

  if (effect.visualization === 'ekg') {
    // Simplified EKG visualization for QT prolongation
    if (effect.name.toLowerCase().includes('qt')) {
      return (
        <div className={`p-4 rounded-lg ${bgClass}`}>
          <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-400">
            EKG Pattern: Prolonged QT Interval
          </p>
          <svg
            viewBox="0 0 400 100"
            className="w-full h-20"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
          >
            {/* Baseline */}
            <line x1="0" y1="50" x2="400" y2="50" stroke="#94a3b8" strokeWidth="1" />

            {/* Normal beat */}
            <path
              d="M 20 50 L 30 50 L 35 20 L 37 50 L 40 60 L 45 50 L 80 50"
              stroke="#10b981"
              strokeWidth="2"
              fill="none"
            />

            {/* Prolonged QT beat - wider T wave */}
            <path
              d="M 120 50 L 130 50 L 135 20 L 137 50 L 140 60 L 155 50 L 190 50"
              stroke="#ef4444"
              strokeWidth="2"
              fill="none"
            />

            {/* Annotations */}
            <text x="50" y="75" fontSize="10" fill="#10b981">
              Normal
            </text>
            <text x="140" y="75" fontSize="10" fill="#ef4444">
              Prolonged
            </text>
          </svg>
          <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
            May lead to Torsades de Pointes (polymorphic VT)
          </p>
        </div>
      );
    }
  }

  if (effect.visualization === 'wave') {
    return (
      <div className={`p-4 rounded-lg ${bgClass}`}>
        <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-400">
          Effect Pattern
        </p>
        <svg viewBox="0 0 200 50" className="w-full h-16">
          <path
            d="M 0 25 Q 25 10, 50 25 T 100 25 T 150 25 T 200 25"
            stroke="#3b82f6"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg ${bgClass} text-center`}>
      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
      <p className="text-xs text-gray-600 dark:text-gray-400">Monitor closely for this effect</p>
    </div>
  );
}

/**
 * Example drug data for demonstration
 */
export const EXAMPLE_DRUG: DrugCard = {
  name: 'Amiodarone',
  genericName: 'Cordarone',
  class: 'Class III Antiarrhythmic',
  mechanism:
    'Blocks potassium channels, prolonging the action potential and refractory period. Also has some sodium and calcium channel blocking effects.',
  indications: [
    'Ventricular tachycardia',
    'Ventricular fibrillation',
    'Atrial fibrillation (rate control)',
    'Supraventricular tachycardia',
  ],
  sideEffects: [
    {
      name: 'QT Prolongation',
      severity: 'serious',
      system: 'cardiac',
      visualization: 'ekg',
    },
    {
      name: 'Pulmonary Toxicity',
      severity: 'serious',
      system: 'other',
      visualization: 'alert',
    },
    {
      name: 'Thyroid Dysfunction',
      severity: 'common',
      system: 'other',
      visualization: 'alert',
    },
    {
      name: 'Photosensitivity',
      severity: 'common',
      system: 'derm',
      visualization: 'alert',
    },
  ],
  interactions: [
    'Warfarin: Increases INR significantly',
    'Digoxin: Increases digoxin levels',
    'Beta-blockers: Increased risk of bradycardia',
    'Other QT-prolonging drugs: Additive effect',
  ],
  contraindications: [
    'Severe sinus node dysfunction',
    'Second or third-degree AV block',
    'Cardiogenic shock',
    'Known hypersensitivity',
  ],
  dosing: 'Loading: 800-1600 mg/day divided for 1-3 weeks\nMaintenance: 200-400 mg/day',
  pearls: [
    'Has a very long half-life (40-50 days), so effects persist long after discontinuation',
    'Contains iodine - check thyroid function before starting and periodically',
    'Get baseline PFTs and chest X-ray; monitor for pulmonary toxicity',
    'Check LFTs regularly as hepatotoxicity can occur',
    'Bluish skin discoloration can develop with long-term use',
  ],
};
