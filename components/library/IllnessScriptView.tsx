/**
 * IllnessScriptView — Three-panel illness script visualization
 *
 * Displays a structured illness script for a condition:
 *   Panel 1: Enabling Conditions (risk factors, demographics)
 *   Panel 2: Fault (pathophysiology, mechanism)
 *   Panel 3: Consequences (signs, symptoms, labs, imaging)
 *
 * Plus: diagnostics, treatment, differential context, completeness.
 * Supports single-condition and side-by-side DDx comparison mode.
 *
 * Sprint 19 — Wire Illness Script into condition detail UI
 * @module components/library/IllnessScriptView
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Heart,
  Microscope,
  Pill,
  Search,
  Stethoscope,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';
import {
  diagnosticStrength,
  diagnosticStrengthFallback,
  severity,
  severityFallback,
  completenessColor,
  illnessScriptAccent,
  tintBg,
  type DiagnosticStrengthKey,
  type SeverityKey,
} from '@/lib/tokens';

// ─── Types (mirrors illnessScriptService) ───────────────────────────────

interface EnablingCondition {
  factor: string;
  category: string;
  weight: number;
  isHighYield: boolean;
}

interface FaultMechanism {
  narrative: string;
  mechanismSteps: string[];
  etiology: string | null;
  evidenceGrade: string | null;
}

interface ClinicalConsequence {
  finding: string;
  type: string;
  diagnosticStrength: string;
  isClassic: boolean;
  isHighYield: boolean;
  sensitivity?: number;
  specificity?: number;
  positiveLR?: number;
}

interface DiagnosticWorkup {
  goldStandard: string | null;
  bestInitialTest: string | null;
  workupSteps: string[];
}

interface TreatmentSummary {
  firstLine: string | null;
  principles: string[];
  keyInterventions: string[];
}

interface DifferentialContext {
  mustNotMiss: string[];
  distinguishingFeatures: string[];
  classicPatient: string | null;
  buzzwords: string[];
}

interface ScriptGap {
  section: string;
  description: string;
  severity: 'critical' | 'moderate' | 'minor';
}

interface IllnessScript {
  conditionId: string;
  conditionName: string;
  system: string;
  subcategory: string;
  enablingConditions: EnablingCondition[];
  fault: FaultMechanism;
  consequences: ClinicalConsequence[];
  diagnostics: DiagnosticWorkup;
  treatment: TreatmentSummary;
  differential: DifferentialContext;
  panceYield: string | null;
  completeness: number;
  gaps: ScriptGap[];
}

interface ScriptComparison {
  sharedFindings: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  keyDistinguishers: string[];
}

interface APIResponse {
  mode: 'single' | 'comparison';
  script?: IllnessScript;
  scriptA?: IllnessScript;
  scriptB?: IllnessScript;
  comparison?: ScriptComparison;
}

// ─── Props ──────────────────────────────────────────────────────────────

export interface IllnessScriptViewProps {
  conditionId: string;
  conditionName?: string;
  /** Optional second condition ID for DDx comparison */
  compareConditionId?: string;
  compareConditionName?: string;
  onClose?: () => void;
  /** Callback when user wants to compare with another condition */
  onRequestCompare?: () => void;
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  accentColor = 'var(--color-accent)',
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        background: 'var(--color-bg-secondary)',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-primary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={18} style={{ color: accentColor }} aria-hidden="true" />
          <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{title}</span>
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 16px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StrengthBadge({ strength }: { strength: string }) {
  const palette =
    diagnosticStrength[strength as DiagnosticStrengthKey] ?? diagnosticStrengthFallback;
  return (
    <span
      style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '2px 6px',
        borderRadius: 4,
        background: palette.bg,
        color: palette.text,
      }}
    >
      {strength}
    </span>
  );
}

function CompletenessRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);
  const color = completenessColor(value);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={48} height={48} viewBox="0 0 48 48">
        <circle
          cx={24}
          cy={24}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={4}
        />
        <circle
          cx={24}
          cy={24}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
        <text
          x={24}
          y={24}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-text-primary)"
          fontSize={11}
          fontWeight={700}
        >
          {pct}%
        </text>
      </svg>
      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
        Script completeness
      </span>
    </div>
  );
}

function GapsList({ gaps }: { gaps: ScriptGap[] }) {
  if (gaps.length === 0) return null;
  const severityOrder = { critical: 0, moderate: 1, minor: 2 };
  const sorted = [...gaps].sort(
    (a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
  );
  // severity palette sourced from @/lib/tokens (severity)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map((g, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <AlertTriangle
            size={14}
            style={{
              color: severity[g.severity as SeverityKey] ?? severityFallback,
              marginTop: 2,
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{g.section}</strong>: {g.description}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Panels ─────────────────────────────────────────────────────────────

function EnablingConditionsPanel({ conditions }: { conditions: EnablingCondition[] }) {
  const grouped: Record<string, EnablingCondition[]> = {};
  for (const c of conditions) {
    const cat = c.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(c);
  }

  const categoryLabels: Record<string, string> = {
    demographic: 'Demographics',
    behavioral: 'Behavioral',
    genetic: 'Genetic / Family Hx',
    environmental: 'Environmental',
    comorbid: 'Comorbid Conditions',
    other: 'Other',
  };

  return (
    <CollapsibleSection title="Enabling Conditions" icon={Heart} accentColor={illnessScriptAccent.enabling}>
      {conditions.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
          No enabling conditions documented.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-text-muted)',
                  marginBottom: 4,
                }}
              >
                {categoryLabels[cat] ?? cat}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '0.85rem',
                      background: c.isHighYield
                        ? tintBg(illnessScriptAccent.enabling, '15')
                        : 'var(--color-bg-primary)',
                      border: c.isHighYield
                        ? `1px solid ${tintBg(illnessScriptAccent.enabling, '40')}`
                        : '1px solid var(--color-border)',
                      color: c.isHighYield
                        ? illnessScriptAccent.enabling
                        : 'var(--color-text-secondary)',
                      fontWeight: c.isHighYield ? 600 : 400,
                    }}
                  >
                    {c.factor}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

function FaultPanel({ fault }: { fault: FaultMechanism }) {
  return (
    <CollapsibleSection title="Fault (Pathophysiology)" icon={Brain} accentColor={illnessScriptAccent.fault}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fault.etiology && (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Etiology:</strong>{' '}
            {fault.etiology}
          </div>
        )}
        {fault.narrative && (
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            {fault.narrative}
          </p>
        )}
        {fault.mechanismSteps.length > 0 && (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-muted)',
                marginBottom: 6,
              }}
            >
              Mechanism Steps
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {fault.mechanismSteps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    fontSize: '0.85rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: tintBg(illnessScriptAccent.fault, '20'),
                      color: illnessScriptAccent.fault,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function ConsequencesPanel({ consequences }: { consequences: ClinicalConsequence[] }) {
  const grouped: Record<string, ClinicalConsequence[]> = {};
  for (const c of consequences) {
    const t = c.type || 'other';
    if (!grouped[t]) grouped[t] = [];
    grouped[t]!.push(c);
  }

  const typeLabels: Record<string, { label: string; icon: React.ElementType }> = {
    symptom: { label: 'Symptoms', icon: BookOpen },
    sign: { label: 'Signs', icon: Stethoscope },
    lab_finding: { label: 'Lab Findings', icon: FlaskConical },
    imaging_finding: { label: 'Imaging Findings', icon: Microscope },
    complication: { label: 'Complications', icon: AlertTriangle },
    vital_sign: { label: 'Vital Signs', icon: Zap },
  };

  return (
    <CollapsibleSection title="Consequences" icon={Target} accentColor={illnessScriptAccent.consequence}>
      {consequences.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
          No consequences documented.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.entries(grouped).map(([type, items]) => {
            const meta = typeLabels[type] ?? { label: type, icon: BookOpen };
            const TypeIcon = meta.icon;
            return (
              <div key={type}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-text-muted)',
                    marginBottom: 6,
                  }}
                >
                  <TypeIcon size={13} aria-hidden="true" />
                  {meta.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: '0.85rem',
                        padding: '4px 0',
                        color: c.isClassic ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        fontWeight: c.isClassic ? 600 : 400,
                      }}
                    >
                      <span>
                        {c.isClassic && (
                          <span style={{ color: illnessScriptAccent.classic, marginRight: 4 }} title="Classic finding">
                            ★
                          </span>
                        )}
                        {c.finding}
                      </span>
                      <StrengthBadge strength={c.diagnosticStrength} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}

function DiagnosticsPanel({ dx }: { dx: DiagnosticWorkup }) {
  return (
    <CollapsibleSection title="Diagnostic Workup" icon={Search} defaultOpen={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
        {dx.bestInitialTest && (
          <div>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Best Initial Test: </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{dx.bestInitialTest}</span>
          </div>
        )}
        {dx.goldStandard && (
          <div>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Gold Standard: </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{dx.goldStandard}</span>
          </div>
        )}
        {dx.workupSteps.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Workup Steps
            </div>
            {dx.workupSteps.map((s, i) => (
              <div key={i} style={{ color: 'var(--color-text-secondary)', paddingLeft: 8 }}>
                {i + 1}. {s}
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function TreatmentPanel({ tx }: { tx: TreatmentSummary }) {
  return (
    <CollapsibleSection title="Treatment" icon={Pill} defaultOpen={false} accentColor={illnessScriptAccent.treatment}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
        {tx.firstLine && (
          <div>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>First-Line: </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{tx.firstLine}</span>
          </div>
        )}
        {tx.principles.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Key Principles
            </div>
            {tx.principles.map((p, i) => (
              <div key={i} style={{ color: 'var(--color-text-secondary)', paddingLeft: 8 }}>
                {p}
              </div>
            ))}
          </div>
        )}
        {tx.keyInterventions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tx.keyInterventions.map((k, i) => (
              <span
                key={i}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: tintBg(illnessScriptAccent.treatment, '15'),
                  border: `1px solid ${tintBg(illnessScriptAccent.treatment, '30')}`,
                  color: illnessScriptAccent.treatment,
                  fontSize: '0.8rem',
                }}
              >
                {k}
              </span>
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function DifferentialPanel({ ddx }: { ddx: DifferentialContext }) {
  return (
    <CollapsibleSection title="Differential Diagnosis" icon={ArrowLeftRight} defaultOpen={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
        {ddx.classicPatient && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              fontStyle: 'italic',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span style={{ fontWeight: 600, fontStyle: 'normal', color: 'var(--color-text-primary)' }}>
              Classic Patient:{' '}
            </span>
            {ddx.classicPatient}
          </div>
        )}
        {ddx.buzzwords.length > 0 && (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-muted)',
                marginBottom: 4,
              }}
            >
              Buzzwords
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ddx.buzzwords.map((b, i) => (
                <span
                  key={i}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: tintBg(illnessScriptAccent.classic, '15'),
                    border: `1px solid ${tintBg(illnessScriptAccent.classic, '30')}`,
                    color: illnessScriptAccent.classic,
                    fontSize: '0.8rem',
                    fontWeight: 500,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}
        {ddx.mustNotMiss.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Must Not Miss
            </div>
            {ddx.mustNotMiss.map((m, i) => (
              <div key={i} style={{ color: severity.critical, paddingLeft: 8 }}>
                {m}
              </div>
            ))}
          </div>
        )}
        {ddx.distinguishingFeatures.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Key Distinguishers
            </div>
            {ddx.distinguishingFeatures.map((f, i) => (
              <div key={i} style={{ color: 'var(--color-text-secondary)', paddingLeft: 8 }}>
                {f}
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function ComparisonPanel({ comparison, nameA, nameB }: { comparison: ScriptComparison; nameA: string; nameB: string }) {
  return (
    <CollapsibleSection title="Comparison" icon={ArrowLeftRight} accentColor={illnessScriptAccent.comparison}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.85rem' }}>
        {comparison.keyDistinguishers.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, color: illnessScriptAccent.comparison, marginBottom: 4 }}>
              Key Distinguishers
            </div>
            {comparison.keyDistinguishers.map((d, i) => (
              <div key={i} style={{ color: 'var(--color-text-secondary)', paddingLeft: 8 }}>
                {d}
              </div>
            ))}
          </div>
        )}
        {comparison.sharedFindings.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Shared Findings
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {comparison.sharedFindings.map((f, i) => (
                <span
                  key={i}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.8rem',
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {comparison.uniqueToA.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                Unique to {nameA}
              </div>
              {comparison.uniqueToA.map((f, i) => (
                <div key={i} style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                  {f}
                </div>
              ))}
            </div>
          )}
          {comparison.uniqueToB.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                Unique to {nameB}
              </div>
              {comparison.uniqueToB.map((f, i) => (
                <div key={i} style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ─── Single Script Column ───────────────────────────────────────────────

function ScriptColumn({ script }: { script: IllnessScript }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <EnablingConditionsPanel conditions={script.enablingConditions} />
      <FaultPanel fault={script.fault} />
      <ConsequencesPanel consequences={script.consequences} />
      <DiagnosticsPanel dx={script.diagnostics} />
      <TreatmentPanel tx={script.treatment} />
      <DifferentialPanel ddx={script.differential} />
      {script.gaps.length > 0 && (
        <CollapsibleSection title="Knowledge Gaps" icon={AlertTriangle} defaultOpen={false} accentColor={illnessScriptAccent.gap}>
          <GapsList gaps={script.gaps} />
        </CollapsibleSection>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function IllnessScriptView({
  conditionId,
  conditionName: propName,
  compareConditionId,
  compareConditionName,
  onClose,
  onRequestCompare,
}: IllnessScriptViewProps) {
  const { getToken } = useAuth();
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScript = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ conditionId });
      if (compareConditionId) params.set('compare', compareConditionId);

      const res = await fetch(`/api/conditions/illness-script?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(unwrapApiEnvelope<APIResponse>(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load illness script');
    } finally {
      setLoading(false);
    }
  }, [conditionId, compareConditionId, getToken]);

  useEffect(() => {
    void fetchScript();
  }, [fetchScript]);

  const displayName = data?.script?.conditionName ?? data?.scriptA?.conditionName ?? propName ?? 'Condition';

  // ─── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          gap: 12,
          color: 'var(--color-text-muted)',
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
        >
          <Brain size={28} />
        </motion.div>
        <span style={{ fontSize: '0.9rem' }}>Building illness script…</span>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────
  if (error) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--color-text-muted)',
        }}
      >
        <AlertTriangle size={24} style={{ color: severity.critical, marginBottom: 8 }} />
        <p style={{ fontSize: '0.9rem' }}>{error}</p>
        <button
          onClick={() => void fetchScript()}
          style={{
            marginTop: 12,
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // ─── Render ────────────────────────────────────────────────────────

  const isComparison = data.mode === 'comparison' && data.scriptA && data.scriptB;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={20} style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
            {isComparison
              ? `${data.scriptA!.conditionName} vs ${data.scriptB!.conditionName}`
              : `Illness Script: ${displayName}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isComparison && data.script && (
            <CompletenessRing value={data.script.completeness} />
          )}
          {onRequestCompare && !isComparison && (
            <button
              onClick={onRequestCompare}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              <ArrowLeftRight size={14} />
              Compare DDx
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: 6,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 16,
        }}
      >
        {isComparison ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.comparison && (
              <ComparisonPanel
                comparison={data.comparison}
                nameA={data.scriptA!.conditionName}
                nameB={data.scriptB!.conditionName}
              />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    marginBottom: 12,
                  }}
                >
                  {data.scriptA!.conditionName}
                </h3>
                <ScriptColumn script={data.scriptA!} />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    marginBottom: 12,
                  }}
                >
                  {data.scriptB!.conditionName}
                </h3>
                <ScriptColumn script={data.scriptB!} />
              </div>
            </div>
          </div>
        ) : data.script ? (
          <ScriptColumn script={data.script} />
        ) : null}
      </div>
    </div>
  );
}

export default IllnessScriptView;
