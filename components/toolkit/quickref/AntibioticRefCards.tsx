/**
 * AntibioticRefCards
 *
 * Browsable antibiotic guide cards organized by gram stain and organism class.
 * Each card shows organism, gram stain, first-line antibiotics, resistance,
 * common infections, and clinical pearls — optimized for bedside reference.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Bug, Search, Star, Shield, AlertTriangle } from 'lucide-react';
import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

const FONT_HEADING = "'Poppins', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

interface AntibioticGuideline {
  id: string;
  organism: string;
  class: string;
  gramStain: string;
  morphology: string | null;
  firstLineAntibiotics: string[] | null;
  alternativeAntibiotics: string[] | null;
  commonInfections: string[] | null;
  resistanceMechanisms: string[] | null;
  clinicalPearls: string[] | null;
  boardYieldFacts: string[] | null;
  isHighYield: boolean;
  classicPresentation: string | null;
  treatmentDuration: string | null;
}

export default function AntibioticRefCards() {
  const { getToken } = useAuth();
  const [data, setData] = useState<AntibioticGuideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gramFilter, setGramFilter] = useState<string>('all');
  const [highYieldOnly, setHighYieldOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        setError(null);
        const token = await getToken();
        const res = await fetch('/api/reference/antibiotic-guidelines', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: any = await res.json();
        const data = unwrapApiEnvelope<AntibioticGuideline[]>(json);
        if (!cancelled) setData(data || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load antibiotic guidelines');
      }
      finally { if (!cancelled) setLoading(false); }
    }
    fetch_();
    return () => { cancelled = true; };
  }, [getToken]);

  const filtered = useMemo(() => {
    return data.filter((g) => {
      if (highYieldOnly && !g.isHighYield) return false;
      if (gramFilter !== 'all' && g.gramStain !== gramFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return g.organism.toLowerCase().includes(q) ||
          g.class.toLowerCase().includes(q) ||
          (g.commonInfections?.some((i) => i.toLowerCase().includes(q)) ?? false);
      }
      return true;
    });
  }, [data, highYieldOnly, gramFilter, searchQuery]);

  const gramOptions = useMemo(() => {
    const stains = new Set(data.map((g) => g.gramStain).filter(Boolean));
    return ['all', ...Array.from(stains).sort()];
  }, [data]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading antibiotic guides...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <AlertTriangle size={24} style={{ color: 'var(--color-data-fail)', marginBottom: 8 }} />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{
          marginTop: 8, padding: '6px 16px', borderRadius: 8, fontSize: 13,
          border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
          cursor: 'pointer', color: 'var(--color-text-primary)',
        }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Search + Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <div style={{
          flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}>
          <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <input type="text" aria-label="Search antibiotic guidelines" placeholder="Search organisms, infections..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text-primary)', fontFamily: FONT_BODY }}
          />
        </div>
        <select value={gramFilter} onChange={(e) => setGramFilter(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
          {gramOptions.map((g) => <option key={g} value={g}>{g === 'all' ? 'All Gram Stains' : g}</option>)}
        </select>
        <button onClick={() => setHighYieldOnly(!highYieldOnly)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
            border: highYieldOnly ? '2px solid var(--color-data-provisional)' : '1px solid var(--color-border)',
            background: highYieldOnly ? 'color-mix(in srgb, var(--color-data-provisional) 15%, transparent)' : 'var(--color-bg-secondary)',
            color: highYieldOnly ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
          <Star size={14} fill={highYieldOnly ? 'var(--color-data-provisional)' : 'none'} /> High Yield
        </button>
      </div>

      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        {filtered.length} organism{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((org) => {
          const isExpanded = expandedId === org.id;
          const gramColor = org.gramStain?.toLowerCase().includes('positive') ? 'var(--color-accent)' : 'var(--color-data-fail)';

          return (
            <motion.div key={org.id} layout
              style={{ borderRadius: 14, border: '1px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-bg-primary, var(--color-bg-primary))' }}>
              {/* Card Header — always visible */}
              <button onClick={() => setExpandedId(isExpanded ? null : org.id)}
                style={{ width: '100%', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Bug size={20} style={{ color: gramColor, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: FONT_HEADING }}>{org.organism}</span>
                    {org.isHighYield && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, background: 'var(--color-data-provisional)', color: 'var(--color-text-secondary)' }}>HY</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 9999, background: `${gramColor}18`, color: gramColor, fontWeight: 600 }}>
                      {org.gramStain}
                    </span>
                    {org.morphology && <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 9999, background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>{org.morphology}</span>}
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 9999, background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>{org.class}</span>
                  </div>
                  {/* First-line antibiotics preview */}
                  {org.firstLineAntibiotics && org.firstLineAntibiotics.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-data-pass)', fontWeight: 600 }}>
                      <Shield size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                      {org.firstLineAntibiotics.slice(0, 3).join(', ')}
                      {org.firstLineAntibiotics.length > 3 && ` +${org.firstLineAntibiotics.length - 3} more`}
                    </div>
                  )}
                  {/* Board yield fact preview */}
                  {!isExpanded && org.boardYieldFacts && org.boardYieldFacts.length > 0 && (
                    <div style={{
                      marginTop: 6, fontSize: 11, color: 'var(--color-text-secondary)',
                      padding: '3px 8px', borderRadius: 6,
                      background: 'color-mix(in srgb, var(--color-data-provisional) 15%, transparent)', display: 'inline-block',
                      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <Star size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} fill="var(--color-data-provisional)" />
                      {org.boardYieldFacts[0]}
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} style={{ borderTop: '1px solid var(--color-border)', padding: '14px 16px' }}>
                  {org.classicPresentation && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 2, fontFamily: FONT_BODY, textTransform: 'uppercase', letterSpacing: 0.5 }}>Classic Presentation</div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5, fontFamily: FONT_BODY }}>{org.classicPresentation}</div>
                    </div>
                  )}
                  {org.firstLineAntibiotics && org.firstLineAntibiotics.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-data-pass)', marginBottom: 4 }}>First-Line Antibiotics</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {org.firstLineAntibiotics.map((abx, i) => (
                          <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 9999, background: 'color-mix(in srgb, var(--color-data-pass) 15%, transparent)', color: 'var(--color-data-pass)', fontWeight: 600 }}>{abx}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {org.alternativeAntibiotics && org.alternativeAntibiotics.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Alternatives</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {org.alternativeAntibiotics.map((abx, i) => (
                          <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 9999, background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>{abx}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {org.commonInfections && org.commonInfections.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Common Infections</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {org.commonInfections.map((inf, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{inf}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {org.resistanceMechanisms && org.resistanceMechanisms.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-data-fail)', marginBottom: 4 }}>
                        <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />Resistance
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {org.resistanceMechanisms.map((r, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {org.treatmentDuration && (
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      <strong>Duration:</strong> {org.treatmentDuration}
                    </div>
                  )}
                  {org.boardYieldFacts && org.boardYieldFacts.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--color-data-provisional) 15%, transparent)', border: '1px solid var(--color-data-provisional)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                        <Star size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} fill="var(--color-data-provisional)" />
                        Board Yield Facts
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {org.boardYieldFacts.map((f, i) => (
                          <li key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 2 }}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {org.clinicalPearls && org.clinicalPearls.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--color-data-provisional) 15%, transparent)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Clinical Pearls</div>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {org.clinicalPearls.map((p, i) => (
                          <li key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 2 }}>{p}</li>
                        ))}
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
  );
}
