/**
 * Phantom Patient Card
 *
 * Displays the "phantom patient" whose health reflects user study activity.
 * Provides subtle motivation through visual presence on dashboard.
 */

import React from 'react';
import { Heart, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import type { PhantomPatient } from '@/types/interface-fabric-system';

interface PhantomPatientCardProps {
  patient: PhantomPatient | null;
  className?: string;
}

export function PhantomPatientCard({ patient, className = '' }: PhantomPatientCardProps) {
  if (!patient) {
    return (
      <div
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 ${className}`}
      >
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Your Patient</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Complete your first session to meet your patient!
        </p>
      </div>
    );
  }

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-data-pass';
    if (health >= 60) return 'text-[var(--color-category-practice)]';
    if (health >= 40) return 'text-data-provisional';
    return 'text-[var(--color-data-fail)]';
  };

  const getHealthBgColor = (health: number) => {
    if (health >= 80) return 'bg-data-pass';
    if (health >= 60) return 'bg-[var(--color-category-practice)]';
    if (health >= 40) return 'bg-data-provisional';
    return 'bg-[var(--color-data-fail)]/100';
  };

  const getStatusMessage = (status: PhantomPatient['status']) => {
    switch (status) {
      case 'healthy':
        return { message: 'Doing great!' };
      case 'stable':
        return { message: 'Stable' };
      case 'declining':
        return { message: 'Not feeling well' };
      case 'critical':
        return { message: 'Needs your help!' };
      case 'recovered':
        return { message: 'Fully recovered!' };
    }
  };

  const statusInfo = getStatusMessage(patient.status);
  const healthTrend = patient.daysSinceInteraction === 0 ? 'up' : 'down';

  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {patient.name || 'Your Patient'}
          </h3>
        </div>
        <div className="text-2xl">
          <Heart
            className={`w-8 h-8 ${
              patient.status === 'recovered'
                ? 'text-[var(--color-data-pass)]'
                : patient.status === 'critical' || patient.status === 'declining'
                  ? 'text-[var(--color-data-fail)]'
                  : 'text-[var(--color-text-muted)]'
            }`}
          />
        </div>
      </div>

      {/* Video Player (if available) */}
      {patient.videoUrl && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <video
            src={patient.videoUrl}
            loop
            muted
            autoPlay
            playsInline
            className="w-full h-32 object-cover"
          />
        </div>
      )}

      {/* Health Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--color-text-muted)]">Health</span>
          <span className={`text-sm font-bold ${getHealthColor(patient.healthState)}`}>
            {patient.healthState}%
          </span>
        </div>
        <div className="w-full h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div
            className={`h-full ${getHealthBgColor(patient.healthState)} transition-all duration-500`}
            style={{ width: `${patient.healthState}%` }}
          />
        </div>
      </div>

      {/* Status Message */}
      <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] mb-3">
        <div className="text-sm text-[var(--color-text-secondary)]">
          {patient.message || statusInfo.message}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>
            {patient.daysSinceInteraction === 0
              ? 'Last session: Today'
              : `${patient.daysSinceInteraction} day${patient.daysSinceInteraction > 1 ? 's' : ''} ago`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {healthTrend === 'up' ? (
            <TrendingUp className="w-3 h-3 text-data-pass" />
          ) : (
            <TrendingDown className="w-3 h-3 text-[var(--color-data-fail)]" />
          )}
          <span>{healthTrend === 'up' ? 'Improving' : 'Declining'}</span>
        </div>
      </div>

      {/* Condition Label */}
      <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
        <div className="text-xs text-[var(--color-text-muted)]">
          Condition: <span className="text-[var(--color-text-secondary)]">{patient.condition}</span>
        </div>
      </div>
    </div>
  );
}
