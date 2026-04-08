/**
 * HighYieldSummary.tsx
 *
 * Cross-entity High Yield Board — fetches all entity types and displays
 * only the high-yield items, grouped by entity type. Perfect for PANCE
 * review to see everything that matters across all reference categories.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Star, RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { ReferenceViewConfig } from './GenericReferenceView';
import { allReferenceConfigs } from './referenceConfigs';

import { normalizeApiItems } from '@/lib/utils/normalizeApiResponse';

interface EntityGroup {
  config: ReferenceViewConfig<any>;
  items: any[];
  loading: boolean;
}

interface HighYieldSummaryProps {
  onBack: () => void;
}

export default function HighYieldSummary({ onBack }: HighYieldSummaryProps) {
  const { getToken } = useAuth();
  const [groups, setGroups] = useState<EntityGroup[]>(
    allReferenceConfigs.map((c) => ({ config: c as ReferenceViewConfig<any>, items: [], loading: true }))
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      const token = await getToken();
      // Fetch all entity types in parallel with server-side highYield filter
      const promises = allReferenceConfigs.map(async (config) => {
        try {
          const sep = config.apiEndpoint.includes('?') ? '&' : '?';
          const url = `${config.apiEndpoint}${sep}highYield=true`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return { slug: config.entitySlug, items: [] as any[] };
          const json = await res.json();
          const arr = normalizeApiItems(json);
          // Client-side filter: safety net for endpoints where the model lacks isHighYield
          const highYield = config.isHighYield
            ? arr.filter((item: any) => config.isHighYield!(item))
            : arr.filter((item: any) => item.isHighYield);
          return { slug: config.entitySlug, items: highYield };
        } catch {
          return { slug: config.entitySlug, items: [] as any[] };
        }
      });

      const results = await Promise.all(promises);
      if (!cancelled) {
        setGroups((prev) =>
          prev.map((g) => {
            const match = results.find((r) => r.slug === g.config.entitySlug);
            return match ? { ...g, items: match.items, loading: false } : { ...g, loading: false };
          })
        );
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [getToken]);

  const totalHighYield = groups.reduce((sum, g) => sum + g.items.length, 0);
  const stillLoading = groups.some((g) => g.loading);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
          cursor: 'pointer', color: 'var(--color-text-primary)',
        }}>
          <ArrowLeft size={18} />
        </button>
        <Star size={24} style={{ color: 'var(--color-data-provisional)' }} fill="var(--color-data-provisional)" />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          High-Yield Board
        </h2>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 9999,
          background: '#fef3c7', color: '#92400e',
        }}>
          {stillLoading ? '...' : totalHighYield} items
        </span>
      </div>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        Every high-yield item across all reference categories — your PANCE power list.
      </p>

      {/* Expand / Collapse All */}
      {!stillLoading && totalHighYield > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => {
              const allSlugs = groups.filter((g) => g.items.length > 0).map((g) => g.config.entitySlug);
              setExpandedGroups(new Set(allSlugs));
            }}
            style={{
              fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
              cursor: 'pointer', color: 'var(--color-text-primary)',
            }}
          >
            Expand All
          </button>
          <button
            onClick={() => setExpandedGroups(new Set())}
            style={{
              fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
              cursor: 'pointer', color: 'var(--color-text-primary)',
            }}
          >
            Collapse All
          </button>
        </div>
      )}

      {/* Grouped sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.filter((group) => group.loading || group.items.length > 0).map((group) => {
          const Icon = group.config.icon;
          const isExpanded = expandedGroups.has(group.config.entitySlug);
          const count = group.items.length;

          return (
            <div key={group.config.entitySlug} style={{
              borderRadius: 12, border: '1px solid var(--color-border)',
              background: 'var(--color-bg-primary)', overflow: 'hidden',
            }}>
              <button
                onClick={() => setExpandedGroups((prev) => {
                  const next = new Set(prev);
                  if (isExpanded) next.delete(group.config.entitySlug);
                  else next.add(group.config.entitySlug);
                  return next;
                })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '14px 16px', border: 'none', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <Icon size={18} style={{ color: group.config.accentColor }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)', flex: 1 }}>
                  {group.config.entityName}
                </span>
                {group.loading ? (
                  <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} />
                ) : (
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                    background: count > 0 ? '#fef3c7' : 'var(--color-bg-secondary)',
                    color: count > 0 ? '#92400e' : 'var(--color-text-secondary)',
                  }}>
                    {count}
                  </span>
                )}
                <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                  <ChevronRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
                </motion.div>
              </button>

              <AnimatePresence>
                {isExpanded && count > 0 && (
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                        {group.items.map((item: any) => (
                          <div key={group.config.getId(item)} style={{
                            padding: '10px 12px', borderRadius: 8,
                            background: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                          }}>
                            {group.config.cardRenderer(item, false)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
