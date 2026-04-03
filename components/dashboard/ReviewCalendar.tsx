/**
 * ReviewCalendar — 7-day spaced retrieval forecast strip.
 *
 * Shows daily review card counts with color-coded intensity,
 * overdue badge, and expandable per-system breakdown on tap.
 * Helps students plan study time around clinical rotations.
 *
 * @see hooks/useReviewForecast.ts
 * @see functions/api/analytics/review-forecast.ts
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, AlertCircle, ChevronDown } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { ForecastDay } from '@/hooks/useReviewForecast';

interface ReviewCalendarProps {
  overdue: number;
  today: number;
  forecast: ForecastDay[];
  totalActive: number;
  className?: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Map card count to intensity level for color coding.
 * light (<10), medium (10-30), heavy (30+)
 */
function getIntensity(count: number): 'none' | 'light' | 'medium' | 'heavy' {
  if (count === 0) return 'none';
  if (count < 10) return 'light';
  if (count < 30) return 'medium';
  return 'heavy';
}

const INTENSITY_STYLES: Record<string, { bg: string; text: string }> = {
  none: {
    bg: 'var(--color-bg-tertiary)',
    text: 'var(--color-text-muted)',
  },
  light: {
    bg: 'color-mix(in srgb, var(--color-data-pass) 20%, var(--color-bg-secondary))',
    text: 'var(--color-data-pass)',
  },
  medium: {
    bg: 'color-mix(in srgb, var(--color-accent) 25%, var(--color-bg-secondary))',
    text: 'var(--color-accent)',
  },
  heavy: {
    bg: 'color-mix(in srgb, var(--color-data-provisional) 25%, var(--color-bg-secondary))',
    text: 'var(--color-data-provisional)',
  },
};

export function ReviewCalendar({
  overdue,
  today,
  forecast,
  totalActive,
  className = '',
}: ReviewCalendarProps) {
  const prefersReducedMotion = useReducedMotion();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div
      className={`p-4 rounded-xl border ${className}`}
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar
            className="w-4 h-4"
            style={{ color: 'var(--color-accent)' }}
          />
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Review Forecast
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {overdue > 0 && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-data-fail) 15%, var(--color-bg-secondary))',
                color: 'var(--color-data-fail)',
              }}
            >
              <AlertCircle className="w-3 h-3" />
              {overdue} overdue
            </span>
          )}
          <span>{totalActive} active cards</span>
        </div>
      </div>

      {/* 7-day strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {forecast.map((day, i) => {
          const date = new Date(day.date + 'T00:00:00Z');
          const dayName = DAY_NAMES[date.getUTCDay()];
          const dayNum = date.getUTCDate();
          const isToday = day.date === todayStr;
          const intensity = getIntensity(day.count);
          const styles = INTENSITY_STYLES[intensity];
          const isExpanded = expandedDay === day.date;

          return (
            <button
              key={day.date}
              onClick={() =>
                setExpandedDay(isExpanded ? null : day.count > 0 ? day.date : null)
              }
              className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                isToday ? 'ring-2 ring-[var(--color-accent)]' : ''
              } ${day.count > 0 ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              style={{
                backgroundColor: styles.bg,
              }}
              aria-label={`${dayName} ${dayNum}: ${day.count} cards due${isToday ? ' (today)' : ''}`}
              title={`${day.count} cards due`}
            >
              <span
                className="text-[10px] font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {dayName}
              </span>
              <span
                className="text-lg font-bold leading-tight"
                style={{ color: styles.text }}
              >
                {day.count}
              </span>
              <span
                className="text-[10px]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {dayNum}
              </span>
              {day.count > 0 && day.systems && day.systems.length > 0 && (
                <ChevronDown
                  className={`w-3 h-3 mt-0.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--color-text-muted)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded day detail */}
      <AnimatePresence>
        {expandedDay && (() => {
          const dayData = forecast.find((d) => d.date === expandedDay);
          if (!dayData?.systems?.length) return null;

          const date = new Date(expandedDay + 'T00:00:00Z');
          const label = expandedDay === todayStr
            ? 'Today'
            : DAY_NAMES[date.getUTCDay()] + ' ' + date.getUTCDate();

          return (
            <motion.div
              key={expandedDay}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="mt-3 p-3 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {label}: {dayData.count} cards
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dayData.systems.map(({ system, count }) => (
                    <span
                      key={system}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {system}
                      <span
                        className="font-bold"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        {count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: INTENSITY_STYLES.light.bg }}
          />
          &lt;10
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: INTENSITY_STYLES.medium.bg }}
          />
          10-30
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: INTENSITY_STYLES.heavy.bg }}
          />
          30+
        </span>
      </div>
    </div>
  );
}

export default ReviewCalendar;
