import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { RefreshCw, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

export interface AuditLogEntry {
  id: string;
  taxonomyCode: string;
  systemCode: string;
  action: string;
  userId: string | null;
  timestamp: string;
  rationale: string | null;
  previousSystemCode: string | null;
  metadata: any;
  taxonomy?: {
    name: string;
    weight: number;
    isActive: boolean;
  } | null;
  user?: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface AuditLogTableProps {
  initialTaxonomyCode?: string;
  initialSystemCode?: string;
  initialAction?: string;
  showFilters?: boolean;
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({
  initialTaxonomyCode,
  initialSystemCode,
  initialAction,
  showFilters = true,
}) => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [taxonomyCodeFilter, setTaxonomyCodeFilter] = useState(initialTaxonomyCode || '');
  const [systemCodeFilter, setSystemCodeFilter] = useState(initialSystemCode || '');
  const [actionFilter, setActionFilter] = useState(initialAction || '');
  const [expandedFilter, setExpandedFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (taxonomyCodeFilter) params.append('taxonomyCode', taxonomyCodeFilter);
      if (systemCodeFilter) params.append('systemCode', systemCodeFilter);
      if (actionFilter) params.append('action', actionFilter);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const url = `${getApiEndpoint(API_ENDPOINTS.MAPPING_ENRICHMENT_AUDIT_LOGS)}?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.status}`);
      }

      const data = (await response.json()) as {
        logs?: AuditLogEntry[];
        total?: number;
      };
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, taxonomyCodeFilter, systemCodeFilter, actionFilter, limit, offset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const handleApplyFilters = () => {
    setOffset(0);
    fetchLogs();
  };

  const handleClearFilters = () => {
    setTaxonomyCodeFilter('');
    setSystemCodeFilter('');
    setActionFilter('');
    setOffset(0);
    // fetch will be triggered by useEffect due to dependency change
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'APPROVE': return 'text-[var(--color-data-pass)]';
      case 'REJECT': return 'text-[var(--color-data-fail)]';
      case 'IGNORE': return 'text-[var(--color-text-muted)]';
      case 'MANUAL_ADD': return 'text-[var(--color-action-primary)]';
      case 'MANUAL_REMOVE': return 'text-[var(--color-action-secondary)]';
      case 'PREVIEW': return 'text-[var(--color-accent)]';
      default: return 'text-[var(--color-text-primary)]';
    }
  };

  const renderFilterBar = () => (
    <div className="mb-6 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-[var(--color-text-muted)]" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Filter Audit Logs</h3>
        </div>
        <button
          type="button"
          onClick={() => setExpandedFilter(!expandedFilter)}
          aria-expanded={expandedFilter}
          className="text-sm text-[var(--color-action-primary)] hover:underline flex items-center gap-1"
        >
          {expandedFilter ? 'Hide Filters' : 'Show Filters'}
          {expandedFilter ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
      {expandedFilter && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                Taxonomy Code
              </label>
              <input
                type="text"
                value={taxonomyCodeFilter}
                onChange={(e) => setTaxonomyCodeFilter(e.target.value)}
                placeholder="e.g., CV.1"
                className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                System Code
              </label>
              <input
                type="text"
                value={systemCodeFilter}
                onChange={(e) => setSystemCodeFilter(e.target.value)}
                placeholder="e.g., Cardiovascular"
                className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]"
                aria-label="Filter by action"
                title="Filter by action"
              >
                <option value="">All Actions</option>
                <option value="APPROVE">APPROVE</option>
                <option value="REJECT">REJECT</option>
                <option value="IGNORE">IGNORE</option>
                <option value="MANUAL_ADD">MANUAL_ADD</option>
                <option value="MANUAL_REMOVE">MANUAL_REMOVE</option>
                <option value="PREVIEW">PREVIEW</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)] text-[var(--color-text-inverse)] rounded-lg transition-colors"
            >
              <Search className="w-4 h-4" />
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderPagination = () => {
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-[var(--color-text-muted)]">
          Showing {offset + 1}–{Math.min(offset + limit, total)} of {total} logs
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1 bg-[var(--color-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-[var(--color-text-primary)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-3 py-1 bg-[var(--color-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--color-text-muted)]">Loading audit logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-bg-secondary)] rounded-xl">
            <Filter className="w-6 h-6 text-[var(--color-action-primary)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Mapping Audit Log</h2>
            <p className="text-[var(--color-text-muted)]">
              Track all system mapping changes, approvals, and preview actions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && renderFilterBar()}

      {/* Error */}
      {error && (
        <div className="p-4 bg-[var(--color-bg-error)] border border-[var(--color-border)] rounded-xl">
          <div className="flex items-center gap-2 text-[var(--color-data-fail)]">
            <span className="font-medium">Error loading audit logs:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--color-text-primary)]">Timestamp</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--color-text-primary)]">Taxonomy</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--color-text-primary)]">System</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--color-text-primary)]">Action</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--color-text-primary)]">User</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--color-text-primary)]">Rationale</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-[var(--color-text-primary)]">Previous System</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--color-text-muted)]">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--color-bg-secondary)]">
                    <td className="py-3 px-4 text-sm text-[var(--color-text-primary)] whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[var(--color-text-primary)]">
                        {log.taxonomy?.name || log.taxonomyCode}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">{log.taxonomyCode}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--color-text-primary)]">
                      {log.systemCode}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)} bg-opacity-10 bg-current`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--color-text-primary)]">
                      {log.user ? (
                        <div>
                          <div>{log.user.email}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {log.user.firstName} {log.user.lastName}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">System</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--color-text-primary)] max-w-xs truncate">
                      {log.rationale || '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--color-text-primary)]">
                      {log.previousSystemCode || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {renderPagination()}
    </div>
  );
};