/**
 * TriageCard - Single item in the Content Refinery inbox (draft, media, or question).
 * Media variant: image from raw vault (signed URL), Classic Portrayal switch,
 * Modality, Correct Diagnosis autocomplete, License confirmation, Approve/Reject.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Image, HelpCircle, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

export type RefineryItemType = 'content' | 'media' | 'question';

export interface RefineryItem {
  type: RefineryItemType;
  id: string;
  timestamp: string;
  data: Record<string, unknown> & {
    SourceMaterial?: { sourceName?: string } | null;
    condition?: string;
    overview?: string | null;
    thumbnailUrl?: string | null;
    originalUrl?: string | null;
    licenseType?: string | null;
    vignette?: string;
    question?: string;
    rawStoragePath?: string | null;
    filename?: string | null;
    attribution?: string | null;
    isClassicPortrayal?: boolean | null;
    modality?: string | null;
    correctDiagnosis?: string | null;
  };
}

/** Payload sent when approving a media item (Classic triage). */
export interface MediaApprovePayload {
  isClassicPortrayal?: boolean;
  modality?: string;
  correctDiagnosis?: string;
  conditionId?: string;
  licenseType?: string;
}

interface TriageCardProps {
  readonly item: RefineryItem;
  readonly onAction: (
    id: string,
    action: 'approve' | 'reject',
    payload?: MediaApprovePayload
  ) => void;
  readonly actionLoading?: boolean;
}

const PREVIEW_MAX = 120;
const MODALITY_OPTIONS = ['ECG', 'Derm', 'X-Ray'] as const;
const LICENSE_OPTIONS = ['PROPRIETARY_REFERENCE', 'CC-BY-SA', 'CC-BY', 'CC0', 'Other'] as const;

function truncate(text: string | null | undefined, max: number): string {
  if (!text || typeof text !== 'string') return '';
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, max).trim() + '…';
}

function formatDate(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

function TypeBadge({ type }: { type: RefineryItemType }) {
  const config = {
    content: {
      label: 'Content',
      icon: BookOpen,
      className:
        'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/40',
    },
    media: {
      label: 'Media',
      icon: Image,
      className: 'bg-data-provisional/20 text-data-provisional border-data-provisional/40',
    },
    question: {
      label: 'Question',
      icon: HelpCircle,
      className: 'bg-violet-500/20 text-violet-400 border-violet-500/40',
    },
  }[type];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${config.className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function sourceName(item: RefineryItem): string {
  if (item.type === 'content' && item.data.SourceMaterial) {
    const name = (item.data.SourceMaterial as { sourceName?: string }).sourceName;
    if (typeof name === 'string') return name;
  }
  if (item.type === 'media' && item.data.SourceMaterial) {
    const name = (item.data.SourceMaterial as { sourceName?: string }).sourceName;
    if (typeof name === 'string') return name;
  }
  if (
    item.type === 'media' &&
    item.data.attribution !== undefined &&
    item.data.attribution !== null
  ) {
    const att = item.data.attribution;
    return typeof att === 'string' ? att : '—';
  }
  return '—';
}

export const TriageCard: React.FC<Readonly<TriageCardProps>> = ({
  item,
  onAction,
  actionLoading = false,
}) => {
  const { getToken } = useAuth();
  const dateStr = formatDate(item.timestamp);
  const source = sourceName(item);

  // Media triage state (only used when item.type === 'media')
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isClassicPortrayal, setIsClassicPortrayal] = useState(
    typeof item.data.isClassicPortrayal === 'boolean' ? item.data.isClassicPortrayal : false
  );
  const [modality, setModality] = useState<string>(
    typeof item.data.modality === 'string' ? item.data.modality : ''
  );
  const [correctDiagnosis, setCorrectDiagnosis] = useState<string>(
    typeof item.data.correctDiagnosis === 'string' ? item.data.correctDiagnosis : ''
  );
  const [conditionId, setConditionId] = useState<string | undefined>(undefined);
  const [licenseType, setLicenseType] = useState<string>(
    typeof item.data.licenseType === 'string' ? item.data.licenseType : ''
  );
  const [conditionSearchQuery, setConditionSearchQuery] = useState('');
  const [conditionSearchResults, setConditionSearchResults] = useState<
    { id: string; condition: string }[]
  >([]);
  const [conditionSearchOpen, setConditionSearchOpen] = useState(false);

  const rawPath =
    item.type === 'media' && typeof item.data.rawStoragePath === 'string'
      ? item.data.rawStoragePath
      : null;

  useEffect(() => {
    if (!rawPath || item.type !== 'media') return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/admin/refinery/media-signed-url?path=${encodeURIComponent(rawPath)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        const json: unknown = await res.json();
        if (cancelled) return;
        const data = json as { data?: { url?: string } };
        if (res.ok && data?.data?.url) {
          setSignedImageUrl(data.data.url);
          setImageLoadError(false);
        } else {
          setImageLoadError(true);
        }
      } catch {
        if (!cancelled) setImageLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawPath, item.type, getToken]);

  const searchConditions = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setConditionSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/conditions/search?q=${encodeURIComponent(trimmed)}&limit=10`);
      const json: unknown = await res.json();
      const data = json as { data?: Array<{ id: string; condition: string }> };
      const list = Array.isArray(data?.data) ? data.data : [];
      setConditionSearchResults(
        list.map((r: { id: string; condition: string }) => ({ id: r.id, condition: r.condition }))
      );
    } catch {
      setConditionSearchResults([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      searchConditions(conditionSearchQuery);
    }, 200);
    return () => clearTimeout(t);
  }, [conditionSearchQuery, searchConditions]);

  const handleApprove = () => {
    if (item.type === 'media') {
      onAction(item.id, 'approve', {
        isClassicPortrayal,
        modality: modality || undefined,
        correctDiagnosis: correctDiagnosis || undefined,
        conditionId: conditionId || undefined,
        licenseType: licenseType || undefined,
      });
    } else {
      onAction(item.id, 'approve');
    }
  };

  function renderMediaPreview(): React.ReactNode {
    if (signedImageUrl) {
      return (
        <img
          src={signedImageUrl}
          alt=""
          className="w-full h-full object-contain"
          onError={() => setImageLoadError(true)}
        />
      );
    }
    if (imageLoadError) {
      return (
        <span className="text-xs text-[var(--color-text-muted)] p-2 text-center">
          Image unavailable
        </span>
      );
    }
    return <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" aria-hidden />;
  }

  return (
    <article
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden flex flex-col"
      data-refinery-id={item.id}
      data-refinery-type={item.type}
    >
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={item.type} />
          <span className="text-sm text-[var(--color-text-muted)]">{source}</span>
          <span className="text-xs text-[var(--color-text-muted)] ml-auto">{dateStr}</span>
        </div>
      </div>

      <div className="p-4 flex-1 min-h-0 space-y-4">
        {item.type === 'content' && (
          <>
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
              {(item.data.condition as string) ?? 'Untitled'}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] line-clamp-3">
              Overview: {truncate(item.data.overview as string, PREVIEW_MAX) || '—'}
            </p>
          </>
        )}
        {item.type === 'media' && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-40 h-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden flex items-center justify-center">
                {renderMediaPreview()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-text-primary)] truncate font-medium">
                  {(item.data.filename as string) ?? item.id}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  License: {(item.data.licenseType as string) ?? '—'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isClassicPortrayal}
                  onChange={(e) => setIsClassicPortrayal(e.target.checked)}
                  className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
                <span className="text-[var(--color-text-primary)]">Is Classic Portrayal?</span>
              </label>

              <div>
                <span className="text-[var(--color-text-muted)] block mb-1">Modality</span>
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                  aria-label="Modality"
                >
                  <option value="">—</option>
                  {MODALITY_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <span className="text-[var(--color-text-muted)] block mb-1">Correct Diagnosis</span>
                <input
                  type="text"
                  value={conditionSearchQuery || correctDiagnosis}
                  onChange={(e) => {
                    setConditionSearchQuery(e.target.value);
                    setConditionSearchOpen(true);
                  }}
                  onFocus={() => setConditionSearchOpen(true)}
                  onBlur={() => setTimeout(() => setConditionSearchOpen(false), 150)}
                  placeholder="Search condition…"
                  className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                  aria-label="Correct diagnosis"
                />
                {conditionSearchOpen && conditionSearchResults.length > 0 && (
                  <ul
                    className="absolute z-10 mt-1 w-full max-h-40 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-lg py-1"
                    aria-label="Condition search results"
                  >
                    {conditionSearchResults.map((r) => (
                      <li
                        key={r.id}
                        className="px-3 py-2 text-sm text-[var(--color-text-primary)] cursor-pointer hover:bg-[var(--color-accent)]/10"
                        onMouseDown={() => {
                          setConditionId(r.id);
                          setCorrectDiagnosis(r.condition);
                          setConditionSearchQuery('');
                          setConditionSearchResults([]);
                          setConditionSearchOpen(false);
                        }}
                      >
                        {r.condition}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <span className="text-[var(--color-text-muted)] block mb-1">License (confirm)</span>
                <select
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                  aria-label="Confirm license type"
                  title="Confirm license type"
                >
                  <option value="">—</option>
                  {LICENSE_OPTIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        {item.type === 'question' && (
          <>
            <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-1">
              {truncate(item.data.vignette as string, 100) || '—'}
            </p>
            <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2">
              {truncate(item.data.question as string, 100) || '—'}
            </p>
          </>
        )}
      </div>

      <div className="p-4 pt-0 flex gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={actionLoading}
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg font-medium text-sm bg-[var(--color-data-pass)] text-[var(--color-text-inverse)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          aria-label="Approve"
        >
          <Check className="w-4 h-4" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => onAction(item.id, 'reject')}
          disabled={actionLoading}
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg font-medium text-sm bg-[var(--color-data-fail)] text-[var(--color-text-inverse)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          aria-label="Reject"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
      </div>
    </article>
  );
};

export default TriageCard;
