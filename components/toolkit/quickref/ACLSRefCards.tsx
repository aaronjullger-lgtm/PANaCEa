/**
 * ACLSRefCards
 *
 * ACLS algorithm step cards grouped by algorithm name.
 * Each card shows: rhythm, intervention, drug dose, energy dose,
 * CPR guidance, critical actions, and clinical pearls.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Heart, Search, Star, Zap, Pill } from 'lucide-react';

interface ACLSStep {
  id: string;
  algorithmName: string;
  algorithmStep: number;
  category: string;
  rhythm: string;
  rhythmDescription: string | null;
  correctIntervention: string;
  drugDose: string | null;
  drugTiming: string | null;
  energyDose: string | null;
  cprGuidance: string | null;
  criticalActions: string[] | null;
  clinicalPearls: string[] | null;
  boardYieldFacts: string[] | null;
  isHighYield: boolean;
  ecgFindings: string[] | null;
}

export default function ACLSRefCards() {
  const { getToken } = useAuth();
  const [data, setData] = useState<ACLSStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        const token = await getToken();
        const res = await fetch('/api/reference/acls-algorithms', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json.data || []);
      } catch { /* handled by empty state */ }
      finally { if (!cancelled) setLoading(false); }
    }
    fetch_();
    return () => { cancelled = true; };
  }, [getToken]);

  const categories = useMemo(() => {
    const cats = new Set(data.map((s) => s.category).filter(Boolean));
    return ['all', ...Array.from(cats).sort()];
  }, [data]);

  // Group by algorithm name
  const grouped = useMemo(() => {
    const filtered = data.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.algorithmName.toLowerCase().includes(q) ||
          s.rhythm.toLowerCase().includes(q) ||
          s.correctIntervention.toLowerCase().includes(q);
      }
      return true;
    });
    const groups = new Map<string, ACLSStep[]>();
    for (const step of filtered) {
      const key = step.algorithmName;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(step);
    }
    // Sort steps within each group
    for (const steps of groups.values()) {
      steps.sort((a, b) => a.algorithmStep - b.algorithmStep);
    }
    return groups;
  }, [data, categoryFilter, searchQuery]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading ACLS algorithms...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <div style={{
          flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
        }}>
          <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <input type="text" placeholder="Search rhythms, interventions..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text-primary)' }} />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>
      </div>

      {/* Algorithm Groups */}
      {Array.from(grouped.entries()).map(([algoName, steps]) => (
        <div key={algoName} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Heart size={18} style={{ color: '#ef4444' }} />
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>{algoName}</h3>
            <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 9999, background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Step timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 12, borderLeft: '3px solid #fee2e2' }}>
            {steps.map((step) => {
              const isExpanded = expandedId === step.id;
              return (
                <motion.div key={step.id} layout
                  style={{ borderRadius: 12, border: '1px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-bg-primary, #fff)' }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : step.id)}
                    style={{ width: '100%', padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', width: 28, textAlign: 'center' }}>
                        {step.algorithmStep}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{step.rhythm}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-accent)', marginTop: 2 }}>{step.correctIntervention}</div>
                      </div>
                      {step.isHighYield && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, background: '#fbbf24', color: '#78350f' }}>HY</span>}
                    </div>
                    {/* Drug + Energy at a glance */}
                    {(step.drugDose || step.energyDose) && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, paddingLeft: 38 }}>
                        {step.drugDose && (
                          <span style={{ fontSize: 12, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Pill size={12} /> {step.drugDose}
                          </span>
                        )}
                        {step.energyDose && (
                          <span style={{ fontSize: 12, color: '#ea580c', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Zap size={12} /> {step.energyDose}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                  {isExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }}
                      style={{ borderTop: '1px solid var(--color-border)', padding: '12px 14px 12px 52px' }}>
                      {step.rhythmDescription && (
                        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 10px' }}>{step.rhythmDescription}</p>
                      )}
                      {step.cprGuidance && (
                        <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', fontSize: 13, color: '#991b1b' }}>
                          <strong>CPR:</strong> {step.cprGuidance}
                        </div>
                      )}
                      {step.criticalActions && step.criticalActions.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Critical Actions</div>
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {step.criticalActions.map((a, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{a}</li>)}
                          </ul>
                        </div>
                      )}
                      {step.ecgFindings && step.ecgFindings.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>ECG Findings</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {step.ecgFindings.map((f, i) => (
                              <span key={i} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>{f}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {step.clinicalPearls && step.clinicalPearls.length > 0 && (
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef9c3' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#854d0e', marginBottom: 4 }}>Pearls</div>
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {step.clinicalPearls.map((p, i) => <li key={i} style={{ fontSize: 12, color: '#854d0e', lineHeight: 1.5 }}>{p}</li>)}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {grouped.size === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No algorithms match your search.</div>
      )}
    </div>
  );
}
