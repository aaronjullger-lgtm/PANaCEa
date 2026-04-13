/**
 * QuickRefHub
 *
 * Mobile-first pocket reference card system for clinical rotations.
 * Organizes quick-reference content into browsable categories:
 *   - Antibiotic Guides (59 organisms)
 *   - ACLS Algorithms (50 steps)
 *   - Normal Lab Values (59 values)
 *   - Vital Sign Ranges (51 ranges)
 *   - Scoring Systems (56 systems — links to ScoringSystemBrowser)
 *
 * Each category renders its own card format optimized for
 * at-a-glance clinical reference.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './quickref-print.css';
import {
  ArrowLeft,
  BookMarked,
  Bug,
  Heart,
  FlaskConical,
  Activity,
  Calculator,
  Search,
  Star,
  ChevronRight,
  Printer,
  BookOpen,
} from 'lucide-react';
import AntibioticRefCards from './AntibioticRefCards';
import ACLSRefCards from './ACLSRefCards';
import NormalLabRefCards from './NormalLabRefCards';

interface Category {
  id: string;
  label: string;
  icon: React.ElementType;
  count: number;
  description: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { id: 'antibiotics', label: 'Antibiotic Guides', icon: Bug, count: 59, description: 'Organism profiles with first-line antibiotics, resistance, and gram stain', color: '#22c55e' },
  { id: 'acls', label: 'ACLS Algorithms', icon: Heart, count: 50, description: 'Cardiac arrest and arrhythmia management steps with drug doses', color: '#ef4444' },
  { id: 'labs', label: 'Normal Lab Values', icon: FlaskConical, count: 59, description: 'Reference ranges with units, critical values, and clinical notes', color: '#3b82f6' },
  { id: 'vitals', label: 'Vital Sign Ranges', icon: Activity, count: 51, description: 'Normal vital sign ranges by age and clinical context', color: '#8b5cf6' },
];

export default function QuickRefHub({ onBack }: { onBack?: () => void }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hubSearch, setHubSearch] = useState('');

  // ---- Render sub-view ----
  if (activeCategory) {
    const cat = CATEGORIES.find((c) => c.id === activeCategory);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 16px 16px' }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)', cursor: 'pointer',
              color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Quick Reference
          </button>
          <button
            onClick={() => window.print()}
            title="Print these reference cards"
            className="quickref-no-print"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', marginLeft: 'auto',
              borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)', cursor: 'pointer',
              color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 600,
            }}
          >
            <Printer size={14} /> Print
          </button>
        </div>
        {activeCategory === 'antibiotics' && <AntibioticRefCards />}
        {activeCategory === 'acls' && <ACLSRefCards />}
        {activeCategory === 'labs' && <NormalLabRefCards />}
        {activeCategory === 'vitals' && <NormalLabRefCards variant="vitals" />}
      </div>
    );
  }

  // ---- Category Grid ----
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <BookMarked size={28} style={{ color: 'var(--color-accent)' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Quick Reference
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Pocket-card references for clinical rotations
          </p>
        </div>
      </div>

      {/* Quick search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        borderRadius: 12, border: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)', marginBottom: 16,
      }}>
        <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
        <input
          type="text"
          aria-label="Search quick reference categories"
          placeholder="Search categories (antibiotics, ACLS, labs, vitals)..."
          value={hubSearch}
          onChange={(e) => setHubSearch(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14, color: 'var(--color-text-primary)',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CATEGORIES.filter((cat) => {
          if (!hubSearch) return true;
          const q = hubSearch.toLowerCase();
          return cat.label.toLowerCase().includes(q) || cat.description.toLowerCase().includes(q) || cat.id.toLowerCase().includes(q);
        }).map((cat) => {
          const Icon = cat.icon;
          return (
            <motion.button
              key={cat.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '20px', borderRadius: 14, width: '100%', textAlign: 'left',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary, #fff)',
                cursor: 'pointer', transition: 'border-color 0.15s',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${cat.color}15`, flexShrink: 0,
              }}>
                <Icon size={24} style={{ color: cat.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {cat.label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                  {cat.description}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 9999,
                  background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
                }}>
                  {cat.count}
                </span>
                <ChevronRight size={18} style={{ color: 'var(--color-text-secondary)' }} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Cross-reference to Knowledge Base */}
      <div style={{
        marginTop: 20, padding: '10px 14px', borderRadius: 10,
        background: 'color-mix(in srgb, var(--color-bg-secondary) 90%, #3b82f6 10%)',
        border: '1px dashed var(--color-border)',
        fontSize: 12, color: 'var(--color-text-secondary)',
        display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.5,
      }}>
        <BookOpen size={14} style={{ flexShrink: 0 }} />
        <span>
          For in-depth lab test details, scoring system breakdowns, and PANCE study notes, visit the{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>Knowledge Base → Reference Library</strong>.
        </span>
      </div>
    </div>
  );
}
