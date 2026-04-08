import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  ClipboardList,
  Dna,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  Microscope,
  Pill,
  Stethoscope,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import FormattedSection from '../../components/conditions/FormattedSection';
import { BuzzwordBanner } from '../../components/conditions/BuzzwordBanner';
import { ConditionStructuredCards } from '../../components/conditions/ConditionStructuredCards';
import { PastMistakesSection } from '../../components/conditions/PastMistakesSection';
import { KeyDifferencesTable } from '../../components/conditions/KeyDifferencesTable';
import {
  getConditionById,
  isMeaningfulContent,
  mergeConditionContent,
  type ConditionEntry,
} from '../../lib/loadConditions';
import {
  CONDITION_SECTION_CONFIG,
  DEFAULT_EXPANDED_SECTION_IDS,
  type ConditionSectionConfig,
} from '../../lib/conditionSections';
import type { ConditionMeta } from '../../src/types/conditions';
import { findConditionMetaById } from '../../src/lib/conditionSearch';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../lib/logger';

const getConditionIdFromPath = (): string => {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? '');
};

/** Extract a short string from condition sections for hero/key-facts display */
function getHeroValue(
  sections: Record<string, import('../../lib/loadConditions').ConditionContent | undefined>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const raw = sections[key];
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (s) return s;
    }
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
      const s = raw[0].trim();
      if (s) return s;
    }
  }
  return undefined;
}

/** Section id -> Lucide icon for condition page */
const SECTION_ICONS: Record<string, LucideIcon> = {
  overview: ClipboardList,
  pathophysiology: Dna,
  clinicalPresentation: Stethoscope,
  diagnostics: Microscope,
  differentialDiagnosis: HelpCircle,
  management: Pill,
  complications: Zap,
  prognosis: TrendingUp,
  preventionEducation: GraduationCap,
  pearls: Target,
};

interface ContentSection extends ConditionSectionConfig {
  Icon?: LucideIcon;
  content?: import('../../lib/loadConditions').ConditionContent | null;
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(DEFAULT_EXPANDED_SECTION_IDS)
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // Derived state — declared BEFORE the useEffect blocks that depend on them
  const sections: ContentSection[] = useMemo(() => {
    if (!conditionContent?.sections) return [];

    const secs = conditionContent.sections;
    return CONDITION_SECTION_CONFIG.map((config) => {
      const content = mergeConditionContent(config.conditionEntryKeys.map((key) => secs[key]));
      return {
        ...config,
        Icon: SECTION_ICONS[config.id],
        content,
      };
    }).filter((section) => isMeaningfulContent(section.content));
  }, [conditionContent?.sections]);

  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);

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

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Clean display name (remove parentheses)
  const displayName = useMemo(() => {
    if (!conditionContent?.condition) return 'Condition not found';
    return conditionContent.condition.replace(/\s*\([^)]*\)/g, '').trim();
  }, [conditionContent?.condition]);

  const heroValues = useMemo(() => {
    const sec = conditionContent?.sections ?? {};
    return {
      goldStandard: getHeroValue(sec, ['gold_standard_dx', 'gold_standard']),
      bestInitialTest: getHeroValue(sec, ['best_initial_test']),
      firstLineRx: getHeroValue(sec, ['first_line_rx']),
      classicPatient: getHeroValue(sec, ['classic_patient']),
    };
  }, [conditionContent?.sections]);

  // IntersectionObserver: highlight TOC item for section in view (runs when sectionIds/sections exist)
  useEffect(() => {
    if (sectionIds.length === 0) return;
    const visibility = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id.replace(/^section-/, '');
          visibility.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        const visible = sectionIds.filter((id) => (visibility.get(id) ?? 0) > 0);
        const byRatio = [...visible].sort(
          (a, b) => (visibility.get(b) ?? 0) - (visibility.get(a) ?? 0)
        );
        setActiveSectionId(byRatio[0] ?? sectionIds[0]);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.1, 0.5, 1] }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(`section-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sectionIds]);

  // Keyboard: j = expand next section, k = expand previous (uses sectionIds, runs after sections exist)
  useEffect(() => {
    if (loading || error || sectionIds.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const currentIdx = activeSectionId ? sectionIds.indexOf(activeSectionId) : 0;
      const idx = currentIdx < 0 ? 0 : currentIdx;
      if (e.key === 'j') {
        const next = Math.min(idx + 1, sectionIds.length - 1);
        const id = sectionIds[next];
        setExpandedSections((prev) => new Set(prev).add(id));
        document
          .getElementById(`section-${id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const prev = Math.max(idx - 1, 0);
        const id = sectionIds[prev];
        setExpandedSections((prev) => new Set(prev).add(id));
        document
          .getElementById(`section-${id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, error, sectionIds, activeSectionId]);

  // Load condition content asynchronously
  useEffect(() => {
    let mounted = true;

    async function loadContent() {
      if (!conditionId) return;

      setLoading(true);
      setError(null);

      try {
        // Load metadata from registry
        const meta = await findConditionMetaById(conditionId);
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
      } catch (err) {
        logger.error('ConditionPage', 'Failed to load condition content', { conditionId, err });
        setError('Failed to load condition content. Please try again later.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadContent();

    return () => {
      mounted = false;
    };
  }, [conditionId, retryCount]);

  return (
    <main
      className="condition-page max-w-5xl mx-auto p-6 overflow-x-hidden"
      id="condition-page-main"
    >
      {/* Loading State - skeleton aligned with design system (slate-700/800) */}
      {loading && (
        <div className="condition-page-loading space-y-6 py-8">
          <div className="h-8 w-48 rounded-lg bg-[var(--color-data-neutral)]/50 dark:bg-[var(--color-data-neutral)] animate-pulse" />
          <div className="h-12 w-full max-w-2xl rounded-lg bg-[var(--color-data-neutral)]/50 dark:bg-[var(--color-data-neutral)] animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-[var(--color-data-neutral)]/50 dark:bg-[var(--color-data-neutral)] animate-pulse"
              />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 rounded-lg bg-[var(--color-data-neutral)]/50 dark:bg-[var(--color-data-neutral)] animate-pulse border border-[var(--color-border)]"
              />
            ))}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Loading condition content...</p>
        </div>
      )}

      {/* Error State - card boundary with retry */}
      {error && !loading && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Content Not Available
          </h2>
          <p className="text-[var(--color-text-muted)] mb-4">{error}</p>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-4 py-2 rounded-lg font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* Content - only show if not loading and no error */}
      {!loading && !error && (
        <>
          {/* Breadcrumb and back link */}
          <nav
            className="flex items-center gap-2 mb-6 text-sm text-[var(--color-text-muted)]"
            aria-label="Breadcrumb"
          >
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <span aria-hidden className="select-none">
              ·
            </span>
            <span>Clinical reference</span>
            <span aria-hidden className="select-none">
              ·
            </span>
            <span className="text-[var(--color-text-primary)] font-medium truncate max-w-[12rem] sm:max-w-none">
              {displayName}
            </span>
          </nav>

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

            <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
              {displayName}
            </h1>

            {conditionMeta?.aliases && conditionMeta.aliases.length > 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Also known as: {conditionMeta.aliases.join(', ')}
              </p>
            )}
          </header>

          {/* Key facts hero block (at-a-glance) */}
          {(heroValues.goldStandard ||
            heroValues.bestInitialTest ||
            heroValues.firstLineRx ||
            heroValues.classicPatient) && (
            <div className="mb-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {heroValues.goldStandard && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-[var(--color-data-provisional)]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-[var(--color-data-provisional)]" />
                      <span className="text-xs font-semibold text-[var(--color-data-provisional)] uppercase tracking-wide">
                        Gold Standard Dx
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {heroValues.goldStandard}
                    </p>
                  </div>
                )}
                {heroValues.firstLineRx && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-[var(--color-data-pass)]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Pill className="w-4 h-4 text-[var(--color-data-pass)]" />
                      <span className="text-xs font-semibold text-[var(--color-data-pass)] uppercase tracking-wide">
                        First-Line Rx
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {heroValues.firstLineRx}
                    </p>
                  </div>
                )}
                {heroValues.bestInitialTest && (
                  <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-2 mb-2">
                      <FlaskConical className="w-4 h-4 text-[var(--color-accent)]" />
                      <span className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wide">
                        Best Initial Test
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {heroValues.bestInitialTest}
                    </p>
                  </div>
                )}
              </div>
              {heroValues.classicPatient && (
                <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]">
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wide mb-1">
                        Classic Patient
                      </h4>
                      <p className="text-sm text-[var(--color-text-primary)] leading-relaxed italic">
                        &quot;{heroValues.classicPatient}&quot;
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <BuzzwordBanner conditionName={displayName} />

          {/* Smart Condition: structured cards (hide/reveal treatment, deep links, Firefly mnemonic) */}
          <section className="mb-8" aria-label="Structured learning map">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Learning map
            </h2>
            <ConditionStructuredCards
              conditionId={conditionId}
              getToken={getToken}
              onDeepLink={(term, type) => {
                const base = type === 'drug' ? '/reference/treatments' : '/reference/treatments';
                navigate(`${base}?q=${encodeURIComponent(term)}`);
              }}
            />
          </section>

          {/* Sticky TOC: side on large screens, horizontal "Jump to" on small */}
          {sections.length > 1 && (
            <>
              <div className="lg:hidden mb-4">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  Jump to section
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#section-${section.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(`section-${section.id}`)?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                      }}
                      aria-current={activeSectionId === section.id ? 'location' : undefined}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        activeSectionId === section.id
                          ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/50'
                      }`}
                    >
                      {section.title}
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Two-column layout on lg: TOC sidebar + main content to prevent overlap */}
          <div className={sections.length > 1 ? 'lg:flex lg:gap-8 lg:items-start' : ''}>
            {sections.length > 1 && (
              <aside
                className="hidden lg:block w-52 flex-shrink-0 sticky top-24"
                aria-label="Table of contents"
              >
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                  On this page
                </p>
                <p className="sr-only">Press j for next section, k for previous.</p>
                <nav className="space-y-1">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#section-${section.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(`section-${section.id}`)?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                      }}
                      aria-current={activeSectionId === section.id ? 'location' : undefined}
                      className={`block py-1.5 px-2 rounded-lg text-sm transition-colors border-l-2 ${
                        activeSectionId === section.id
                          ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)] font-medium'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] border-transparent hover:border-[var(--color-accent)]/50'
                      }`}
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </aside>
            )}

            <div className="min-w-0 flex-1">
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

              {/* Content sections: Expand all / Collapse all */}
              {sections.length === 0 && conditionContent && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-8 text-center">
                  <p className="text-[var(--color-text-muted)] text-sm">
                    Detailed section content is not yet available for this condition. Check back
                    soon as our clinical library is continuously updated.
                  </p>
                </div>
              )}
              {sections.length > 0 && (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setExpandedSections(new Set(sections.map((s) => s.id)))}
                      className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 rounded"
                    >
                      Expand all
                    </button>
                    <span className="text-[var(--color-border)]">|</span>
                    <button
                      type="button"
                      onClick={() => setExpandedSections(new Set())}
                      className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 rounded"
                    >
                      Collapse all
                    </button>
                  </div>
                  <div className="condition-sections space-y-4">

                    {sections.map((section, index) => (
                      <motion.section
                        key={section.id}
                        id={`section-${section.id}`}
                        initial={{ y: 10 }}
                        animate={{ y: 0 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0 }
                            : { duration: 0.25, delay: index * 0.04 }
                        }
                        className="bg-[var(--color-bg-secondary)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden"
                      >
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--color-bg-tertiary)] transition-colors rounded-xl"
                        >
                          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                            {section.Icon && (
                              <section.Icon className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
                            )}
                            <span>{section.title}</span>
                            {section.id === 'pearls' && (
                              <span className="ml-2 px-2 py-0.5 rounded-md text-xs font-semibold bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
                                High-yield
                              </span>
                            )}
                          </h3>
                          <svg
                            className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${
                              expandedSections.has(section.id) ? 'rotate-180' : ''
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
                          {expandedSections.has(section.id) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={
                                prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }
                              }
                              className="border-t border-[var(--color-border)]"
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

              {/* Past Mistakes - user's wrong answers for this condition */}
              <PastMistakesSection conditionId={conditionId} getToken={getToken} />

              {/* Key Differences - contrastive table vs confused conditions */}
              <KeyDifferencesTable
                conditionId={conditionId}
                conditionName={displayName}
                getToken={getToken}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default ConditionPage;
