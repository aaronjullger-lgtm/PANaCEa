/**
 * Smart Condition Page: Card-based UI from structured JSON (clinical_pearls, history, physical,
 * diagnostic_labs, gold_standard, treatment_first_line). Hide/reveal for treatment (active recall).
 * Deep links: drug/treatment terms open pharmacology or reference panel.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Stethoscope,
  FlaskConical,
  Pill,
  Lightbulb,
  History,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

export interface ConditionStructuredData {
  clinical_pearls: string[];
  history_key_features: string[];
  physical_exam_findings: string[];
  diagnostic_labs: string[];
  gold_standard: string;
  treatment_first_line: string;
}

interface ConditionStructuredCardsProps {
  conditionId: string;
  getToken?: () => Promise<string | null>;
  /** Open pharmacology/reference panel for a term (e.g. drug name). */
  onDeepLink?: (term: string, type: 'drug' | 'treatment' | 'lab') => void;
  className?: string;
}

const CARD_ICONS = {
  clinical_pearls: Lightbulb,
  history_key_features: History,
  physical_exam_findings: Stethoscope,
  diagnostic_labs: FlaskConical,
  gold_standard: Target,
  treatment_first_line: Pill,
} as const;

export function ConditionStructuredCards({
  conditionId,
  getToken,
  onDeepLink,
  className = '',
}: ConditionStructuredCardsProps) {
  const [data, setData] = useState<ConditionStructuredData | null>(null);
  const [loading, setLoading] = useState(true);
  const [treatmentRevealed, setTreatmentRevealed] = useState(false);
  const [mnemonicUrl, setMnemonicUrl] = useState<string | null>(null);
  const [mnemonicLoading, setMnemonicLoading] = useState(false);

  const fetchStructured = useCallback(async () => {
    if (!conditionId) return;
    setLoading(true);
    try {
      const token = getToken ? await getToken() : null;
      const url = getApiEndpoint(`/api/conditions/${encodeURIComponent(conditionId)}/structured`);
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: ConditionStructuredData | null };
        setData(json.data ?? null);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [conditionId, getToken]);

  useEffect(() => {
    fetchStructured();
  }, [fetchStructured]);

  const handleGenerateMnemonic = useCallback(async () => {
    if (!conditionId) return;
    setMnemonicLoading(true);
    try {
      const token = getToken ? await getToken() : null;
      const url = getApiEndpoint(`/api/conditions/${encodeURIComponent(conditionId)}/mnemonic`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          keySymptom: data?.clinical_pearls?.[0] ?? conditionId.replace(/-/g, ' '),
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: { imageUrl?: string } };
        const urlFromApi = json.data?.imageUrl;
        if (typeof urlFromApi === 'string' && urlFromApi.startsWith('http'))
          setMnemonicUrl(urlFromApi);
      }
    } catch {
      // ignore
    } finally {
      setMnemonicLoading(false);
    }
  }, [conditionId, data?.clinical_pearls, getToken]);

  const linkify = (text: string, type: 'drug' | 'treatment' | 'lab') => {
    if (!onDeepLink) return text;
    const words = text.split(/(\s+)/);
    return words.map((word, i) => {
      const clean = word.replace(/[,.]/g, '');
      const isDrug =
        type === 'drug' &&
        /^(beta\s*blockers?|ace\s*inhibitors?|statins?|metformin|insulin|aspirin|warfarin|amoxicillin|etc\.?)$/i.test(
          clean
        );
      const isTreatment = type === 'treatment' && clean.length > 3;
      if (isDrug || (isTreatment && clean.length > 4)) {
        return (
          <button
            key={i}
            type="button"
            onClick={() => onDeepLink(clean, type)}
            className="text-[var(--color-accent)] hover:underline font-medium inline-flex items-center gap-0.5"
          >
            {word}
            <ExternalLink className="w-3 h-3 inline" />
          </button>
        );
      }
      return <span key={i}>{word}</span>;
    });
  };

  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`} aria-busy="true">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 rounded-xl bg-slate-700/30 animate-pulse border border-[var(--color-border)]"
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards: {
    key: keyof ConditionStructuredData;
    title: string;
    items?: string[];
    single?: string;
  }[] = [
    { key: 'clinical_pearls', title: 'Clinical Pearls', items: data.clinical_pearls },
    {
      key: 'history_key_features',
      title: 'History Key Features',
      items: data.history_key_features,
    },
    {
      key: 'physical_exam_findings',
      title: 'Physical Exam Findings',
      items: data.physical_exam_findings,
    },
    { key: 'diagnostic_labs', title: 'Diagnostic Labs', items: data.diagnostic_labs },
    { key: 'gold_standard', title: 'Gold Standard Dx', single: data.gold_standard },
    {
      key: 'treatment_first_line',
      title: 'First-Line Treatment',
      single: data.treatment_first_line,
    },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Mnemonic: generate if missing (Firefly) */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
        {mnemonicUrl ? (
          <img
            src={mnemonicUrl}
            alt={`Visual mnemonic for ${conditionId}`}
            className="w-full max-h-64 object-contain rounded-lg bg-[var(--color-bg-primary)]"
          />
        ) : (
          <button
            type="button"
            onClick={handleGenerateMnemonic}
            disabled={mnemonicLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
          >
            {mnemonicLoading ? (
              'Generating…'
            ) : (
              <>
                <Lightbulb className="w-4 h-4" />
                Generate visual mnemonic (Firefly)
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(({ key, title, items, single }) => {
          const Icon = CARD_ICONS[key];
          const isTreatment = key === 'treatment_first_line';
          const isHidden = isTreatment && !treatmentRevealed;
          const content = single ?? (items && items.length > 0 ? items : null);

          if (!content && (!items || items.length === 0)) return null;

          return (
            <div
              key={key}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-card-bg)]">
                <h3 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  {Icon && <Icon className="w-4 h-4 text-[var(--color-accent)]" />}
                  {title}
                </h3>
                {isTreatment && (
                  <button
                    type="button"
                    onClick={() => setTreatmentRevealed((v) => !v)}
                    className="flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
                    aria-label={treatmentRevealed ? 'Hide treatment' : 'Reveal treatment'}
                  >
                    {treatmentRevealed ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    {treatmentRevealed ? 'Hide' : 'Reveal'}
                  </button>
                )}
              </div>
              <div
                className={`px-4 py-3 text-sm text-[var(--color-text-primary)] ${
                  isHidden ? 'select-none blur-md transition-all duration-300' : ''
                }`}
              >
                {single ? (
                  <p className="leading-relaxed">
                    {key === 'treatment_first_line' ? linkify(single, 'treatment') : single}
                  </p>
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    {(items ?? []).map((item, i) => (
                      <li key={i}>
                        {key === 'diagnostic_labs'
                          ? linkify(item, 'lab')
                          : key === 'treatment_first_line'
                            ? linkify(item, 'treatment')
                            : item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
