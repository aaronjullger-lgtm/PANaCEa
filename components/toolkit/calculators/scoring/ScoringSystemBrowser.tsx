/**
 * ScoringSystemBrowser
 *
 * Browsable grid of all scoring systems from the database.
 * Supports search, category filtering, and high-yield toggle.
 * Selecting a system opens the DynamicScoringCalculator.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Calculator,
  Filter,
  Search,
  Star,
  Stethoscope,
  TrendingUp,
} from 'lucide-react';
import DynamicScoringCalculator from './DynamicScoringCalculator';

// ============================================================================
// TYPES
// ============================================================================

interface ScoringSystemSummary {
  id: string;
  name: string;
  displayName: string | null;
  category: string;
  condition: string | null;
  panceYield: number | null;
  isHighYield: boolean;
  maxScore: number | null;
  sensitivity: number | null;
  specificity: number | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ScoringSystemBrowser({ onBack }: { onBack?: () => void }) {
  const { getToken } = useAuth();

  const [systems, setSystems] = useState<ScoringSystemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [highYieldOnly, setHighYieldOnly] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  // ---- Fetch all scoring systems ----
  useEffect(() => {
    let cancelled = false;
    async function fetchSystems() {
      try {
        setLoading(true);
        const token = await getToken();
        const res = await fetch('/api/reference/scoring-systems', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: any = await res.json();
        if (!cancelled) setSystems(json.data || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSystems();
    return () => { cancelled = true; };
  }, [getToken]);

  // ---- Derived data ----
  const categories = useMemo(() => {
    const cats = new Set(systems.map((s) => s.category));
    return ['all', ...Array.from(cats).sort()];
  }, [systems]);

  const filtered = useMemo(() => {
    return systems.filter((s) => {
      if (highYieldOnly && !s.isHighYield) return false;
      if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          s.name.toLowerCase().includes(q) ||
          (s.displayName?.toLowerCase().includes(q) ?? false) ||
          (s.condition?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      return true;
    });
  }, [systems, highYieldOnly, selectedCategory, searchQuery]);

  // ---- If a system is selected, show the calculator ----
  if (selectedSystemId) {
    return (
      <div>
        <button
          onClick={() => setSelectedSystemId(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', margin: '0 16px 16px',
            borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)', cursor: 'pointer',
            color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} /> All Scoring Systems
        </button>
        <DynamicScoringCalculator
          scoringSystemId={selectedSystemId}
          onBack={() => setSelectedSystemId(null)}
        />
      </div>
    );
  }

  // ---- Loading / Error ----
  if (loading) {
    return (
      <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: 'var(--color-text-secondary)' }}>
        Loading scoring systems...
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" style={{ padding: 40, textAlign: 'center', color: 'var(--color-data-fail)' }}>
        Failed to load scoring systems: {error}
      </div>
    );
  }

  // ---- BROWSER VIEW ----
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Calculator size={24} style={{ color: 'var(--color-accent)' }} />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Scoring Systems
        </h2>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 9999,
          background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
        }}>
          {filtered.length} of {systems.length}
        </span>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {/* Search */}
        <div style={{
          flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}>
          <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <input
            type="text"
            placeholder="Search scoring systems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)', fontSize: 13,
            color: 'var(--color-text-primary)', cursor: 'pointer',
          }}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>

        {/* High Yield toggle */}
        <button
          onClick={() => setHighYieldOnly(!highYieldOnly)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            border: highYieldOnly ? '2px solid var(--color-category-knowledge)' : '1px solid var(--color-border)',
            background: highYieldOnly ? 'color-mix(in srgb, var(--color-category-knowledge) 15%, var(--color-bg-primary))' : 'var(--color-bg-secondary)',
            color: highYieldOnly ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          <Star size={14} fill={highYieldOnly ? 'var(--color-category-knowledge)' : 'none'} />
          High Yield
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          No scoring systems match your filters.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {filtered.map((system) => (
            <motion.button
              key={system.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedSystemId(system.id)}
              style={{
                padding: '16px', borderRadius: 14, textAlign: 'left',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary, #fff)',
                cursor: 'pointer', width: '100%',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              {/* Top row: name + badges */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <Stethoscope size={18} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                    {system.name}
                  </div>
                  {system.condition && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {system.condition}
                    </div>
                  )}
                </div>
                {system.isHighYield && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999, background: 'var(--color-data-provisional)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                    HY
                  </span>
                )}
              </div>

              {/* Category + score range */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 9999,
                  background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
                }}>
                  {system.category}
                </span>
                {system.maxScore != null && (
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 9999,
                    background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
                  }}>
                    Max: {system.maxScore}
                  </span>
                )}
                {system.sensitivity != null && (
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 9999,
                    background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
                  }}>
                    Sn: {system.sensitivity}%
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
