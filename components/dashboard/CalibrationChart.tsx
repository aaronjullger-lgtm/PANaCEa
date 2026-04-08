/**
 * CalibrationChart — Metacognitive Feedback Dashboard
 *
 * Displays the student's calibration curve: how well their implicit confidence
 * predicts actual retention on subsequent reviews.
 *
 * Research basis:
 * - Dunlosky et al. (2013): Metacognitive monitoring accuracy improves with feedback
 * - Carpenter et al. (2016): Calibration feedback helps learners adjust study strategies
 * - Koriat & Bjork (2005): Learners who see their calibration curve make better JOLs
 *
 * Visual: A 5-bucket calibration chart showing predicted vs actual retention,
 * with a diagonal "perfect calibration" reference line.
 *
 * Data source: GET /api/user/calibration → UserCalibration from calibrationService
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { TOOLTIP_CALIBRATION } from '@/lib/constants/copy';

interface CalibrationBucket {
  confidenceRange: [number, number];
  predictedRetention: number;
  actualRetention: number;
  count: number;
}

interface CalibrationData {
  brierScore: number;
  calibrationSlope: number;
  buckets: CalibrationBucket[];
  dampenerFactor: number;
  n: number;
}

type CalibrationStatus = 'well-calibrated' | 'overconfident' | 'underconfident' | 'insufficient-data';

function getCalibrationStatus(data: CalibrationData): CalibrationStatus {
  if (data.n < 30) return 'insufficient-data';
  if (data.calibrationSlope >= 0.8 && data.calibrationSlope <= 1.2 && data.brierScore < 0.25) {
    return 'well-calibrated';
  }
  return data.calibrationSlope < 0.8 ? 'overconfident' : 'underconfident';
}

const STATUS_MESSAGES: Record<CalibrationStatus, { title: string; description: string; color: string }> = {
  'well-calibrated': {
    title: 'Well Calibrated',
    description: 'Your confidence aligns well with your actual performance. Keep it up!',
    color: 'text-[var(--color-data-pass)]',
  },
  'overconfident': {
    title: 'Slightly Overconfident',
    description: 'You tend to feel more confident than your performance warrants. The system is adjusting your review schedule to compensate.',
    color: 'text-[var(--color-data-provisional)]',
  },
  'underconfident': {
    title: 'Slightly Underconfident',
    description: 'You perform better than your behavior suggests! The system is giving you credit for your actual knowledge.',
    color: 'text-[var(--color-accent)]',
  },
  'insufficient-data': {
    title: 'Building Your Profile',
    description: 'We need about 30 more review pairs to calibrate your confidence profile. Keep studying!',
    color: 'text-[var(--color-text-muted)]',
  },
};

export default function CalibrationChart() {
  const { getToken } = useAuth();
  const [data, setData] = useState<CalibrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalibration = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/user/calibration', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch calibration data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchCalibration(); }, [fetchCalibration]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 animate-pulse">
        <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-1/3 mb-4" />
        <div className="h-48 bg-[var(--color-bg-tertiary)] rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <p className="text-sm text-[var(--color-text-muted)]">Unable to load calibration data.</p>
      </div>
    );
  }

  const status = getCalibrationStatus(data);
  const statusInfo = STATUS_MESSAGES[status];
  const bucketsWithData = data.buckets.filter(b => b.count > 0);

  return (
    <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-4">
        <span className="flex items-center gap-1.5">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Metacognitive Calibration</h3>
          <InfoTooltip text={TOOLTIP_CALIBRATION} />
        </span>
        <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.title}</span>
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{statusInfo.description}</p>

      {status !== 'insufficient-data' && bucketsWithData.length > 0 && (
        <>
          {/* Bar chart: predicted vs actual per bucket */}
          <div className="space-y-3 mb-4">
            {bucketsWithData.map((bucket, idx) => {
              const label = `${Math.round(bucket.confidenceRange[0] * 100)}–${Math.round(bucket.confidenceRange[1] * 100)}%`;
              const predicted = bucket.predictedRetention;
              const actual = bucket.actualRetention;
              const isOverconfident = predicted > actual + 0.05;
              const isUnderconfident = actual > predicted + 0.05;

              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-right" style={{ color: 'var(--color-text-muted)', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontVariantNumeric: 'tabular-nums' }}>{label}</span>
                  <div className="flex-1 relative h-6">
                    {/* Predicted (background) */}
                    <div
                      className="absolute inset-y-0 left-0 rounded"
                      style={{ width: `${Math.round(predicted * 100)}%`, backgroundColor: 'var(--color-bg-tertiary, #e2e8f0)' }}
                    />
                    {/* Actual (overlay) */}
                    <div
                      className="absolute inset-y-0 left-0 rounded"
                      style={{
                        width: `${Math.round(actual * 100)}%`,
                        opacity: 0.8,
                        backgroundColor: isOverconfident
                          ? 'var(--color-data-provisional)'
                          : isUnderconfident
                          ? 'var(--color-accent)'
                          : 'var(--color-data-pass)',
                      }}
                    />
                    {/* Count label */}
                    <span className="absolute right-2 top-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      n={bucket.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary, #e2e8f0)' }} />
              <span>Expected</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-data-pass, #34d399)' }} />
              <span>Actual</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'var(--color-border)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Brier Score</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontVariantNumeric: 'tabular-nums' }}>
                {data.brierScore.toFixed(3)}
                <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)', fontFamily: "'Inter', system-ui, sans-serif" }}>(0 = perfect)</span>
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cal. Slope</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontVariantNumeric: 'tabular-nums' }}>
                {data.calibrationSlope.toFixed(2)}
                <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)', fontFamily: "'Inter', system-ui, sans-serif" }}>(1.0 = ideal)</span>
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Review Pairs</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontVariantNumeric: 'tabular-nums' }}>{data.n}</p>
            </div>
          </div>
        </>
      )}

      {status === 'insufficient-data' && (
        <div className="flex items-center justify-center h-32 rounded-lg" style={{ backgroundColor: 'var(--color-bg-tertiary, #f8fafc)' }}>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--color-text-muted)' }}>{data.n}/30</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>review pairs collected</p>
          </div>
        </div>
      )}
    </div>
  );
}
