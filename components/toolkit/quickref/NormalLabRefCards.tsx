/**
 * NormalLabRefCards
 *
 * Quick-reference cards for normal lab values and vital sign ranges.
 * Fetches from /api/reference/normal-labs or /api/reference/vitals
 * depending on the `variant` prop.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { FlaskConical, Activity, Search, AlertTriangle } from 'lucide-react';

interface LabValue {
  id: string;
  name?: string;
  testName?: string;
  labTestName?: string;
  vitalSign?: string;
  normalRange?: string;
  normalRangeLow?: number;
  normalRangeHigh?: number;
  normalRangeText?: string;
  range?: string;
  unit?: string;
  units?: string;
  siUnits?: string;
  category?: string;
  clinicalNotes?: string;
  notes?: string;
  isHighYield?: boolean;
  sex?: string;
  ageGroup?: string;
  criticalLow?: number;
  criticalHigh?: number;
}

interface Props { variant?: 'labs' | 'vitals'; }

export default function NormalLabRefCards({ variant = 'labs' }: Props) {
  const { getToken } = useAuth();
  const [data, setData] = useState<LabValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const isVitals = variant === 'vitals';
  const endpoint = isVitals ? '/api/reference/vitals' : '/api/reference/normal-labs';
  const Icon = isVitals ? Activity : FlaskConical;
  const accentColor = isVitals ? '#8b5cf6' : '#3b82f6';

  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        const token = await getToken();
        const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: any = await res.json();
        const payload = json.data ?? json;
        const items = Array.isArray(payload) ? payload : (payload?.data ?? payload?.labs ?? []);
        if (!cancelled) setData(Array.isArray(items) ? items : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load data');
      }
      finally { if (!cancelled) setLoading(false); }
    }
    fetch_();
    return () => { cancelled = true; };
  }, [getToken, endpoint]);

  const categories = useMemo(() => {
    const cats = new Set(data.map((d) => d.category).filter(Boolean) as string[]);
    return ['all', ...Array.from(cats).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (d.labTestName || d.vitalSign || d.name || d.testName || '').toLowerCase();
        return name.includes(q) || (d.category?.toLowerCase().includes(q) ?? false);
      }
      return true;
    });
  }, [data, categoryFilter, searchQuery]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading {isVitals ? 'vital signs' : 'lab values'}...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Icon size={24} style={{ color: '#ef4444', marginBottom: 8 }} />
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
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <div style={{
          flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
        }}>
          <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <input type="text" placeholder={`Search ${isVitals ? 'vitals' : 'lab tests'}...`} value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text-primary)' }} />
        </div>
        {categories.length > 2 && (
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
            {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
          </select>
        )}
      </div>

      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        {filtered.length} {isVitals ? 'vital sign' : 'lab value'}{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 10,
      }}>
        {filtered.map((item) => {
          const name = item.labTestName || item.vitalSign || item.name || item.testName || 'Unknown';
          const range = item.normalRangeText
            || item.normalRange
            || item.range
            || (item.normalRangeLow != null && item.normalRangeHigh != null
              ? `${item.normalRangeLow} – ${item.normalRangeHigh}`
              : '—');
          const unit = item.units || item.siUnits || item.unit || '';
          const notes = item.clinicalNotes || item.notes || '';

          return (
            <div key={item.id} style={{
              padding: '14px 16px', borderRadius: 12,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-primary, #fff)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <Icon size={16} style={{ color: accentColor, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{name}</div>
                  {item.category && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{item.category}</span>
                  )}
                </div>
                {item.isHighYield && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, background: '#fbbf24', color: '#78350f' }}>HY</span>
                )}
              </div>

              {/* Range display */}
              <div style={{
                padding: '8px 12px', borderRadius: 8, marginBottom: 6,
                background: `${accentColor}0a`, border: `1px solid ${accentColor}20`,
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: accentColor }}>{range}</div>
                {unit && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{unit}</div>}
              </div>

              {/* Critical Values */}
              {(item.criticalLow != null || item.criticalHigh != null) && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                  borderRadius: 6, marginBottom: 6,
                  background: '#fef2f2', border: '1px solid #fecaca',
                }}>
                  <AlertTriangle size={12} style={{ color: '#dc2626', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#991b1b' }}>
                    Critical: {item.criticalLow != null ? `< ${item.criticalLow}` : ''}
                    {item.criticalLow != null && item.criticalHigh != null ? ' or ' : ''}
                    {item.criticalHigh != null ? `> ${item.criticalHigh}` : ''}
                    {unit ? ` ${unit}` : ''}
                  </span>
                </div>
              )}

              {/* Demographics */}
              {(item.sex || item.ageGroup) && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  {item.sex && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 9999, background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>{item.sex === 'M' ? 'Male' : item.sex === 'F' ? 'Female' : item.sex}</span>}
                  {item.ageGroup && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 9999, background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>{item.ageGroup}</span>}
                </div>
              )}

              {notes && (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{notes}</div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          No {isVitals ? 'vital signs' : 'lab values'} match your search.
        </div>
      )}
    </div>
  );
}
