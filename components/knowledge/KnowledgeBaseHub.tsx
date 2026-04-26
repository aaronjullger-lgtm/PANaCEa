/**
 * Knowledge Base Hub - premium workspace wrapper for PANaCEa reference tools.
 *
 * Keeps the underlying clinical reference views intact while aligning this
 * surface with the shared authenticated workspace design language.
 */

import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Beaker,
  BookOpen,
  Library,
  Pill,
  Search,
  Sparkles,
  Stethoscope,
  X,
  type LucideIcon,
} from 'lucide-react';
import { LabReferenceView } from './LabReferenceView';
import { NormalLabsLibraryView } from './NormalLabsLibraryView';
import { PharmacopeiaView } from './PharmacopeiaView';
import ReferenceHub from '@/components/library/ReferenceHub';
import {
  WorkspaceFilterBar,
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';

// Lazy-load ClinicalReferenceLibrary to break circular chunk initialization (TDZ crash)
const ClinicalReferenceLibrary = lazy(() =>
  import('@/components/library/ClinicalReferenceLibrary').then((m) => ({
    default: m.ClinicalReferenceLibrary,
  }))
);

interface KnowledgeBaseHubProps {
  onClose: () => void;
}

type TabId = 'conditions' | 'pharmacopeia' | 'labs' | 'reference';
type LabSubTab = 'tests' | 'normal-ranges';

interface NavTab {
  id: TabId;
  label: string;
  icon: LucideIcon;
  description: string;
  usage: string;
}

const NAV_TABS: NavTab[] = [
  {
    id: 'conditions',
    label: 'Conditions',
    icon: BookOpen,
    description: 'PANCE-ready condition pages with diagnosis, tests, treatment, traps, and related practice.',
    usage: 'Use this lane when a missed question needs an illness script, differential, or next-step repair.',
  },
  {
    id: 'pharmacopeia',
    label: 'Pharmacology',
    icon: Pill,
    description: 'Drug reference with mechanisms, indications, and interactions.',
    usage: 'Use this lane to anchor therapeutics, class effects, adverse effects, and medication recall.',
  },
  {
    id: 'labs',
    label: 'Labs',
    icon: Beaker,
    description: 'Normal values, clinical patterns, first-pass interpretation, and diagnostic context.',
    usage: 'Reach here when a lab question needs range context or pattern recognition.',
  },
  {
    id: 'reference',
    label: 'Procedures & Imaging',
    icon: Library,
    description: 'Procedures, imaging, ECG, anatomy, special tests, and clinical frameworks.',
    usage: 'Use the broader library for modalities, maneuvers, and clinical frameworks.',
  },
];

const TAB_ACCENTS: Record<TabId, string> = {
  conditions: '#728ba6',
  pharmacopeia: '#c4b78a',
  labs: '#7a8f6e',
  reference: '#9a7f9a',
};

const LAB_SUB_TABS: Array<{
  id: LabSubTab;
  label: string;
  description: string;
}> = [
  {
    id: 'tests',
    label: 'Lab Tests',
    description: 'Clinical differentials and board-yield interpretation.',
  },
  {
    id: 'normal-ranges',
    label: 'Normal Ranges',
    description: 'Reference intervals and quick range lookup.',
  },
];

const VALID_TAB_IDS: TabId[] = ['conditions', 'pharmacopeia', 'labs', 'reference'];
const VALID_LAB_SUB: LabSubTab[] = ['tests', 'normal-ranges'];

function KnowledgeTabButton({
  tab,
  active,
  onClick,
}: {
  tab: NavTab;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  const accent = TAB_ACCENTS[tab.id];

  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[13rem] rounded-[1.2rem] border px-4 py-3 text-left transition-all duration-300"
      style={{
        background: active
          ? `linear-gradient(145deg, color-mix(in srgb, ${accent} 16%, var(--color-bg-secondary)), color-mix(in srgb, var(--color-bg-primary) 88%, ${accent} 12%))`
          : 'color-mix(in srgb, var(--color-bg-secondary) 76%, var(--color-bg-primary) 24%)',
        borderColor: active
          ? `color-mix(in srgb, ${accent} 48%, var(--color-text-primary))`
          : 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
        boxShadow: active ? `0 20px 40px -30px ${accent}` : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl border"
          style={{
            background: `color-mix(in srgb, ${accent} 14%, var(--color-bg-secondary))`,
            borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
          }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: accent }} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <div
            className="text-sm font-semibold tracking-[-0.02em]"
            style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
          >
            {tab.label}
          </div>
          <p className="text-xs leading-5 text-[var(--color-text-muted)]">{tab.description}</p>
        </div>
      </div>
    </button>
  );
}

function LabSubButton({
  tab,
  active,
  onClick,
}: {
  tab: (typeof LAB_SUB_TABS)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-300"
      style={{
        background: active
          ? 'color-mix(in srgb, var(--color-data-ready) 16%, var(--color-bg-secondary))'
          : 'color-mix(in srgb, var(--color-bg-tertiary) 74%, var(--color-bg-primary) 26%)',
        borderColor: active
          ? 'color-mix(in srgb, var(--color-data-ready) 34%, transparent)'
          : 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
        color: active ? 'var(--color-data-ready)' : 'var(--color-text-secondary)',
      }}
    >
      {tab.label}
    </button>
  );
}

export const KnowledgeBaseHub: React.FC<KnowledgeBaseHubProps> = ({ onClose }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabId | null;
  const labSubFromUrl = searchParams.get('labSub') as LabSubTab | null;
  const queryFromUrl = searchParams.get('q') ?? '';
  const [activeTab, setActiveTab] = useState<TabId>(
    tabFromUrl && VALID_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'conditions'
  );
  const [workspaceSearch, setWorkspaceSearch] = useState(queryFromUrl);
  const [labSubTab, setLabSubTab] = useState<LabSubTab>(() =>
    tabFromUrl === 'labs' && labSubFromUrl && VALID_LAB_SUB.includes(labSubFromUrl)
      ? labSubFromUrl
      : 'tests'
  );

  useEffect(() => {
    if (tabFromUrl && VALID_TAB_IDS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (activeTab === 'labs' && labSubFromUrl && VALID_LAB_SUB.includes(labSubFromUrl)) {
      setLabSubTab(labSubFromUrl);
    }
  }, [activeTab, labSubFromUrl]);

  useEffect(() => {
    setWorkspaceSearch(queryFromUrl);
  }, [queryFromUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleTabChange = useCallback(
    (tabId: TabId) => {
      setActiveTab(tabId);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tabId === 'conditions') {
            next.delete('tab');
          } else {
            next.set('tab', tabId);
          }
          if (tabId !== 'labs') {
            next.delete('labSub');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleLabSubTabChange = useCallback(
    (sub: LabSubTab) => {
      setLabSubTab(sub);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (sub === 'tests') {
            next.delete('labSub');
          } else {
            next.set('labSub', sub);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleWorkspaceSearch = useCallback(
    (value: string) => {
      setWorkspaceSearch(value);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const trimmed = value.trim();
          if (trimmed) {
            next.set('q', trimmed);
          } else {
            next.delete('q');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const currentTab = NAV_TABS.find((tab) => tab.id === activeTab) ?? NAV_TABS[0];
  if (!currentTab) {
    return null;
  }
  const currentAccent = TAB_ACCENTS[currentTab.id];
  const quickSwitchTabs = NAV_TABS.filter((tab) => tab.id !== currentTab.id).slice(0, 2);
  const quickSwitchTabA = quickSwitchTabs[0];
  const quickSwitchTabB = quickSwitchTabs[1];

  return (
    <WorkspacePage density="wide" mode="reference">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Clinical Knowledge Workspace',
            badgeTone: 'steel',
            title: 'Clinical Knowledge Workspace',
            subtitle:
              'Search conditions, drugs, labs, procedures, and imaging without leaving the study flow.',
            status: currentTab.label,
            actionPosition: 'under-title',
            backLabel: 'Back to Study',
            onBack: onClose,
            primaryAction: quickSwitchTabA
              ? {
                  label: `Open ${quickSwitchTabA.label}`,
                  onClick: () => handleTabChange(quickSwitchTabA.id),
                }
              : undefined,
            secondaryActions: quickSwitchTabB
              ? [
                  {
                    label: quickSwitchTabB.label,
                    onClick: () => handleTabChange(quickSwitchTabB.id),
                  },
                ]
              : undefined,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <WorkspaceFilterBar>
          <div className="space-y-4">
            <div
              className="flex items-center gap-3 rounded-2xl border px-4 py-3"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-accent) 24%, var(--color-border))',
                background:
                  'color-mix(in srgb, var(--color-surface) 88%, var(--color-accent) 12%)',
              }}
            >
              <Search className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
              <input
                type="search"
                value={workspaceSearch}
                onChange={(event) => handleWorkspaceSearch(event.target.value)}
                placeholder="Search conditions, drugs, labs, procedures..."
                aria-label="Search conditions, drugs, labs, procedures"
                className="min-h-[44px] flex-1 bg-transparent text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
              />
              {workspaceSearch ? (
                <button
                  type="button"
                  onClick={() => handleWorkspaceSearch('')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                  aria-label="Clear knowledge search"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1.5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Study lanes
                </p>
                <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  Choose the lane that matches the clinical task: condition repair, medication recall,
                  lab interpretation, or procedure and imaging context.
                </p>
              </div>
              <div
                className="rounded-full border px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)]"
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                  background:
                    'color-mix(in srgb, var(--color-bg-secondary) 74%, var(--color-bg-primary) 26%)',
                }}
              >
                {currentTab.label}
              </div>
            </div>

            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {NAV_TABS.map((tab) => (
                <KnowledgeTabButton
                  key={tab.id}
                  tab={tab}
                  active={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                />
              ))}
            </div>

            {activeTab === 'labs' ? (
              <div className="flex flex-wrap gap-2">
                {LAB_SUB_TABS.map((tab) => (
                  <LabSubButton
                    key={tab.id}
                    tab={tab}
                    active={labSubTab === tab.id}
                    onClick={() => handleLabSubTabChange(tab.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </WorkspaceFilterBar>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip tone="reference">
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-secondary)]">
                Active lane
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                {currentTab.label} keeps reference work connected to practice.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                {currentTab.usage}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {NAV_TABS.map((tab) => {
                const Icon = tab.icon;
                const accent = TAB_ACCENTS[tab.id];
                return (
                  <div
                    key={tab.id}
                    className="rounded-[1.25rem] border p-4"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                      background:
                        'color-mix(in srgb, var(--color-bg-secondary) 78%, var(--color-bg-primary) 22%)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                        style={{
                          background: `color-mix(in srgb, ${accent} 14%, var(--color-bg-secondary))`,
                          borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                        }}
                      >
                        <Icon className="h-4.5 w-4.5" style={{ color: accent }} aria-hidden="true" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {tab.label}
                        </p>
                        <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                          {tab.usage}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title={currentTab.label}
          subtitle={
            activeTab === 'labs'
              ? `${currentTab.description} ${LAB_SUB_TABS.find((tab) => tab.id === labSubTab)?.description ?? ''}`
              : currentTab.description
          }
          action={
            activeTab === 'labs' ? (
              <span
                className="rounded-full border px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]"
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                  background:
                    'color-mix(in srgb, var(--color-bg-secondary) 74%, var(--color-bg-primary) 26%)',
                }}
              >
                {LAB_SUB_TABS.find((tab) => tab.id === labSubTab)?.label}
              </span>
            ) : (
              <span
                className="rounded-full border px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]"
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                  background:
                    'color-mix(in srgb, var(--color-bg-secondary) 74%, var(--color-bg-primary) 26%)',
                }}
              >
                Ready for deep review
              </span>
            )
          }
        >
          <AnimatePresence mode="wait">
            {activeTab === 'conditions' ? (
              <motion.div
                key="conditions"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <Suspense
                  fallback={
                    <WorkspaceSurface accent={currentAccent}>
                      <div className="flex items-center justify-center py-14 text-sm text-[var(--color-text-muted)]">
                        Loading clinical library...
                      </div>
                    </WorkspaceSurface>
                  }
                >
                  <ClinicalReferenceLibrary onExit={onClose} />
                </Suspense>
              </motion.div>
            ) : null}

            {activeTab === 'pharmacopeia' ? (
              <motion.div
                key="pharmacopeia"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <WorkspaceSurface accent={currentAccent}>
                  <PharmacopeiaView />
                </WorkspaceSurface>
              </motion.div>
            ) : null}

            {activeTab === 'labs' ? (
              <motion.div
                key={`labs-${labSubTab}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <WorkspaceSurface accent={currentAccent}>
                  {labSubTab === 'tests' ? <LabReferenceView /> : <NormalLabsLibraryView />}
                </WorkspaceSurface>
              </motion.div>
            ) : null}

            {activeTab === 'reference' ? (
              <motion.div
                key="reference"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <ReferenceHub />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <div className="grid gap-4 md:grid-cols-2">
          <WorkspaceMetricCard
            label="Active lane"
            value={currentTab.label}
            detail={currentTab.description}
            accent={currentAccent}
            icon={currentTab.icon}
            variant="reference"
          />
          <WorkspaceMetricCard
            label="Study posture"
            value="Reference first"
            detail="Use this surface to anchor context, compare options, and then return to practice with a cleaner mental model."
            accent="#b39b6c"
            icon={Sparkles}
            variant="guidance"
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.2}>
        <WorkspaceSurface accent="#728ba6" role="subtle">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Daily use</p>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Keep this workspace open during review and missed-question analysis so reference
                work behaves like part of the workflow instead of a detour.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTabChange('conditions')}
              className="inline-flex min-h-[42px] items-center justify-center rounded-full border px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-all duration-300 hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-bg-tertiary)]"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                background:
                  'color-mix(in srgb, var(--color-bg-secondary) 74%, var(--color-bg-primary) 26%)',
              }}
            >
              Reset to Condition Library
            </button>
          </div>
        </WorkspaceSurface>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};
