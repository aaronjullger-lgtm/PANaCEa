/**
 * Knowledge Base Hub - "The What"
 *
 * Consolidated medical reference: Condition Library, Pharmacopeia, Lab Reference.
 * Separates static knowledge from clinical utilities (calculators, generators).
 *
 * Architecture: 3-tab hub with persistent sidebar navigation (desktop) and mobile menu.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Pill, Beaker, Menu, X } from 'lucide-react';
import { NavRailProvider } from '@/contexts/NavRailContext';
import { ContextNavRail } from '@/components/layout/ContextNavRail';
import { ClinicalReferenceLibrary } from '@/components/library/ClinicalReferenceLibrary';
import { PharmacopeiaView } from './PharmacopeiaView';
import { LabReferenceView } from './LabReferenceView';

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

const KnowledgeBaseHubInternal: React.FC<KnowledgeBaseHubProps> = ({ onClose }) => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabFromUrl && VALID_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'conditions'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (tabFromUrl && VALID_TAB_IDS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  }, []);

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
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex-shrink-0">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <div className="p-4 border-b border-[var(--color-border)]">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-4 group w-full"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm">Dashboard</span>
            </button>
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-4 group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm">Dashboard</span>
              </button>
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
      <div className="flex-1 min-w-0 overflow-y-auto relative">
        <div className="p-6 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              {currentTab.label}
            </h1>
            <p className="text-[var(--color-text-muted)] mb-6">{currentTab.description}</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {activeTab === 'conditions' && (
              <motion.div
                key="conditions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ClinicalReferenceLibrary onExit={onClose} />
              </motion.div>
            )}

            {activeTab === 'pharmacopeia' && (
              <motion.div
                key="pharmacopeia"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <PharmacopeiaView />
              </motion.div>
            )}

            {activeTab === 'labs' && (
              <motion.div
                key="labs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <LabReferenceView />
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
