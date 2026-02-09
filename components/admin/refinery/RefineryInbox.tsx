/**
 * RefineryInbox - Content Refinery triage UI.
 * Fetches GET /api/admin/refinery/inbox and renders a 3-column Kanban (Drafts, Media, Questions)
 * with TriageCard per item. Approve/Reject POST to /api/admin/refinery/action then refetch.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Loader2, RefreshCw } from 'lucide-react';
import { TriageCard, type RefineryItem, type MediaApprovePayload } from './TriageCard';

interface InboxResponse {
  data?: { items: RefineryItem[]; total: number };
  error?: string;
  status?: number;
}

interface ActionResponse {
  data?: { success: boolean; message?: string };
  error?: string;
  status?: number;
}

function serializeItem(item: RefineryItem): RefineryItem {
  return {
    ...item,
    timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date(item.timestamp).toISOString(),
  };
}

export function RefineryInbox() {
  const { getToken, isSignedIn } = useAuth();
  const [items, setItems] = useState<RefineryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    if (!isSignedIn) return;
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/refinery/inbox', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json: InboxResponse = await res.json();
      if (!res.ok) {
        setError(json?.error ?? `HTTP ${res.status}`);
        setItems([]);
        return;
      }
      const list = json?.data?.items ?? [];
      setItems(list.map(serializeItem));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load inbox';
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const buildActionBody = useCallback(
    (item: RefineryItem, id: string, action: 'approve' | 'reject', payload?: MediaApprovePayload) => {
      const body: Record<string, unknown> = { type: item.type, id, action };
      if (item.type !== 'media' || action !== 'approve' || !payload) return body;
      if (payload.isClassicPortrayal !== undefined) body.isClassicPortrayal = payload.isClassicPortrayal;
      if (payload.modality != null) body.modality = payload.modality;
      if (payload.correctDiagnosis != null) body.correctDiagnosis = payload.correctDiagnosis;
      if (payload.conditionId != null) body.conditionId = payload.conditionId;
      if (payload.licenseType != null) body.licenseType = payload.licenseType;
      return body;
    },
    []
  );

  const handleAction = useCallback(
    async (id: string, action: 'approve' | 'reject', payload?: MediaApprovePayload) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      setActionId(id);
      try {
        const token = await getToken();
        const res = await fetch('/api/admin/refinery/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(buildActionBody(item, id, action, payload)),
        });
        const json: ActionResponse = await res.json();
        if (!res.ok) {
          setError(json?.error ?? `Action failed: ${res.status}`);
          return;
        }
        setItems((prev) => prev.filter((i) => i.id !== id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Action failed';
        setError(msg);
      } finally {
        setActionId(null);
      }
    },
    [getToken, items, buildActionBody]
  );

  const drafts = items.filter((i) => i.type === 'content');
  const media = items.filter((i) => i.type === 'media');
  const questions = items.filter((i) => i.type === 'question');

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[var(--color-text-muted)]">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading inbox…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 text-[var(--color-data-fail)]">
          <span className="text-sm">{error}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchInbox}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-data-fail)]/20 hover:opacity-90 text-sm font-medium disabled:opacity-50"
              aria-label="Retry"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="flex flex-col min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Drafts</h2>
          <div className="space-y-4 flex-1">
            {drafts.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] py-4">No draft content</p>
            )}
            {drafts.map((item) => (
              <TriageCard
                key={`content-${item.id}`}
                item={item}
                onAction={handleAction}
                actionLoading={actionId === item.id}
              />
            ))}
          </div>
        </section>
        <section className="flex flex-col min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Media</h2>
          <div className="space-y-4 flex-1">
            {media.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] py-4">No pending media</p>
            )}
            {media.map((item) => (
              <TriageCard
                key={`media-${item.id}`}
                item={item}
                onAction={handleAction}
                actionLoading={actionId === item.id}
              />
            ))}
          </div>
        </section>
        <section className="flex flex-col min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Questions</h2>
          <div className="space-y-4 flex-1">
            {questions.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] py-4">No pending questions</p>
            )}
            {questions.map((item) => (
              <TriageCard
                key={`question-${item.id}`}
                item={item}
                onAction={handleAction}
                actionLoading={actionId === item.id}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default RefineryInbox;
