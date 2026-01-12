/**
 * LibrarySidebar - Hierarchical navigation for Clinical Reference Library
 * 
 * Features:
 * - Collapsible system tree with condition counts
 * - Subcategory navigation within each system
 * - High Yield Only toggle filter
 * - Sticky positioning for easy access
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, ChevronDown, Star, BookOpen, Search,
  Heart, Brain, Stethoscope, Activity, Bone, Eye, 
  Pill, Baby, Droplet, Shield, Dna, Wind, Beaker
} from 'lucide-react';

interface SystemData {
  id: string;
  label: string;
  count: number;
}

interface SubcategoryData {
  subcategory: string;
  count: number;
}

interface LibrarySidebarProps {
  systems: SystemData[];
  subcategories: Map<string, SubcategoryData[]>;
  activeSystem: string;
  activeSubcategory: string | null;
  highYieldOnly: boolean;
  onSystemSelect: (systemId: string) => void;
  onSubcategorySelect: (system: string, subcategory: string | null) => void;
  onHighYieldToggle: (enabled: boolean) => void;
  onSearch: (query: string) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

// System icons mapping
const SYSTEM_ICONS: Record<string, typeof Heart> = {
  'Cardiovascular': Heart,
  'Cardiology': Heart,
  'Neurological': Brain,
  'Neurology': Brain,
  'Pulmonary': Wind,
  'Pulmonology': Wind,
  'Gastrointestinal': Activity,
  'GI': Activity,
  'Musculoskeletal': Bone,
  'MSK': Bone,
  'EENT': Eye,
  'HEENT': Eye,
  'Ophthalmology': Eye,
  'Endocrine': Dna,
  'Endocrinology': Dna,
  'Renal': Droplet,
  'Nephrology': Droplet,
  'Genitourinary': Droplet,
  'Hematology': Beaker,
  'Oncology': Beaker,
  'Infectious Disease': Shield,
  'Dermatology': Stethoscope,
  'Psychiatry': Brain,
  'Reproductive': Baby,
  'OB/GYN': Baby,
  'Pediatrics': Baby,
  'Rheumatology': Bone,
  'Emergency Medicine': Activity,
};

const getSystemIcon = (system: string) => {
  for (const [key, Icon] of Object.entries(SYSTEM_ICONS)) {
    if (system.toLowerCase().includes(key.toLowerCase())) {
      return Icon;
    }
  }
  return BookOpen;
};

/**
 * SystemTreeItem - Expandable system with subcategories
 */
const SystemTreeItem: React.FC<{
  system: SystemData;
  subcategories: SubcategoryData[];
  isActive: boolean;
  activeSubcategory: string | null;
  onSelect: () => void;
  onSubcategorySelect: (subcategory: string | null) => void;
}> = ({ system, subcategories, isActive, activeSubcategory, onSelect, onSubcategorySelect }) => {
  const [isExpanded, setIsExpanded] = useState(isActive);
  const Icon = getSystemIcon(system.label);

  // Auto-expand when system becomes active
  React.useEffect(() => {
    if (isActive) setIsExpanded(true);
  }, [isActive]);

  const handleSystemClick = () => {
    if (isActive) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect();
      setIsExpanded(true);
    }
  };

  return (
    <div className="mb-1">
      {/* System Header */}
      <button
        onClick={handleSystemClick}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200
          ${isActive 
            ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30' 
            : 'hover:bg-[var(--color-bg-secondary)]/80 text-[var(--color-text-secondary)] border border-transparent'
          }
        `}
      >
        {subcategories.length > 0 ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )
        ) : (
          <span className="w-4" />
        )}
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`} />
        <span className="flex-1 text-sm font-medium truncate">{system.label}</span>
        <span className={`
          text-xs px-1.5 py-0.5 rounded-full
          ${isActive 
            ? 'bg-[var(--color-accent)]/30 text-[var(--color-accent)]' 
            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
          }
        `}>
          {system.count}
        </span>
      </button>

      {/* Subcategories */}
      <AnimatePresence>
        {isExpanded && subcategories.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-9 py-1 space-y-0.5">
              {/* "All" option for this system */}
              <button
                onClick={() => onSubcategorySelect(null)}
                className={`
                  w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors
                  ${activeSubcategory === null && isActive
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/50'
                  }
                `}
              >
                All {system.label}
              </button>
              
              {/* Individual subcategories */}
              {subcategories.map(sub => (
                <button
                  key={sub.subcategory}
                  onClick={() => onSubcategorySelect(sub.subcategory)}
                  className={`
                    w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between
                    ${activeSubcategory === sub.subcategory && isActive
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/50'
                    }
                  `}
                >
                  <span className="truncate">{sub.subcategory}</span>
                  <span className="text-[10px] opacity-70">{sub.count}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * LibrarySidebar - Main component
 */
export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  systems,
  subcategories,
  activeSystem,
  activeSubcategory,
  highYieldOnly,
  onSystemSelect,
  onSubcategorySelect,
  onHighYieldToggle,
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value);
  };

  const totalConditions = useMemo(() => 
    systems.reduce((sum, s) => sum + s.count, 0),
  [systems]);

  return (
    <div className="w-64 flex-shrink-0 bg-[var(--color-bg-primary)] border-r border-[var(--color-border)] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <h2 
          className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2"
          style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
        >
          <BookOpen className="w-5 h-5 text-[var(--color-accent)]" />
          Reference Library
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          {totalConditions} conditions
        </p>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-[var(--color-border)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search conditions..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
          />
        </div>
      </div>

      {/* High Yield Toggle */}
      <div className="p-3 border-b border-[var(--color-border)]">
        <button
          onClick={() => onHighYieldToggle(!highYieldOnly)}
          className={`
            w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200
            ${highYieldOnly
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
              : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-amber-500/30'
            }
          `}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Star className={`w-4 h-4 ${highYieldOnly ? 'fill-amber-400' : ''}`} />
            High Yield Only
          </span>
          <div className={`
            w-8 h-5 rounded-full transition-colors relative
            ${highYieldOnly ? 'bg-amber-500' : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]'}
          `}>
            <div className={`
              absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform
              ${highYieldOnly ? 'translate-x-3.5' : 'translate-x-0.5'}
            `} />
          </div>
        </button>
      </div>

      {/* System Tree */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* All Systems Option */}
        <button
          onClick={() => onSystemSelect('all')}
          className={`
            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200
            ${activeSystem === 'all'
              ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
              : 'hover:bg-[var(--color-bg-secondary)]/80 text-[var(--color-text-secondary)] border border-transparent'
            }
          `}
        >
          <BookOpen className="w-4 h-4" />
          <span className="flex-1 text-sm font-medium">All Systems</span>
          <span className={`
            text-xs px-1.5 py-0.5 rounded-full
            ${activeSystem === 'all'
              ? 'bg-[var(--color-accent)]/30 text-[var(--color-accent)]'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
            }
          `}>
            {totalConditions}
          </span>
        </button>

        {/* Divider */}
        <div className="h-px bg-[var(--color-border)] my-2" />

        {/* Individual Systems */}
        {systems.filter(s => s.id !== 'all').map(system => (
          <SystemTreeItem
            key={system.id}
            system={system}
            subcategories={subcategories.get(system.id) || []}
            isActive={activeSystem === system.id}
            activeSubcategory={activeSystem === system.id ? activeSubcategory : null}
            onSelect={() => onSystemSelect(system.id)}
            onSubcategorySelect={(sub) => onSubcategorySelect(system.id, sub)}
          />
        ))}
      </div>

      {/* Keyboard Hint */}
      <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Press <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-[10px]">/</kbd> to search
        </p>
      </div>
    </div>
  );
};

export default LibrarySidebar;
