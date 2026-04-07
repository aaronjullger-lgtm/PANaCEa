/**
 * Calibration Dashboard (Tier 2, Feature 3)
 *
 * Comprehensive metacognitive calibration analytics dashboard showing:
 * - KPI summary cards (Brier Score, ECE, direction indicator)
 * - Dual reliability diagrams (FSRS model vs metacognitive)
 * - Per-PANCE-domain breakdown table
 * - Weekly Brier score trend chart
 *
 * Two distinct calibration measures:
 * 1. FSRS Calibration — algorithm accuracy (predicted R vs actual recall)
 * 2. Metacognitive Calibration — self-awareness (implicit confidence vs actual)
 *
 * Research basis:
 * - Brier (1950): Proper scoring rule
 * - Nixon et al. (2019): Adaptive/quantile binning for ECE
 * - Dunlosky et al. (2013): Calibration feedback improves learning
 *
 * @see lib/services/calibrationDashboardService.ts
 * @see functions/api/user/calibration-dashboard.ts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  Activity,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Target,
  BarChart3,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type {
  CalibrationDashboardData,
  DomainCalibration,
} from '@/lib/services/calibrationDashboardService';
import ReliabilityDiagram from './ReliabilityDiagram';
import CalibrationTrendChart from './CalibrationTrendChart';

// ─── Types ────────────────────────────────────────────────────────

const FONT_HEADING = "'Poppins', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Fira Code', monospace";

// ─── Fetcher ──────────────────────────────────────────────────────

async function fetchCalibrationDashboard(
  getToken: () => Promise<string | null>
): Promise<CalibrationDashboardData> {
  const token = await getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/user/calibration-dashboard', { headers });
  if (!res.ok) throw new Error(`Calibration fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data as CalibrationDashboardData;
}

// ─── KPI Card ─────────────────────────────────────────────────────

const KPICard = React.memo(function KPICard({
  label,
  value,
  subtext,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '16px 18px',
        flex: '1 1 180px',
        minWidth: 180,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}>
        <Icon size={16} style={{ color }} />
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.6,
          color: 'var(--color-text-secondary)',
          fontFamily: FONT_BODY,
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        fontFamily: FONT_MONO,
        fontVariantNumeric: 'tabular-nums',
        color,
        lineHeight: 1.1,
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 12,
        color: 'var(--color-text-muted)',
        fontFamily: FONT_BODY,
      }}>
        {subtext}
      </div>
    </div>
  );
});

// ─── Direction Badge ──────────────────────────────────────────────

const DirectionBadge = React.memo(function DirectionBadge({ direction }: { direction: 'overconfident' | 'underconfident' | 'calibrated' }) {
  const config = {
    overconfident: {
      label: 'Overconfident',
      icon: TrendingUp,
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.1)',
    },
    underconfident: {
      label: 'Underconfident',
      icon: TrendingDown,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.1)',
    },
    calibrated: {
      label: 'Well Calibrated',
      icon: Minus,
      color: 'var(--color-data-pass)',
      bg: 'rgba(34, 197, 94, 0.1)',
    },
  }[direction];

  const Icon = config.icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: FONT_BODY,
        color: config.color,
        background: config.bg,
      }}
    >
      <Icon size={13} />
      {config.label}
    </span>
  );
});

// ─── Domain Breakdown Table ───────────────────────────────────────

function DomainBreakdownTable({ domains }: { domains: DomainCalibration[] }) {
  if (domains.length === 0) {
    return (
      <p style={{
        color: 'var(--color-text-muted)',
        fontSize: 13,
        fontFamily: FONT_BODY,
        fontStyle: 'italic',
        padding: '12px 0',
      }}>
        Not enough per-domain data yet. Keep reviewing across organ systems.
      </p>
    );
  }

  const thBase: React.CSSProperties = {
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: 'var(--color-text-secondary)',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: FONT_BODY,
      }}>
        <thead>
          <tr style={{
            borderBottom: '2px solid var(--color-border)',
            textAlign: 'left',
          }}>
            <th style={thBase}>Domain</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Brier</th>
            <th style={{ ...thBase, textAlign: 'right' }}>ECE</th>
            <th style={{ ...thBase, textAlign: 'center' }}>Direction</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Reviews</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr
              key={d.domain}
              style={{
                borderBottom: '1px solid var(--color-border)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '10px 12px', fontWeight: 500 }}>{d.domain}</td>
              <td style={{
                padding: '10px 12px',
                textAlign: 'right',
                fontFamily: FONT_MONO,
                fontVariantNumeric: 'tabular-nums',
                color: d.brierScore > 0.25 ? '#ef4444' : 'var(--color-text-primary)',
              }}>
                {d.brierScore.toFixed(3)}
              </td>
              <td style={{
                padding: '10px 12px',
                textAlign: 'right',
                fontFamily: FONT_MONO,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {d.ece.toFixed(3)}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                <DirectionBadge direction={d.direction} />
              </td>
              <td style={{
                padding: '10px 12px',
                textAlign: 'right',
                fontFamily: FONT_MONO,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--color-text-muted)',
              }}>
                {d.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────

export default function CalibrationDashboard() {
  const { getToken } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [data, setData] = useState<CalibrationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchCalibrationDashboard(getToken);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calibration data');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Loading State ──────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 120,
            background: 'var(--color-bg-secondary)',
            borderRadius: 12,
            animation: prefersReducedMotion ? 'none' : 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{
        padding: 24,
        textAlign: 'center',
        color: '#ef4444',
        fontFamily: FONT_BODY,
      }}>
        <AlertTriangle size={32} style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 14 }}>{error}</p>
        <button
          onClick={loadData}
          style={{
            marginTop: 12,
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: FONT_BODY,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // ─── Insufficient Data State ────────────────────────────────────

  if (!data.hasSufficientData) {
    const needed = 50 - Math.max(data.fsrs.totalReviews, data.metacognitive.totalReviews);
    return (
      <div style={{
        padding: 32,
        textAlign: 'center',
        fontFamily: FONT_BODY,
      }}>
        <Target size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 16 }} />
        <h2 style={{
          fontSize: 18,
          fontWeight: 600,
          fontFamily: FONT_HEADING,
          color: 'var(--color-text-primary)',
          marginBottom: 8,
        }}>
          Building Your Calibration Profile
        </h2>
        <p style={{
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          maxWidth: 440,
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          We need about {Math.max(0, needed)} more reviews to generate reliable calibration insights.
          Keep studying — your profile builds automatically from every review session.
        </p>
      </div>
    );
  }

  // ─── Full Dashboard ─────────────────────────────────────────────

  const brierColor = data.fsrs.brierScore < 0.15
    ? 'var(--color-data-pass)'
    : data.fsrs.brierScore < 0.25
      ? 'var(--color-data-provisional)'
      : '#ef4444';

  const eceColor = data.fsrs.ece < 0.05
    ? 'var(--color-data-pass)'
    : data.fsrs.ece < 0.1
      ? 'var(--color-data-provisional)'
      : '#ef4444';

  return (
    <div style={{
      padding: '20px 24px',
      maxWidth: 960,
      margin: '0 auto',
      fontFamily: FONT_BODY,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: FONT_HEADING,
          color: 'var(--color-text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Brain size={22} />
          Calibration Analytics
        </h2>
        <p style={{
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          marginTop: 4,
          lineHeight: 1.5,
        }}>
          How well your confidence predicts your actual performance.
          Points on the diagonal = perfect calibration.
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 24,
      }}>
        <KPICard
          label="FSRS Brier Score"
          value={data.fsrs.brierScore.toFixed(3)}
          subtext={`${data.fsrs.totalReviews} reviews analyzed`}
          icon={Activity}
          color={brierColor}
        />
        <KPICard
          label="Expected Cal. Error"
          value={data.fsrs.ece.toFixed(3)}
          subtext="Lower is better (0 = perfect)"
          icon={BarChart3}
          color={eceColor}
        />
        <KPICard
          label="Direction"
          value={data.fsrs.direction === 'calibrated' ? 'Calibrated' :
            data.fsrs.direction === 'overconfident' ? 'Over' : 'Under'}
          subtext={`Bias: ${data.fsrs.meanBias > 0 ? '+' : ''}${(data.fsrs.meanBias * 100).toFixed(1)}%`}
          icon={data.fsrs.direction === 'overconfident' ? TrendingUp :
            data.fsrs.direction === 'underconfident' ? TrendingDown : Target}
          color={data.fsrs.direction === 'calibrated' ? 'var(--color-data-pass)' :
            data.fsrs.direction === 'overconfident' ? '#ef4444' : '#3b82f6'}
        />
      </div>

      {/* Reliability Diagrams — Side by Side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={{
          background: 'var(--color-bg-secondary)',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
          padding: 16,
        }}>
          <ReliabilityDiagram
            bins={data.fsrs.reliabilityBins}
            title="FSRS Model Calibration"
            accentColor="var(--color-accent)"
          />
        </div>
        <div style={{
          background: 'var(--color-bg-secondary)',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
          padding: 16,
        }}>
          <ReliabilityDiagram
            bins={data.metacognitive.reliabilityBins}
            title="Metacognitive Calibration"
            accentColor="#8b5cf6"
          />
        </div>
      </div>

      {/* Weekly Trend */}
      <div style={{
        background: 'var(--color-bg-secondary)',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        padding: 16,
        marginBottom: 24,
      }}>
        <CalibrationTrendChart trend={data.weeklyTrend} />
      </div>

      {/* Per-Domain Breakdown */}
      <div style={{
        background: 'var(--color-bg-secondary)',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        padding: 16,
      }}>
        <h3 style={{
          fontSize: 14,
          fontWeight: 600,
          fontFamily: FONT_HEADING,
          color: 'var(--color-text-primary)',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Target size={16} />
          Per-Domain Calibration (PANCE Blueprint)
        </h3>
        <DomainBreakdownTable domains={data.domainBreakdown} />
      </div>
    </div>
  );
}
