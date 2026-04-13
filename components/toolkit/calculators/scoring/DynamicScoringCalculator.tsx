/**
 * DynamicScoringCalculator
 *
 * A data-driven clinical scoring calculator that renders ANY scoring system
 * from the ScoringSystem table. Components, interpretation bands, clinical
 * pearls, and PANCE tips are all read from the database — zero per-system code.
 *
 * Supports two component layouts:
 *   - Binary checkboxes (e.g., PERC: each criterion = 1 point)
 *   - Grouped radio buttons (e.g., GCS: Eye/Verbal/Motor groups with varying points)
 *
 * Detection: if multiple components share the same `criterion` label,
 * they're rendered as a radio group; otherwise as checkboxes.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GraduationCap,
  Info,
  Lightbulb,
  RefreshCw,
  Shield,
  Stethoscope,
  Target,
  XCircle,
} from 'lucide-react';
import type { CalculatorProps, RiskLevel } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface ScoringComponent {
  criterion: string;
  points: number;
  description: string;
}

interface ScoringInterpretation {
  riskLevel: string;
  scoreRange: string;
  recommendation: string;
}

interface ActionThresholds {
  low: string;
  moderate: string;
  high: string;
}

interface LinkedCondition {
  conditionId: string;
  condition: {
    id: string;
    canonicalName: string;
    system: string;
    subcategory?: string;
  };
}

interface ScoringSystemData {
  id: string;
  name: string;
  displayName: string | null;
  aliases: string[] | null;
  category: string;
  condition: string | null;
  panceYield: number | null;
  isHighYield: boolean;
  boardYieldFacts: string[] | null;
  components: ScoringComponent[];
  maxScore: number | null;
  minScore: number | null;
  interpretation: ScoringInterpretation[];
  actionThresholds: ActionThresholds | null;
  sensitivity: number | null;
  specificity: number | null;
  validationStudies: string[] | null;
  limitations: string[] | null;
  whenToUse: string | null;
  whenNotToUse: string[] | null;
  clinicalContext: string | null;
  clinicalPearls: string[] | null;
  commonMistakes: string[] | null;
  testQuestionTips: string[] | null;
  mnemonics: string[] | null;
  calculatorUrl: string | null;
  ScoringSystemConditionLink: LinkedCondition[];
}

/** Groups components by criterion label to detect radio vs checkbox mode */
interface ComponentGroup {
  criterion: string;
  isRadioGroup: boolean;
  options: ScoringComponent[];
}

interface DynamicScoringCalculatorProps extends CalculatorProps {
  scoringSystemId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function groupComponents(components: ScoringComponent[]): ComponentGroup[] {
  const grouped = new Map<string, ScoringComponent[]>();

  for (const comp of components) {
    const key = comp.criterion;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(comp);
  }

  return Array.from(grouped.entries()).map(([criterion, options]) => ({
    criterion,
    isRadioGroup: options.length > 1,
    options: options.sort((a, b) => b.points - a.points), // highest first for radio
  }));
}

/** Parse a score range like "0", "1-8", "13-14", "≤ 8" into a min/max pair */
function parseScoreRange(range: string): { min: number; max: number } {
  const trimmed = range.trim();

  if (trimmed.startsWith('≤') || trimmed.startsWith('<=')) {
    const val = parseInt(trimmed.replace(/[≤<=\s]/g, ''), 10);
    return { min: -Infinity, max: val };
  }
  if (trimmed.startsWith('≥') || trimmed.startsWith('>=')) {
    const val = parseInt(trimmed.replace(/[≥>=\s]/g, ''), 10);
    return { min: val, max: Infinity };
  }
  if (trimmed.includes('-')) {
    const [minStr, maxStr] = trimmed.split('-').map((s) => s.trim());
    return { min: parseInt(minStr ?? '0', 10), max: parseInt(maxStr ?? '0', 10) };
  }

  const val = parseInt(trimmed, 10);
  return { min: val, max: val };
}

function matchInterpretation(
  score: number,
  interpretations: ScoringInterpretation[]
): ScoringInterpretation | null {
  for (const interp of interpretations) {
    const { min, max } = parseScoreRange(interp.scoreRange);
    if (score >= min && score <= max) return interp;
  }
  return null;
}

function mapRiskLevel(riskLevel: string): RiskLevel {
  const lower = riskLevel.toLowerCase();
  if (lower.includes('low') || lower.includes('normal') || lower.includes('negative'))
    return 'low';
  if (lower.includes('high') || lower.includes('severe') || lower.includes('coma'))
    return 'high';
  return 'moderate';
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', background: 'var(--color-bg-secondary)',
          border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)',
          fontSize: 14, fontWeight: 600,
        }}
      >
        <Icon size={18} />
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '12px 16px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DynamicScoringCalculator({
  scoringSystemId,
  onBack,
}: DynamicScoringCalculatorProps) {
  const { getToken } = useAuth();

  // State
  const [data, setData] = useState<ScoringSystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selections: for checkboxes, key = "criterion::description", value = boolean
  // For radio groups, key = criterion label, value = selected description string
  const [checkboxSelections, setCheckboxSelections] = useState<Record<string, boolean>>({});
  const [radioSelections, setRadioSelections] = useState<Record<string, string>>({});
  const [showStudyPanel, setShowStudyPanel] = useState(false);

  // ---- Fetch scoring system data ----
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();
        const res = await fetch(`/api/reference/scoring-systems/${scoringSystemId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: any = await res.json();

        if (!cancelled) {
          setData(json.data);
          // Initialize selections
          setCheckboxSelections({});
          setRadioSelections({});
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load scoring system');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [scoringSystemId, getToken]);

  // ---- Derived data ----
  const componentGroups = useMemo(
    () => (data ? groupComponents(data.components) : []),
    [data]
  );

  const score = useMemo(() => {
    if (!data) return 0;
    let total = 0;

    for (const group of componentGroups) {
      if (group.isRadioGroup) {
        // Radio: find selected option's points
        const selectedDesc = radioSelections[group.criterion];
        if (selectedDesc) {
          const opt = group.options.find((o) => o.description === selectedDesc);
          if (opt) total += opt.points;
        }
      } else {
        // Checkbox: sum checked items
        for (const opt of group.options) {
          const key = `${opt.criterion}::${opt.description}`;
          if (checkboxSelections[key]) total += opt.points;
        }
      }
    }

    return total;
  }, [componentGroups, checkboxSelections, radioSelections, data]);

  const currentInterpretation = useMemo(
    () => (data ? matchInterpretation(score, data.interpretation) : null),
    [data, score]
  );

  const riskLevel = useMemo<RiskLevel>(
    () => (currentInterpretation ? mapRiskLevel(currentInterpretation.riskLevel) : 'low'),
    [currentInterpretation]
  );

  const handleReset = useCallback(() => {
    setCheckboxSelections({});
    setRadioSelections({});
  }, []);

  // ---- Risk color mapping (uses design tokens for dark mode support) ----
  const riskColors: Record<RiskLevel, { bg: string; border: string; text: string }> = {
    low: {
      bg: 'color-mix(in srgb, var(--color-data-pass) 15%, var(--color-bg-primary))',
      border: 'var(--color-data-pass)',
      text: 'var(--color-data-pass)',
    },
    moderate: {
      bg: 'color-mix(in srgb, var(--color-data-provisional) 15%, var(--color-bg-primary))',
      border: 'var(--color-data-provisional)',
      text: 'var(--color-data-provisional)',
    },
    high: {
      bg: 'color-mix(in srgb, var(--color-data-fail) 15%, var(--color-bg-primary))',
      border: 'var(--color-data-fail)',
      text: 'var(--color-data-fail)',
    },
  };

  // ---- Loading / Error states ----
  if (loading) {
    return (
      <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: 'var(--color-text-secondary)' }}>
        <RefreshCw size={20} className="animate-spin" style={{ marginRight: 8 }} />
        Loading scoring system...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle size={32} style={{ color: 'var(--color-data-fail)', marginBottom: 12 }} />
        <p style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{error || 'Scoring system not found'}</p>
        {onBack && (
          <button onClick={onBack} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
            Go back
          </button>
        )}
      </div>
    );
  }

  const maxScore = data.maxScore ?? componentGroups.reduce((sum, g) =>
    sum + (g.isRadioGroup ? Math.max(...g.options.map((o) => o.points)) : g.options.reduce((s, o) => s + o.points, 0)), 0);

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* ---- HEADER ---- */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Stethoscope size={22} style={{ color: 'var(--color-accent)' }} />
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {data.displayName || data.name}
          </h2>
          {data.isHighYield && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'var(--color-data-provisional)', color: 'var(--color-text-secondary)' }}>
              HIGH YIELD
            </span>
          )}
        </div>
        {data.clinicalContext && (
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {data.clinicalContext}
          </p>
        )}
        {/* Sensitivity / Specificity badges */}
        {(data.sensitivity || data.specificity) && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {data.sensitivity && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Sensitivity: <strong>{data.sensitivity}%</strong>
              </span>
            )}
            {data.specificity && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Specificity: <strong>{data.specificity}%</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ---- SCORE DISPLAY (sticky) ---- */}
      <motion.div
        layout
        style={{
          position: 'sticky', top: 8, zIndex: 10, marginBottom: 20,
          padding: '16px 20px', borderRadius: 16,
          background: riskColors[riskLevel].bg,
          border: `2px solid ${riskColors[riskLevel].border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: riskColors[riskLevel].text }}>
              {score}<span style={{ fontSize: 16, fontWeight: 400 }}>/{maxScore}</span>
            </div>
            {currentInterpretation && (
              <div style={{ fontSize: 14, fontWeight: 600, color: riskColors[riskLevel].text, marginTop: 2 }}>
                {currentInterpretation.riskLevel}
              </div>
            )}
          </div>
          <button
            onClick={handleReset}
            title="Reset all selections"
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              borderRadius: 8, border: `1px solid ${riskColors[riskLevel].border}`,
              background: 'transparent', cursor: 'pointer',
              color: riskColors[riskLevel].text, fontSize: 13, fontWeight: 600,
            }}
          >
            <RefreshCw size={14} /> Reset
          </button>
        </div>

        {/* Score progress bar */}
        <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: 'color-mix(in srgb, var(--color-text-primary) 10%, transparent)', overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${maxScore > 0 ? (score / maxScore) * 100 : 0}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ height: '100%', borderRadius: 3, background: riskColors[riskLevel].border }}
          />
        </div>

        {/* Recommendation */}
        {currentInterpretation && (
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, color: riskColors[riskLevel].text }}>
            {currentInterpretation.recommendation}
          </p>
        )}
      </motion.div>

      {/* ---- CRITERIA INPUTS ---- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {componentGroups.map((group) =>
          group.isRadioGroup ? (
            /* ---- RADIO GROUP (e.g., GCS Eye/Verbal/Motor) ---- */
            <div
              key={group.criterion}
              style={{
                borderRadius: 12, border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '10px 16px', background: 'var(--color-bg-secondary)',
                fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)',
                borderBottom: '1px solid var(--color-border)',
              }}>
                {group.criterion}
                {radioSelections[group.criterion] && (
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                    {' '}— {group.options.find((o) => o.description === radioSelections[group.criterion])?.points ?? 0} pts
                  </span>
                )}
              </div>
              {group.options.map((opt) => {
                const isSelected = radioSelections[group.criterion] === opt.description;
                return (
                  <label
                    key={opt.description}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px', cursor: 'pointer',
                      background: isSelected ? 'var(--color-accent-muted, rgba(59,130,246,0.08))' : 'transparent',
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name={`radio-${group.criterion}`}
                      checked={isSelected}
                      onChange={() => setRadioSelections((prev) => ({ ...prev, [group.criterion]: opt.description }))}
                      style={{ accentColor: 'var(--color-accent)', width: 16, height: 16 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>{opt.description}</div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                      background: isSelected ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                      color: isSelected ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                    }}>
                      {opt.points} pt{opt.points !== 1 ? 's' : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            /* ---- CHECKBOX (e.g., PERC, CURB-65) ---- */
            group.options.map((opt) => {
              const key = `${opt.criterion}::${opt.description}`;
              const isChecked = checkboxSelections[key] ?? false;
              return (
                <label
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 16px', borderRadius: 12,
                    border: `1px solid ${isChecked ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: isChecked ? 'var(--color-accent-muted, rgba(59,130,246,0.08))' : 'transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => setCheckboxSelections((prev) => ({ ...prev, [key]: !prev[key] }))}
                    style={{ accentColor: 'var(--color-accent)', width: 18, height: 18, marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {opt.criterion}
                    </div>
                    {opt.description && (
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {opt.description}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                    background: isChecked ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                    color: isChecked ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                    flexShrink: 0,
                  }}>
                    {opt.points > 0 ? '+' : ''}{opt.points} pt{Math.abs(opt.points) !== 1 ? 's' : ''}
                  </span>
                </label>
              );
            })
          )
        )}
      </div>

      {/* ---- INTERPRETATION TABLE ---- */}
      {data.interpretation.length > 1 && (
        <CollapsibleSection title="Score Interpretation" icon={Target} defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.interpretation.map((interp, i) => {
              const level = mapRiskLevel(interp.riskLevel);
              const isActive = currentInterpretation?.scoreRange === interp.scoreRange;
              return (
                <div
                  key={i}
                  style={{
                    padding: '10px 14px', borderRadius: 10,
                    border: isActive ? `2px solid ${riskColors[level].border}` : '1px solid var(--color-border)',
                    background: isActive ? riskColors[level].bg : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: isActive ? riskColors[level].text : 'var(--color-text-primary)' }}>
                      {interp.riskLevel}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Score: {interp.scoreRange}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {interp.recommendation}
                  </p>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* ---- STUDY MODE TOGGLE ---- */}
      <button
        onClick={() => setShowStudyPanel(!showStudyPanel)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 16px', borderRadius: 12, marginBottom: 16,
          border: '2px solid var(--color-accent)',
          background: showStudyPanel ? 'var(--color-accent)' : 'transparent',
          color: showStudyPanel ? 'var(--color-text-inverse)' : 'var(--color-accent)',
          cursor: 'pointer', fontSize: 14, fontWeight: 700,
          transition: 'all 0.2s',
        }}
      >
        <GraduationCap size={18} />
        {showStudyPanel ? 'Hide' : 'Show'} PANCE Study Mode
      </button>

      {/* ---- STUDY PANEL ---- */}
      <AnimatePresence>
        {showStudyPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            {/* Board Yield Facts */}
            {data.boardYieldFacts && data.boardYieldFacts.length > 0 && (
              <CollapsibleSection title="Board Yield Facts" icon={Target} defaultOpen>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {data.boardYieldFacts.map((fact, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                      {fact}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Clinical Pearls */}
            {data.clinicalPearls && data.clinicalPearls.length > 0 && (
              <CollapsibleSection title="Clinical Pearls" icon={Lightbulb}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {data.clinicalPearls.map((pearl, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                      {pearl}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Test Question Tips */}
            {data.testQuestionTips && data.testQuestionTips.length > 0 && (
              <CollapsibleSection title="Test Question Tips" icon={GraduationCap}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {data.testQuestionTips.map((tip, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                      {tip}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Common Mistakes */}
            {data.commonMistakes && data.commonMistakes.length > 0 && (
              <CollapsibleSection title="Common Mistakes" icon={XCircle}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {data.commonMistakes.map((mistake, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                      {mistake}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Mnemonics */}
            {data.mnemonics && data.mnemonics.length > 0 && (
              <CollapsibleSection title="Mnemonics" icon={BookOpen}>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                  {data.mnemonics.join('\n')}
                </div>
              </CollapsibleSection>
            )}

            {/* When to Use / When NOT to Use */}
            {(data.whenToUse || (data.whenNotToUse && data.whenNotToUse.length > 0)) && (
              <CollapsibleSection title="Clinical Application" icon={Shield}>
                {data.whenToUse && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-data-pass)', marginBottom: 4 }}>When to Use:</div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>{data.whenToUse}</p>
                  </div>
                )}
                {data.whenNotToUse && data.whenNotToUse.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-data-fail)', marginBottom: 4 }}>When NOT to Use:</div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {data.whenNotToUse.map((item, i) => (
                        <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CollapsibleSection>
            )}

            {/* Limitations */}
            {data.limitations && data.limitations.length > 0 && (
              <CollapsibleSection title="Limitations" icon={AlertCircle}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {data.limitations.map((lim, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                      {lim}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- LINKED CONDITIONS ---- */}
      {data.ScoringSystemConditionLink.length > 0 && (
        <CollapsibleSection title={`Linked Conditions (${data.ScoringSystemConditionLink.length})`} icon={Info}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.ScoringSystemConditionLink.map((link) => (
              <span
                key={link.conditionId}
                style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 9999,
                  background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)', cursor: 'pointer',
                }}
                title={link.condition?.canonicalName || link.conditionId}
              >
                {link.condition?.canonicalName || link.conditionId}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ---- EXTERNAL LINK ---- */}
      {data.calculatorUrl && (
        <a
          href={data.calculatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 10,
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)', fontSize: 13, textDecoration: 'none',
            marginTop: 8,
          }}
        >
          <ExternalLink size={14} />
          View on MDCalc
        </a>
      )}
    </div>
  );
}
