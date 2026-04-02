/**
 * ReferenceHub.tsx
 *
 * Entry point for the Clinical Library — a grid of entity-type launchers
 * that open GenericReferenceView for each type. Integrates with the existing
 * KnowledgeBaseHub / ClinicalReferenceLibrary navigation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Library, Search, Star, X, ChevronRight, Clock, RefreshCw } from 'lucide-react';
import GenericReferenceView from './GenericReferenceView';
import type { ReferenceViewConfig } from './GenericReferenceView';
import {
  allReferenceConfigs,
  procedureConfig,
  imagingConfig,
  ecgConfig,
  anatomyConfig,
  specialTestConfig,
  physiologyConfig,
  findingsConfig,
  guidelinesConfig,
  historyConfig,
  labTestConfig,
  scoringSystemConfig,
} from './referenceConfigs';
import HighYieldSummary from './HighYieldSummary';

// ============================================================================
// ENTITY DESCRIPTIONS & COUNTS
// ============================================================================

const ENTITY_DESCRIPTIONS: Record<string, string> = {
  procedures: 'Clinical procedures with indications, technique, and complications',
  imaging: 'Imaging modalities with classic signs and interpretation tips',
  ecg: 'ECG rhythms with waveform criteria and acute management',
  anatomy: 'Anatomical structures with innervation, blood supply, and pathology',
  'special-tests': 'Orthopedic and neurologic special tests with sensitivity/specificity',
  physiology: 'Physiology concepts with mechanisms and feedback loops',
  findings: 'Physical exam findings with diagnostic accuracy and how-to-elicit',
  guidelines: 'Clinical guidelines and decision frameworks',
  'history-components': 'History-taking frameworks, ROS elements, and red flags',
  labs: 'Lab tests with reference ranges, critical values, and clinical interpretation',
  'scoring-systems': 'Clinical scoring systems with components, interpretation, and thresholds',
};

interface EntityCardProps {
  config: ReferenceViewConfig<any>;
  count: number | null;
  onClick: () => void;
}

const FONT_HEADING = "'Poppins', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

function EntityCard({ config, count, onClick }: EntityCardProps) {
  const Icon = config.icon;
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: 10, padding: 20, borderRadius: 14,
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-primary)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${config.accentColor}15`,
        }}>
          <Icon size={20} style={{ color: config.accentColor }} />
        </div>
        {count !== null && (
          <span style={{
            fontSize: 20, fontWeight: 800, color: config.accentColor, opacity: 0.7,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontVariantNumeric: 'tabular-nums',
          }}>
            {count}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)', fontFamily: FONT_HEADING }}>
          {config.entityName}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.5, fontFamily: FONT_BODY }}>
          {ENTITY_DESCRIPTIONS[config.entitySlug] || `Browse all ${config.entityName.toLowerCase()}`}
        </div>
      </div>
    </motion.button>
  );
}

import { normalizeApiItems } from '@/lib/utils/normalizeApiResponse';

/** Hook to fetch entity counts from all APIs */
function useEntityCounts(configs: readonly ReferenceViewConfig<any>[], token: string | null) {
  const [counts, setCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function fetchCounts() {
      const results = await Promise.allSettled(
        configs.map(async (config) => {
          const res = await fetch(config.apiEndpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return { slug: config.entitySlug, count: null };
          const json = await res.json();
          const arr = normalizeApiItems(json);
          return { slug: config.entitySlug, count: arr.length };
        })
      );

      if (cancelled) return;
      const newCounts: Record<string, number | null> = {};
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          newCounts[result.value.slug] = result.value.count;
        }
      }
      setCounts(newCounts);
    }

    fetchCounts();
    return () => { cancelled = true; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return counts;
}

// ============================================================================
// REFERENCE HUB
// ============================================================================

export default function ReferenceHub() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => { getToken().then(setToken).catch(() => setToken(null)); }, [getToken]);

  const entityCounts = useEntityCounts(allReferenceConfigs, token);

  const [showHighYield, setShowHighYield] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [recentEntities, setRecentEntities] = useState<string[]>([]);
  const [crossSearchResults, setCrossSearchResults] = useState<{ slug: string; items: any[] }[]>([]);
  const [crossSearching, setCrossSearching] = useState(false);

  // Cross-entity search (debounced, fires when query >= 3 chars)
  useEffect(() => {
    if (globalSearch.length < 3) {
      setCrossSearchResults([]);
      setCrossSearching(false);
      return;
    }
    setCrossSearching(true);
    const timer = setTimeout(async () => {
      const t = await getToken();
      if (!t) return;
      const promises = allReferenceConfigs.map(async (config) => {
        try {
          const sep = config.apiEndpoint.includes('?') ? '&' : '?';
          const url = `${config.apiEndpoint}${sep}query=${encodeURIComponent(globalSearch)}`;
          const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
          if (!res.ok) return { slug: config.entitySlug, items: [] };
          const json = await res.json();
          const arr = normalizeApiItems(json);
          return { slug: config.entitySlug, items: arr.slice(0, 5) };
        } catch {
          return { slug: config.entitySlug, items: [] };
        }
      });
      const results = await Promise.all(promises);
      setCrossSearchResults(results.filter((r) => r.items.length > 0));
      setCrossSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [globalSearch, getToken]);

  // Restore entity from URL param
  const entityFromUrl = searchParams.get('entity');
  const [activeConfig, setActiveConfig] = useState<ReferenceViewConfig<any> | null>(() => {
    if (entityFromUrl) {
      return (allReferenceConfigs.find((c) => c.entitySlug === entityFromUrl) as ReferenceViewConfig<any>) || null;
    }
    return null;
  });

  const handleSelectEntity = useCallback((config: ReferenceViewConfig<any>) => {
    setActiveConfig(config);
    setRecentEntities((prev) => {
      const filtered = prev.filter((s) => s !== config.entitySlug);
      return [config.entitySlug, ...filtered].slice(0, 5);
    });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('entity', config.entitySlug);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleBack = useCallback(() => {
    setActiveConfig(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('entity');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // High Yield Board view
  if (showHighYield) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="high-yield"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <HighYieldSummary onBack={() => setShowHighYield(false)} />
        </motion.div>
      </AnimatePresence>
    );
  }

  // If a specific entity type is selected, show its GenericReferenceView
  if (activeConfig) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeConfig.entitySlug}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <GenericReferenceView
            config={activeConfig}
            onBack={handleBack}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // Hub grid
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Library size={24} style={{ color: 'var(--color-text-primary)' }} />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: FONT_HEADING }}>
          Clinical Reference Library
        </h2>
      </div>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16, maxWidth: 600, lineHeight: 1.6, fontFamily: FONT_BODY }}>
        Browse, search, and study all clinical reference entities. Each section
        includes PANCE-focused study tools, high-yield filtering, and detailed cards.
      </p>

      {/* Global search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        borderRadius: 12, border: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)', marginBottom: 20,
      }}>
        <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
        <input
          type="text"
          placeholder="Search across all reference types... (jump to matching category)"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14, color: 'var(--color-text-primary)',
          }}
        />
        {globalSearch && (
          <button onClick={() => setGlobalSearch('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={14} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        )}
      </div>

      {/* Cross-entity search results */}
      {globalSearch.length >= 3 && (
        <div style={{ marginBottom: 20 }}>
          {crossSearching ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              <RefreshCw size={14} className="animate-spin" />
              Searching across all reference types...
            </div>
          ) : crossSearchResults.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {crossSearchResults.map(({ slug, items }) => {
                const cfg = allReferenceConfigs.find((c) => c.entitySlug === slug);
                if (!cfg) return null;
                const CfgIcon = cfg.icon;
                return (
                  <div key={slug} style={{ borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    <button
                      onClick={() => handleSelectEntity(cfg as ReferenceViewConfig<any>)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '10px 14px', border: 'none', background: 'var(--color-bg-secondary)',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <CfgIcon size={16} style={{ color: cfg.accentColor }} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', flex: 1 }}>
                        {cfg.entityName}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        {items.length}+ matches — View all
                      </span>
                      <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)' }} />
                    </button>
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {items.map((item: any) => (
                        <div key={cfg.getId(item)} style={{
                          padding: '6px 10px', borderRadius: 6,
                          background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                          fontSize: 13,
                        }}>
                          {cfg.cardRenderer(item, false)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 0' }}>
              No results found for "{globalSearch}" across reference types.
            </p>
          )}
        </div>
      )}

      {/* High Yield Board launcher */}
      <motion.button
        whileHover={{ scale: 1.01, y: -2 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setShowHighYield(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, width: '100%',
          padding: '16px 20px', borderRadius: 14, marginBottom: 20,
          border: '2px solid #f59e0b40', background: 'linear-gradient(135deg, #fef3c710, #fef3c730)',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <Star size={24} fill="#f59e0b" style={{ color: '#f59e0b' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)' }}>
            High-Yield Board
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            All high-yield items across every category — your PANCE power list
          </div>
        </div>
        <ChevronRight size={20} style={{ color: 'var(--color-text-secondary)' }} />
      </motion.button>

      {/* Recently visited */}
      {recentEntities.length > 0 && !globalSearch && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Clock size={14} style={{ color: 'var(--color-text-secondary)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Recently Visited
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {recentEntities.map((slug) => {
              const cfg = allReferenceConfigs.find((c) => c.entitySlug === slug);
              if (!cfg) return null;
              const CfgIcon = cfg.icon;
              return (
                <button
                  key={slug}
                  onClick={() => handleSelectEntity(cfg as ReferenceViewConfig<any>)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 9999,
                    border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
                  }}
                >
                  <CfgIcon size={14} style={{ color: cfg.accentColor }} />
                  {cfg.entityName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entity grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 14,
      }}>
        {allReferenceConfigs.filter((config) => {
          if (!globalSearch) return true;
          const q = globalSearch.toLowerCase();
          const desc = ENTITY_DESCRIPTIONS[config.entitySlug] || '';
          return (
            config.entityName.toLowerCase().includes(q) ||
            config.entitySlug.toLowerCase().includes(q) ||
            desc.toLowerCase().includes(q)
          );
        }).map((config) => (
          <EntityCard
            key={config.entitySlug}
            config={config}
            count={entityCounts[config.entitySlug] ?? null}
            onClick={() => handleSelectEntity(config as ReferenceViewConfig<any>)}
          />
        ))}
      </div>
    </div>
  );
}
