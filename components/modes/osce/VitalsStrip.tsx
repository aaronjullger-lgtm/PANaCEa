/**
 * VitalsStrip — Compact real-time vitals display with mini sparklines.
 *
 * Renders a horizontal strip of vital signs, each with:
 *  - Current value (color-coded: white=normal, amber=warning, red=critical)
 *  - Mini sparkline of recent readings (last 10 from useVitalsEngine history)
 *  - Monospace font for clinical readability
 *  - CSS-only pulse animation on HR synced to current rate
 */
import React, { useMemo } from 'react';
import { Heart, Wind, Droplets, Activity } from 'lucide-react';

interface VitalReading {
  label: string;
  value: string;
  unit: string;
  history: number[];
  status: 'normal' | 'warning' | 'critical';
  icon: React.ReactNode;
}

interface VitalsStripProps {
  hr: number;
  sbp: number;
  dbp: number;
  rr: number;
  o2: number;
  /** History arrays from useVitalsEngine (last N readings) */
  hrHistory?: number[];
  sbpHistory?: number[];
  rrHistory?: number[];
  o2History?: number[];
}

function getHrStatus(hr: number): 'normal' | 'warning' | 'critical' {
  if (hr < 50 || hr > 130) return 'critical';
  if (hr < 60 || hr > 100) return 'warning';
  return 'normal';
}

function getBpStatus(sbp: number, dbp: number): 'normal' | 'warning' | 'critical' {
  if (sbp > 180 || sbp < 80 || dbp > 120 || dbp < 50) return 'critical';
  if (sbp > 140 || sbp < 90 || dbp > 90 || dbp < 60) return 'warning';
  return 'normal';
}

function getRrStatus(rr: number): 'normal' | 'warning' | 'critical' {
  if (rr < 8 || rr > 30) return 'critical';
  if (rr < 12 || rr > 20) return 'warning';
  return 'normal';
}

function getO2Status(o2: number): 'normal' | 'warning' | 'critical' {
  if (o2 < 88) return 'critical';
  if (o2 < 92) return 'warning';
  return 'normal';
}

const STATUS_COLORS = {
  normal: 'text-white',
  warning: 'text-amber-400',
  critical: 'text-red-400',
} as const;

const STATUS_BG = {
  normal: '',
  warning: 'bg-amber-500/10',
  critical: 'bg-red-500/10',
} as const;

/** Tiny inline sparkline rendered with SVG path — no dependencies */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const recent = data.slice(-10);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min || 1;
  const w = 48;
  const h = 16;
  const points = recent.map((v, i) => {
    const x = (i / (recent.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  });
  const d = `M${points.join(' L')}`;
  return (
    <svg width={w} height={h} className="opacity-60" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const VitalsStrip: React.FC<VitalsStripProps> = React.memo(({
  hr, sbp, dbp, rr, o2,
  hrHistory = [], sbpHistory = [], rrHistory = [], o2History = [],
}) => {
  const vitals: VitalReading[] = useMemo(() => [
    {
      label: 'HR',
      value: String(Math.round(hr)),
      unit: 'bpm',
      history: hrHistory,
      status: getHrStatus(hr),
      icon: <Heart className="w-3.5 h-3.5" />,
    },
    {
      label: 'BP',
      value: `${Math.round(sbp)}/${Math.round(dbp)}`,
      unit: 'mmHg',
      history: sbpHistory,
      status: getBpStatus(sbp, dbp),
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    {
      label: 'RR',
      value: String(Math.round(rr)),
      unit: '/min',
      history: rrHistory,
      status: getRrStatus(rr),
      icon: <Wind className="w-3.5 h-3.5" />,
    },
    {
      label: 'SpO2',
      value: `${Math.round(o2)}%`,
      unit: '',
      history: o2History,
      status: getO2Status(o2),
      icon: <Droplets className="w-3.5 h-3.5" />,
    },
  ], [hr, sbp, dbp, rr, o2, hrHistory, sbpHistory, rrHistory, o2History]);

  // CSS pulse animation duration synced to heart rate (60bpm = 1s, 120bpm = 0.5s)
  const pulseDuration = hr > 0 ? 60 / hr : 1;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      {vitals.map((vital) => {
        const sparkColor = vital.status === 'critical' ? '#f87171'
          : vital.status === 'warning' ? '#fbbf24'
          : '#94a3b8';

        return (
          <div
            key={vital.label}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 ${STATUS_BG[vital.status]} transition-colors duration-300`}
          >
            <span className={`${STATUS_COLORS[vital.status]} opacity-70`}>{vital.icon}</span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                {vital.label}
              </span>
              <span
                className={`font-mono text-sm font-bold ${STATUS_COLORS[vital.status]} tabular-nums`}
                style={vital.label === 'HR' ? {
                  animation: `pulse ${pulseDuration}s ease-in-out infinite`,
                } : undefined}
              >
                {vital.value}
                {vital.unit && (
                  <span className="text-[9px] font-normal opacity-60 ml-0.5">{vital.unit}</span>
                )}
              </span>
            </div>
            <MiniSparkline data={vital.history} color={sparkColor} />
          </div>
        );
      })}

      {/* CSS-only keyframe for HR pulse — injected once */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
});

VitalsStrip.displayName = 'VitalsStrip';
