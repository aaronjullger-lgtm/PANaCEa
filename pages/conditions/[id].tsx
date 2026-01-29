import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Lightbulb,
  Dna,
  Microscope,
  BarChart3,
  AlertTriangle,
  Stethoscope,
  ThermometerSun,
  UserCheck,
  Search,
  HelpCircle,
  Pill,
  Hospital,
  Gem,
  Zap,
  Flag,
  TrendingUp,
  GraduationCap,
  Target,
  type LucideIcon,
} from 'lucide-react';
import FormattedSection from '../../components/conditions/FormattedSection';
import { BuzzwordBanner } from '../../components/conditions/BuzzwordBanner';
import {
  getConditionById,
  isMeaningfulContent,
  type ConditionContent,
  type ConditionEntry,
} from '../../lib/loadConditions';
import type { ConditionMeta } from '../../src/types/conditions';

const getConditionIdFromPath = (): string => {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? '');
};

/**
 * Standardized ordering for condition page sections (PA School focused)
 */
const SECTION_ORDER: { key: string; title: string; Icon?: LucideIcon }[] = [
  { key: 'overview', title: 'Overview', Icon: ClipboardList },
  { key: 'keyPoints', title: 'Key Points', Icon: Lightbulb },
  { key: 'etiologyPathophysiology', title: 'Pathophysiology (The Why)', Icon: Dna },
  { key: 'etiology', title: 'Etiology', Icon: Microscope },
  { key: 'epidemiology', title: 'Epidemiology', Icon: BarChart3 },
  { key: 'riskFactors', title: 'Risk Factors', Icon: AlertTriangle },
  {
    key: 'clinicalPresentation',
    title: 'Clinical Presentation (Signs & Symptoms)',
    Icon: Stethoscope,
  },
  { key: 'symptoms', title: 'Symptoms', Icon: ThermometerSun },
  { key: 'physicalExam', title: 'Physical Exam', Icon: UserCheck },
  { key: 'examFindings', title: 'Exam Findings', Icon: Search },
  { key: 'diagnostics', title: 'Diagnosis (Labs, Imaging, Special Tests)', Icon: Microscope },
  { key: 'differentialDiagnosis', title: 'Differential Diagnosis', Icon: HelpCircle },
  { key: 'management', title: 'Management (First Line, Second Line, Patient Ed)', Icon: Pill },
  { key: 'treatment', title: 'Treatment', Icon: Hospital },
  { key: 'treatmentPearls', title: 'Treatment Pearls', Icon: Gem },
  { key: 'complications', title: 'Complications', Icon: Zap },
  { key: 'redFlags', title: 'Red Flags', Icon: Flag },
  { key: 'prognosis', title: 'Prognosis', Icon: TrendingUp },
  { key: 'preventionEducation', title: 'Prevention & Education', Icon: GraduationCap },
  { key: 'pearls', title: 'Pearls (High-Yield Facts for Exams)', Icon: Target },
];

interface ContentSection {
  key: string;
  title: string;
  Icon?: LucideIcon;
  content?: ConditionContent;
}

interface SubtypeTab {
  id: string;
  label: string;
  description?: string;
}

const ConditionPage: React.FC = () => {
  const conditionId = useMemo(() => getConditionIdFromPath(), []);
  const [conditionContent, setConditionContent] = useState<ConditionEntry | undefined>(undefined);
  const [conditionMeta, setConditionMeta] = useState<ConditionMeta | undefined>(undefined);
  const [activeSubtype, setActiveSubtype] = useState<string>('general');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load condition content asynchronously
  useEffect(() => {
    let mounted = true;

    async function loadContent() {
      if (!conditionId) return;

      setLoading(true);
      setError(null);

      try {
        // Load metadata from registry
        const meta = findConditionMetaById(conditionId);
        if (meta && mounted) {
          setConditionMeta(meta);
        }

        // Load from DB via backend API (MedicalContent is the source of truth)
        const entry = await getConditionById(conditionId);
        if (!entry) {
          setError(`Content for "${conditionId}" is not yet available. Please check back later.`);
          return;
        }

        if (mounted) setConditionContent(entry);
      } catch (error) {
        console.error('Failed to load condition:', error);
        setError('Failed to load condition content. Please try again later.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadContent();

    return () => {
      mounted = false;
    };
  }, [conditionId]);

  const sections: ContentSection[] = useMemo(() => {
    if (!conditionContent?.sections) return [];

    return SECTION_ORDER.map((config) => ({
      ...config,
      content: conditionContent.sections?.[config.key],
    })).filter((section) => isMeaningfulContent(section.content));
  }, [conditionContent?.sections]);

  // Determine if condition has subtypes (e.g., AKI, PKD)
  const subtypes: SubtypeTab[] = useMemo(() => {
    const tabs: SubtypeTab[] = [{ id: 'general', label: 'General' }];

    if (!conditionContent?.condition) return tabs;

    const conditionName = conditionContent.condition.toLowerCase();

    // AKI has prerenal, intrinsic, postrenal variants
    if (conditionName.includes('acute kidney injury') || conditionName.includes('aki')) {
      tabs.push(
        { id: 'prerenal', label: 'Prerenal', description: 'Before the kidney' },
        { id: 'intrinsic', label: 'Intrinsic', description: 'Within the kidney' },
        { id: 'postrenal', label: 'Postrenal', description: 'After the kidney' }
      );
    }

    // PKD has autosomal dominant and recessive variants
    if (conditionName.includes('polycystic kidney')) {
      tabs.push(
        { id: 'adpkd', label: 'Autosomal Dominant', description: 'Adult-onset (ADPKD)' },
        { id: 'arpkd', label: 'Autosomal Recessive', description: 'Infantile (ARPKD)' }
      );
    }

    return tabs.length > 1 ? tabs : [];
  }, [conditionContent?.condition]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Clean display name (remove parentheses)
  const displayName = useMemo(() => {
    if (!conditionContent?.condition) return 'Condition not found';
    return conditionContent.condition.replace(/\s*\([^)]*\)/g, '').trim();
  }, [conditionContent?.condition]);

  return (
    <main className="condition-page max-w-5xl mx-auto p-6">
      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)]"></div>
          <p className="mt-4 text-[var(--color-text-muted)]">Loading condition content...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12">
          <div className="bg-data-fail/10 border border-data-fail/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-data-fail mb-2">
              Content Not Available
            </h2>
            <p className="text-data-fail">{error}</p>
          </div>
        </div>
      )}

      {/* Content - only show if not loading and no error */}
      {!loading && !error && (
        <>
          {/* Header with category badge */}
          <header className="condition-header mb-8">
            <div className="flex items-center gap-3 mb-4">
              {conditionMeta && (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    {conditionMeta.system}
                  </span>
                  {conditionMeta.subcategory && (
                    <span className="text-sm text-[var(--color-text-muted)]">
                      • {conditionMeta.subcategory}
                    </span>
                  )}
                </div>
              )}
            </div>

            <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">{displayName}</h1>

            {conditionMeta?.aliases && conditionMeta.aliases.length > 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Also known as: {conditionMeta.aliases.join(', ')}
              </p>
            )}
          </header>

          <BuzzwordBanner conditionName={displayName} />

          {/* Tabbed interface for subtypes */}
          {subtypes.length > 0 && (
            <div className="mb-6">
              <div className="border-b border-[var(--color-border)]">
                <nav className="flex gap-4" aria-label="Condition subtypes">
                  {subtypes.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubtype(tab.id)}
                      className={`
                    px-4 py-3 font-medium text-sm border-b-2 transition-colors
                    ${
                      activeSubtype === tab.id
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                    }
                  `}
                      aria-current={activeSubtype === tab.id ? 'page' : undefined}
                    >
                      <span>{tab.label}</span>
                      {tab.description && (
                        <span className="block text-xs text-[var(--color-text-muted)]">
                          {tab.description}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          )}

          {/* Content sections */}
          <div className="condition-sections space-y-4">
            {sections.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[var(--color-text-muted)]">
                  Condition content isn&apos;t available for this entry.
                </p>
              </div>
            )}

            {sections.map((section) => (
              <motion.section
                key={section.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {section.Icon && (
                      <section.Icon className="w-5 h-5 text-[var(--color-accent)]" />
                    )}
                    <span>{section.title}</span>
                  </h3>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      expandedSections.has(section.key) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                <AnimatePresence>
                  {expandedSections.has(section.key) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-200 dark:border-gray-700"
                    >
                      <div className="px-6 py-4 condition-content">
                        <FormattedSection content={section.content} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            ))}
          </div>
        </>
      )}
    </main>
  );
};

export default ConditionPage;
