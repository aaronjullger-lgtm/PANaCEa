/**
 * SuggestionTable Component
 * Displays mapping suggestions with filtering, sorting, and selection for bulk operations.
 * Integrates with GET /api/mapping-enrichment/suggestions endpoint.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  EyeOff,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Star,
  BarChart3,
  Tag,
  User,
  Calendar,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { API_ENDPOINTS } from '@/lib/utils/apiConfig';
import type { SystemCode } from '@/src/types';

export interface MappingSuggestion {
  id: string;
  taxonomyCode: string;
  taxonomyName: string;
  taxonomyDescription: string | null;
  taxonomyIsActive: boolean;
  suggestedSystemCode: SystemCode;
  confidence: number;
  reason: string;
  alternativeSystems: Array<{
    systemCode: string;
    confidence: number;
    reason: string;
  }>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IGNORED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedByUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export interface SuggestionTableProps {
  /** Initial filter by status */
  initialStatus?: MappingSuggestion['status'] | 'ALL';
  /** Whether to show selection checkboxes for bulk operations */
  selectable?: boolean;
  /** Whether to show filters */
  showFilters?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Callback when a suggestion status is updated */
  onSuggestionUpdated?: (suggestionId: string, newStatus: MappingSuggestion['status']) => void;
  /** Callback when selected suggestions change (full objects) */
  onSelectedSuggestionsChange?: (suggestions: MappingSuggestion[]) => void;
}

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'text-data-provisional',
    bgColor: 'bg-data-provisional/10',
    icon: AlertCircle,
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-data-pass',
    bgColor: 'bg-data-pass/10',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Rejected',
    color: 'text-data-fail',
    bgColor: 'bg-data-fail/10',
    icon: XCircle,
  },
  IGNORED: {
    label: 'Ignored',
    color: 'text-[var(--color-text-muted)]',
    bgColor: 'bg-[var(--color-bg-tertiary)]',
    icon: EyeOff,
  },
} as const;

const SYSTEM_COLORS: Partial<Record<SystemCode, string>> = {
  CV: 'bg-[var(--color-system-cv)]/20 text-[var(--color-system-cv)]',
  PULM: 'bg-[var(--color-system-pulm)]/20 text-[var(--color-system-pulm)]',
  GI: 'bg-[var(--color-system-gi)]/20 text-[var(--color-system-gi)]',
  MSK: 'bg-[var(--color-system-msk)]/20 text-[var(--color-system-msk)]',
  NEURO: 'bg-[var(--color-system-neuro)]/20 text-[var(--color-system-neuro)]',
  ENDO: 'bg-[var(--color-system-endo)]/20 text-[var(--color-system-endo)]',
  GU: 'bg-[var(--color-system-gu)]/20 text-[var(--color-system-gu)]',
  DERM: 'bg-[var(--color-system-derm)]/20 text-[var(--color-system-derm)]',
  PSYCH: 'bg-[var(--color-system-psych)]/20 text-[var(--color-system-psych)]',
  HEME: 'bg-[var(--color-system-heme)]/20 text-[var(--color-system-heme)]',
  ID: 'bg-[var(--color-system-id)]/20 text-[var(--color-system-id)]',
  HEENT: 'bg-[var(--color-system-heent)]/20 text-[var(--color-system-heent)]',
  RENAL: 'bg-[var(--color-system-renal)]/20 text-[var(--color-system-renal)]',
  REPRO: 'bg-[var(--color-system-repro)]/20 text-[var(--color-system-repro)]',
  PRO: 'bg-[var(--color-system-pro)]/20 text-[var(--color-system-pro)]',
  OTHER: 'bg-[var(--color-system-other)]/20 text-[var(--color-system-other)]',
};

export function SuggestionTable({
  initialStatus = 'ALL',
  selectable = true,
  showFilters = true,
  onSelectionChange,
  onSuggestionUpdated,
  onSelectedSuggestionsChange,
}: SuggestionTableProps) {
  const { getToken } = useAuth();
  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: initialStatus,
    confidenceMin: 0,
    taxonomySearch: '',
    systemCode: '' as SystemCode | '',
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof MappingSuggestion;
    direction: 'asc' | 'desc';
  }>({ key: 'confidence', direction: 'desc' });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.confidenceMin > 0) params.append('confidenceMin', filters.confidenceMin.toString());
      if (filters.taxonomySearch) params.append('taxonomySearch', filters.taxonomySearch);
      if (filters.systemCode) params.append('systemCode', filters.systemCode);
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      params.append('sortBy', sortConfig.key);
      params.append('sortOrder', sortConfig.direction);

      const url = `${getApiEndpoint(API_ENDPOINTS.MAPPING_ENRICHMENT_SUGGESTIONS)}?${params}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
      }
      const data = await response.json();
      setSuggestions(data.suggestions);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit, sortConfig, getToken]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleSelectAll = (checked: boolean) => {
    const newSelected = checked ? new Set(suggestions.map(s => s.id)) : new Set();
    setSelectedIds(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  const handleUpdateStatus = async (id: string, newStatus: MappingSuggestion['status']) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${getApiEndpoint(API_ENDPOINTS.MAPPING_ENRICHMENT_SUGGESTIONS)}/${id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to update suggestion: ${response.statusText}`);
      }
      // Update local state
      setSuggestions(prev =>
        prev.map(s => (s.id === id ? { ...s, status: newStatus, reviewedAt: new Date().toISOString() } : s))
      );
      onSuggestionUpdated?.(id, newStatus);
    } catch (err) {
      console.error('Error updating suggestion:', err);
      toast.error(`Failed to update suggestion: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSort = (key: keyof MappingSuggestion) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const renderSortIcon = (key: keyof MappingSuggestion) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline" />
    ) : (
      <ChevronDown className="w-4 h-4 inline" />
    );
  };

  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  const getSystemColor = (systemCode: SystemCode) => {
    return SYSTEM_COLORS[systemCode] || 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]';
  };

  const getStatusConfig = (status: MappingSuggestion['status']) => {
    return STATUS_CONFIG[status];
  };

  if (loading && suggestions.length === 0) {
    return (
      <div role="status" className="flex items-center justify-center min-h-[400px] bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-action-muted mx-auto mb-4" />
          <p className="text-[var(--color-text-secondary)]">Loading mapping suggestions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-8 text-center">
        <AlertCircle className="w-12 h-12 text-data-fail mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Failed to load suggestions</h3>
        <p className="text-[var(--color-text-secondary)] mb-4">{error}</p>
        <button
          onClick={fetchSuggestions}
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent)]-hover transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Header with filters */}
      {showFilters && (
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Status
              </label>
              <select
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)]"
                value={filters.status}
                onChange={e => setFilters(prev => ({ ...prev, status: e.target.value as typeof filters.status }))}
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="IGNORED">Ignored</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Min Confidence
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={filters.confidenceMin}
                onChange={e => setFilters(prev => ({ ...prev, confidenceMin: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{formatConfidence(filters.confidenceMin)}</div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Search Taxonomy
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Taxonomy code or name..."
                  className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg pl-10 pr-3 py-2 text-[var(--color-text-primary)]"
                  value={filters.taxonomySearch}
                  onChange={e => setFilters(prev => ({ ...prev, taxonomySearch: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchSuggestions}
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent)]-hover transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
            <tr>
              {selectable && (
                <th className="py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--color-border)]"
                    checked={selectedIds.size === suggestions.length && suggestions.length > 0}
                    onChange={e => handleSelectAll(e.target.checked)}
                  />
                </th>
              )}
              <th
                className="py-3 px-4 text-left cursor-pointer hover:bg-[var(--color-bg-primary)] transition-colors"
                onClick={() => handleSort('taxonomyName')}
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Taxonomy
                  {renderSortIcon('taxonomyName')}
                </div>
              </th>
              <th
                className="py-3 px-4 text-left cursor-pointer hover:bg-[var(--color-bg-primary)] transition-colors"
                onClick={() => handleSort('suggestedSystemCode')}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Suggested System
                  {renderSortIcon('suggestedSystemCode')}
                </div>
              </th>
              <th
                className="py-3 px-4 text-left cursor-pointer hover:bg-[var(--color-bg-primary)] transition-colors"
                onClick={() => handleSort('confidence')}
              >
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Confidence
                  {renderSortIcon('confidence')}
                </div>
              </th>
              <th
                className="py-3 px-4 text-left cursor-pointer hover:bg-[var(--color-bg-primary)] transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Status
                  {renderSortIcon('status')}
                </div>
              </th>
              <th className="py-3 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {suggestions.length === 0 ? (
              <tr>
                <td colSpan={selectable ? 6 : 5} className="py-12 text-center">
                  <div className="text-[var(--color-text-secondary)]">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No mapping suggestions found</p>
                    <p className="text-sm">Adjust filters or generate new suggestions.</p>
                  </div>
                </td>
              </tr>
            ) : (
              suggestions.map(suggestion => {
                const StatusIcon = getStatusConfig(suggestion.status).icon;
                const systemColor = getSystemColor(suggestion.suggestedSystemCode);
                return (
                  <tr
                    key={suggestion.id}
                    className="hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    {selectable && (
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          className="rounded border-[var(--color-border)]"
                          checked={selectedIds.has(suggestion.id)}
                          onChange={e => handleSelect(suggestion.id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {suggestion.taxonomyName}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {suggestion.taxonomyCode}
                        </span>
                        {suggestion.taxonomyDescription && (
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                            {suggestion.taxonomyDescription}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${systemColor}`}>
                          {suggestion.suggestedSystemCode}
                        </span>
                        {suggestion.alternativeSystems.length > 0 && (
                          <div className="text-xs text-[var(--color-text-muted)]">
                            Alternatives: {suggestion.alternativeSystems.slice(0, 2).map(a => a.systemCode).join(', ')}
                            {suggestion.alternativeSystems.length > 2 && '...'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-data-provisional h-full"
                            style={{ width: `${suggestion.confidence * 100}%` }}
                          />
                        </div>
                        <span className="font-medium tabular-nums">
                          {formatConfidence(suggestion.confidence)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getStatusConfig(suggestion.status).bgColor} ${getStatusConfig(suggestion.status).color}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="font-medium">{getStatusConfig(suggestion.status).label}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {suggestion.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(suggestion.id, 'APPROVED')}
                              className="px-3 py-1 bg-data-pass/20 text-data-pass rounded-lg hover:bg-data-pass/30 transition-colors text-sm font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(suggestion.id, 'REJECTED')}
                              className="px-3 py-1 bg-data-fail/20 text-data-fail rounded-lg hover:bg-data-fail/30 transition-colors text-sm font-medium"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(suggestion.id, 'IGNORED')}
                              className="px-3 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors text-sm font-medium"
                            >
                              Ignore
                            </button>
                          </>
                        )}
                        {suggestion.status !== 'PENDING' && (
                          <span className="text-[var(--color-text-muted)] text-sm">Reviewed</span>
                        )}
                        <button
                          className="p-1 hover:bg-[var(--color-bg-primary)] rounded"
                          title="View details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between">
          <div className="text-sm text-[var(--color-text-secondary)]">
            Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>–
            <span className="font-medium">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="font-medium">{pagination.total}</span> suggestions
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-[var(--color-text-primary)]">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}