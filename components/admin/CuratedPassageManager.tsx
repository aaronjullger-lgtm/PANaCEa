import React, { useEffect, useState } from 'react';
import { BookOpen, Trash2, Plus } from 'lucide-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { InlineSpinner } from '@/components/loading';

export interface CuratedPassageManagerProps {
  conditionId: string;
  conditionName: string;
}

interface CuratedPassage {
  id: string;
  title: string;
  body: string;
  source: string;
  sourceUrl: string;
  license: string;
  systemCodes: string[];
  conditionIds: string[];
  createdAt: string;
}

export const CuratedPassageManager: React.FC<CuratedPassageManagerProps> = ({
  conditionId,
  conditionName,
}) => {
  const [passages, setPassages] = useState<CuratedPassage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [source, setSource] = useState('OpenStax');
  const [sourceUrl, setSourceUrl] = useState('https://openstax.org');
  const [license, setLicense] = useState('CC BY 4.0');
  const [systemCodesText, setSystemCodesText] = useState('');

  async function loadPassages() {
    setLoading(true);
    setError(null);
    try {
      const endpoint = getApiEndpoint('/api/admin/curated-passages');
      const url = `${endpoint}?conditionId=${encodeURIComponent(conditionId)}&limit=50`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        setError(`Failed to load passages (status ${res.status})`);
        return;
      }
      const payload = (await res.json()) as
        | { passages?: CuratedPassage[] }
        | { data?: { passages?: CuratedPassage[] } };
      const root = 'data' in payload && payload.data ? payload.data : payload;
      const list = (root?.passages || []) as CuratedPassage[];
      setPassages(list);
    } catch (e) {
      setError('Error loading passages. See console for details.');
      console.error('[CuratedPassageManager] loadPassages error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPassages();
  }, [conditionId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const endpoint = getApiEndpoint('/api/admin/curated-passages');
      const systemCodes = systemCodesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create',
          title: title.trim(),
          body: body.trim(),
          source: source.trim() || 'OpenStax',
          sourceUrl: sourceUrl.trim() || 'https://openstax.org',
          license: license.trim() || 'CC BY 4.0',
          systemCodes,
          conditionIds: [conditionId],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(`Failed to create passage (status ${res.status}): ${text}`);
        return;
      }
      setTitle('');
      setBody('');
      await loadPassages();
    } catch (e) {
      setError('Error creating passage. See console for details.');
      console.error('[CuratedPassageManager] handleCreate error', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!globalThis.window?.confirm('Delete this curated passage? This cannot be undone.')) return;
    setSaving(true);
    setError(null);
    try {
      const endpoint = getApiEndpoint('/api/admin/curated-passages');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete', id }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(`Failed to delete passage (status ${res.status}): ${text}`);
        return;
      }
      await loadPassages();
    } catch (e) {
      setError('Error deleting passage. See console for details.');
      console.error('[CuratedPassageManager] handleDelete error', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[var(--color-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Curated Textbook Passages
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Linked to condition: <span className="font-medium">{conditionName}</span>
            </p>
          </div>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]" role="status" aria-live="polite">
            <InlineSpinner size="sm" />
            <span>Loading passages…</span>
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-md border border-[var(--color-data-fail)]/40 bg-[var(--color-data-fail)]/10 px-3 py-2 text-sm text-[var(--color-data-fail)]">
          {error}
        </div>
      )}

      {/* Existing passages */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
          Existing passages ({passages.length})
        </h3>
        {passages.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            No curated passages yet. Add a short excerpt below.
          </p>
        ) : (
          <div className="space-y-3">
            {passages.map((p) => (
              <article
                key={p.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {p.title}
                    </h4>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)] line-clamp-3 whitespace-pre-wrap">
                      {p.body}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                      Source: {p.source} · License: {p.license}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={saving}
                    className="p-1 rounded-full hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-data-fail)] transition-colors"
                    aria-label="Delete passage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Create form */}
      <section className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add new passage
        </h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              placeholder="e.g. Cardiac Cycle Overview"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Excerpt (body)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              rows={4}
              placeholder="Paste a short, high-yield excerpt from the textbook…"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Source
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="OpenStax"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Source URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="https://openstax.org/details/books/anatomy-and-physiology"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                License
              </label>
              <input
                type="text"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="CC BY 4.0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              System codes (optional, comma-separated)
            </label>
            <input
              type="text"
              value={systemCodesText}
              onChange={(e) => setSystemCodesText(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              placeholder="e.g. CV, PULM"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <InlineSpinner size="sm" />}
              <span>Add passage</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default CuratedPassageManager;
