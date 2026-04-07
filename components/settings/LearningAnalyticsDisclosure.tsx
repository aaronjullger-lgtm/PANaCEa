/**
 * LearningAnalyticsDisclosure — Privacy disclosure for CRPL behavioral telemetry
 *
 * Provides a clear, student-friendly explanation of what behavioral data
 * PANaCEa collects during study sessions and how it's used to personalize
 * the spaced repetition schedule (FSRS).
 *
 * Required by Phase 3 of the architecture roadmap. This component satisfies
 * the "privacy disclosure for CRPL telemetry data collection" task.
 *
 * Placement: EnhancedSettingsTab, between DataExport and the Info Tip.
 *
 * @module components/settings/LearningAnalyticsDisclosure
 */

import React, { useState } from 'react';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  Activity,
  Clock,
  MousePointerClick,
  BarChart3,
} from 'lucide-react';

// ── Telemetry categories shown to the user ─────────────────────────────────

interface TelemetryItem {
  icon: React.ElementType;
  label: string;
  description: string;
  examples: string;
}

const TELEMETRY_ITEMS: TelemetryItem[] = [
  {
    icon: Clock,
    label: 'Response timing',
    description:
      'How long you take to answer each question, including time to first interaction.',
    examples: 'e.g., "answered in 8.2 seconds"',
  },
  {
    icon: MousePointerClick,
    label: 'Answer selection patterns',
    description:
      'Whether you changed your answer before submitting and how many times.',
    examples: 'e.g., "switched answers 2 times"',
  },
  {
    icon: Activity,
    label: 'Interaction confidence signals',
    description:
      'Aggregated measures of decisiveness: time between selecting and confirming your answer, revisits between options, and whether you viewed a hint before answering.',
    examples: 'e.g., "high decisiveness", "showed hesitation", or "viewed hint for 5s"',
  },
  {
    icon: BarChart3,
    label: 'Session-level summaries',
    description:
      'How many questions you completed per session, session duration, and time of day.',
    examples: 'e.g., "studied 25 questions over 40 minutes at 9 AM"',
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function LearningAnalyticsDisclosure() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
        aria-controls="analytics-disclosure-content"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Learning Analytics & Privacy
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              How your study behavior personalizes your review schedule
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
        )}
      </button>

      {/* Expandable content */}
      {expanded && (
        <div
          id="analytics-disclosure-content"
          className="mt-4 space-y-4"
        >
          {/* Summary paragraph */}
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            PANaCEa collects <strong>learning analytics</strong> during study
            sessions to personalize your spaced repetition schedule. Instead of
            asking you to self-rate how well you knew each answer, we measure
            behavioral signals to automatically determine review intervals. All
            data is stored as <strong>aggregated metrics</strong> (computed
            numbers like response time in milliseconds), never raw interaction
            streams.
          </p>

          {/* What we collect */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              What we measure
            </h4>
            {TELEMETRY_ITEMS.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <item.icon className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-[var(--color-text-primary)]">
                    <strong>{item.label}</strong>
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {item.description}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] italic">
                    {item.examples}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* How it's used */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              How it's used
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              These signals feed into the FSRS spaced repetition algorithm to
              calculate when you should next review each topic. Confident, fast
              responses push the next review further out; hesitant responses
              bring it closer. The system also detects rapid guesses (responses
              too fast to reflect real knowledge) and excludes them from
              scheduling.
            </p>
          </div>

          {/* What we don't collect */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              What we don't collect
            </h4>
            <ul className="text-sm text-[var(--color-text-secondary)] space-y-1 list-disc list-inside">
              <li>Raw mouse movement or cursor position data</li>
              <li>Keystroke logging or screen recordings</li>
              <li>Data from outside study sessions</li>
              <li>Personally identifiable browsing behavior</li>
            </ul>
          </div>

          {/* Data control note */}
          <div className="p-3 bg-[var(--color-accent)]/5 rounded-md border border-[var(--color-accent)]/15">
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Your learning data is tied to your account and used solely to
              improve <em>your</em> study schedule. You can export all your data
              using the Data Export section above. Aggregated, anonymized
              statistics may be used to improve the scheduling algorithm for all
              users.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
