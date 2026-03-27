/**
 * Knowledge Base Hub - "The What"
 *
 * Consolidated medical reference: Condition Library, Pharmacopeia, Lab Reference.
 * Separates static knowledge from clinical utilities (calculators, generators).
 *
 * Architecture: 3-tab hub with persistent sidebar navigation (desktop) and mobile menu.
 */

import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Pill, Beaker, Menu, X } from 'lucide-react';
import { BackLink } from '@/components/navigation/BackLink';
import { ROUTES } from '@/config/routes';
import { NavRailProvider } from '@/contexts/NavRailContext';
import { ContextNavRail } from '@/components/layout/ContextNavRail';
import { PharmacopeiaView } from './PharmacopeiaView';
import { LabReferenceView } from './LabReferenceView';
import { NormalLabsLibraryView } from './NormalLabsLibraryView';

// Lazy-load ClinicalReferenceLibrary to break circular chunk initialization (TDZ crash)
const ClinicalReferenceLibrary = lazy(() =>
  import('@/components/library/ClinicalReferenceLibrary').then((m) => ({
    default: m.ClinicalReferenceLibrary,
  }))
);

interface KnowledgeBaseHubProps {
  onClose: () => void;
}

type TabId = 'conditions' | 'pharmacopeia' | 'labs';

interface NavTab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_TABS: NavTab[] = [
  {
    id: 'conditions',
    label: 'Condition Library',
    icon: BookOpen,
    description: 'Diseases and conditions organized by organ system',
  },
  {
    id: 'pharmacopeia',
    label: 'Pharmacopeia',
    icon: Pill,
    description: 'Drug reference with mechanisms, indications, and interactions',
  },
  {
    id: 'labs',
    label: 'Lab Reference',
    icon: Beaker,
    description: 'Normal values, clinical differentials, and interpretation',
  },
];

interface SidebarNavButtonProps {
  tab: NavTab;
  isActive: boolean;
  onClick: () => void;
  variant: 'desktop' | 'mobile';
}

const SidebarNavButton: React.FC<SidebarNavButtonProps> = ({ tab, isActive, onClick, variant }) => {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-all group ${
        isActive
          ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 shadow-sm'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] border border-transparent'
      } ${variant === 'mobile' ? 'text-base' : 'text-sm'}`}
    >
      <Icon
        className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:text-[var(--color-accent)]'}`}
      />
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${isActive ? 'font-semibold' : ''}`}>{tab.label}</div>
        {variant === 'mobile' && (
          <div className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
            {tab.description}
          </div>
        )}
      </div>
    </button>
  );
};

const VALID_TAB_IDS: TabId[] = ['conditions', 'pharmacopeia', 'labs'];

type LabSubTab = 'tests' | 'normal-ranges';

const VALID_LAB_SUB: LabSubTab[] = ['tests', 'normal-ranges'];

const KnowledgeBaseHubInternal: React.FC<KnowledgeBaseHubProps> = ({ onClose }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabId | null;
  const labSubFromUrl = searchParams.get('labSub') as LabSubTab | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabFromUrl && VALID_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'conditions'
  );
  const [labSubTab, setLabSubTab] = useState<LabSubTab>(() =>
    tabFromUrl === 'labs' && labSubFromUrl && VALID_LAB_SUB.includes(labSubFromUrl)
      ? labSubFromUrl
      : 'tests'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  }, []);

  const handleLabSubTabChange = useCallback(
    (sub: LabSubTab) => {
      setLabSubTab(sub);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (sub === 'tests') {
          next.delete('labSub');
        } else {
          next.set('labSub', sub);
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sidebarOpen) {
          setSidebarOpen(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen, onClose]);

  const currentTab = NAV_TABS.find((t) => t.id === activeTab) ?? NAV_TABS[0]!;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex min-w-0 flex-1 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] overflow-y-auto overflow-x-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <BackLink to={ROUTES.STUDY} className="mb-4 w-full justify-start" />
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Knowledge Base</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Medical Reference</p>
          </div>

          <nav className="p-2">
            {NAV_TABS.map((tab) => (
              <SidebarNavButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={() => handleTabChange(tab.id)}
                variant="desktop"
              />
            ))}
          </nav>
      </div>

      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-lg"
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={false}
            animate={{}}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-[var(--color-overlay)] z-40"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Panel */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] z-50 overflow-y-auto shadow-2xl"
          >
            <div className="p-4 border-b border-[var(--color-border)]">
              <BackLink to={ROUTES.STUDY} className="mb-4" />
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Knowledge Base</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Medical Reference</p>
            </div>
            <nav className="p-2">
              {NAV_TABS.map((tab) => (
                <SidebarNavButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  variant="mobile"
                />
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden relative">
        <div className="p-6 max-w-7xl mx-auto">
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }}>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              {currentTab.label}
            </h1>
            <p className="text-[var(--color-text-muted)] mb-6">{currentTab.description}</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {activeTab === 'conditions' && (
              <motion.div
                key="conditions"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" /></div>}>
                  <ClinicalReferenceLibrary onExit={onClose} />
                </Suspense>
              </motion.div>
            )}

            {activeTab === 'pharmacopeia' && (
              <motion.div
                key="pharmacopeia"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <PharmacopeiaView />
              </motion.div>
            )}

            {activeTab === 'labs' && (
              <motion.div
                key="labs"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex gap-2 border-b border-[var(--color-border)] pb-4">
                  <button
                    onClick={() => handleLabSubTabChange('tests')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      labSubTab === 'tests'
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    Lab Tests
                  </button>
                  <button
                    onClick={() => handleLabSubTabChange('normal-ranges')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      labSubTab === 'normal-ranges'
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    Normal Ranges
                  </button>
                </div>
                {labSubTab === 'tests' ? <LabReferenceView /> : <NormalLabsLibraryView />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <ContextNavRail />
    </div>
  );
};

export const KnowledgeBaseHub: React.FC<KnowledgeBaseHubProps> = (props) => (
  <NavRailProvider>
    <KnowledgeBaseHubInternal {...props} />
  </NavRailProvider>
);
