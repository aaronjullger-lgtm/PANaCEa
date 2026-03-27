import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Target,
  Database,
  Eye,
  Sparkles,
  TrendingUp,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

interface EnrichmentLogEntry {
  timestamp: string;
  entityType: 'Condition' | 'Drug';
  entityId: string;
  entityName: string;
  missingField: string;
  status: 'success' | 'failure' | 'skipped';
  pdfPath?: string;
  contextLength?: number;
  extractedValue?: any;
  existingValue?: any;
  conflictDetected?: boolean;
  similarityScore?: number;
  error?: string;
  rawResponse?: string;
}

interface PriorityRecord {
  id: string;
  name: string;
  system: string;
  missingFields: string[];
  existingValues: Record<string, any>;
  panceYield: number;
}

interface DashboardStats {
  totalLogs: number;
  successLogs: number;
  failureLogs: number;
  skippedLogs: number;
  totalPriority: number;
  pendingFields: number;
  lastUpdated: string;
}

export const LibraryEnrichmentDashboard: React.FC = () => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<EnrichmentLogEntry[]>([]);
  const [priority, setPriority] = useState<PriorityRecord[]>([]);
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);
  const [logsLimit, setLogsLimit] = useState(50);
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsTotal, setLogsTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [logsRes, priorityRes] = await Promise.all([
        fetch(getApiEndpoint(API_ENDPOINTS.LIBRARY_ENRICHMENT_LOGS) + `?limit=${logsLimit}&offset=${logsOffset}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(getApiEndpoint(API_ENDPOINTS.LIBRARY_ENRICHMENT_PRIORITY), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!logsRes.ok) {
        throw new Error(`Failed to fetch logs: ${logsRes.status}`);
      }
      if (!priorityRes.ok) {
        throw new Error(`Failed to fetch priority: ${priorityRes.status}`);
      }

      const logsData = await logsRes.json();
      const priorityData = await priorityRes.json();

      setLogs(logsData.logs || []);
      setLogsTotal(logsData.total || 0);
      setPriority(priorityData.priorityList || []);

      // Calculate stats
      const totalLogs = logsData.total || 0;
      const successLogs = logsData.logs?.filter((l: EnrichmentLogEntry) => l.status === 'success').length || 0;
      const failureLogs = logsData.logs?.filter((l: EnrichmentLogEntry) => l.status === 'failure').length || 0;
      const skippedLogs = logsData.logs?.filter((l: EnrichmentLogEntry) => l.status === 'skipped').length || 0;
      const totalPriority = priorityData.priorityList?.length || 0;
      const pendingFields = priorityData.priorityList?.reduce((acc: number, rec: PriorityRecord) => acc + rec.missingFields.length, 0) || 0;

      setStats({
        totalLogs,
        successLogs,
        failureLogs,
        skippedLogs,
        totalPriority,
        pendingFields,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const toggleLogExpanded = (index: number) => {
    setExpandedLogIndex(expandedLogIndex === index ? null : index);
  };

  const handlePrevPage = () => {
    if (logsOffset >= logsLimit) {
      setLogsOffset(logsOffset - logsLimit);
    }
  };

  const handleNextPage = () => {
    if (logsOffset + logsLimit < logsTotal) {
      setLogsOffset(logsOffset + logsLimit);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [logsOffset]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--color-text-muted)]">Loading library enrichment dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-bg-secondary)] rounded-xl">
            <BookOpen className="w-6 h-6 text-[var(--color-action-primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Targeted RAG Library Enrichment
            </h1>
            <p className="text-[var(--color-text-muted)]">
              Monitor automated field extraction from the 600GB medical library using DeepSeek API.
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
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Pending Fields</p>
              <p className="text-3xl font-bold text-[var(--color-data-provisional)]">
                {stats?.pendingFields ?? 0}
              </p>
            </div>
            <div className="p-2 bg-[var(--color-bg-primary)] rounded-lg">
              <Clock className="w-5 h-5 text-[var(--color-data-provisional)]" />
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            {stats?.totalPriority ?? 0} priority records
          </div>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Successful Extractions</p>
              <p className="text-3xl font-bold text-[var(--color-data-pass)]">
                {stats?.successLogs ?? 0}
              </p>
            </div>
            <div className="p-2 bg-[var(--color-bg-primary)] rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-[var(--color-data-pass)]" />
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            {stats?.failureLogs ?? 0} failures, {stats?.skippedLogs ?? 0} skipped
          </div>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Total Log Entries</p>
              <p className="text-3xl font-bold text-[var(--color-data-fail)]">
                {stats?.totalLogs ?? 0}
              </p>
            </div>
            <div className="p-2 bg-[var(--color-bg-primary)] rounded-lg">
              <Database className="w-5 h-5 text-[var(--color-data-fail)]" />
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            Updated {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleTimeString() : 'N/A'}
          </div>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Extraction Success Rate</p>
              <p className="text-3xl font-bold text-[var(--color-accent)]">
                {stats && stats.totalLogs > 0
                  ? `${Math.round((stats.successLogs / stats.totalLogs) * 100)}%`
                  : '0%'}
              </p>
            </div>
            <div className="p-2 bg-[var(--color-bg-primary)] rounded-lg">
              <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            Based on processed logs
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-4 items-center bg-[var(--color-bg-secondary)] rounded-xl p-4">
        <button
          onClick={() => window.open('/api/admin/library-enrichment-logs?limit=500', '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)] text-white rounded-lg transition-colors"
        >
          <FileText className="w-4 h-4" />
          Export Logs (JSON)
        </button>
        <button
          onClick={() => window.open('/data/library-enrichment-priority.json', '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-action-secondary)] hover:bg-[var(--color-action-secondary-hover)] text-white rounded-lg transition-colors"
        >
          <Target className="w-4 h-4" />
          View Priority List
        </button>
        <div className="text-sm text-[var(--color-text-muted)] ml-auto">
          Use the table below to review extraction results and conflicts.
        </div>
      </div>

      {/* Priority Section */}
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[var(--color-text-muted)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Priority List ({priority.length})
            </h2>
          </div>
          <span className="text-sm text-[var(--color-text-muted)]">
            {stats?.pendingFields} missing fields across {priority.length} conditions/drugs
          </span>
        </div>
        {priority.length === 0 ? (
          <p className="text-[var(--color-text-muted)] italic">No priority records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 px-3 font-medium text-[var(--color-text-muted)]">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--color-text-muted)]">System</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--color-text-muted)]">Missing Fields</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--color-text-muted)]">PANCE Yield</th>
                </tr>
              </thead>
              <tbody>
                {priority.slice(0, 10).map((rec, idx) => (
                  <tr key={rec.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]">
                    <td className="py-2 px-3 font-medium text-[var(--color-text-primary)]">{rec.name}</td>
                    <td className="py-2 px-3 text-[var(--color-text-muted)]">{rec.system}</td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {rec.missingFields.map((field, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded text-xs"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-[var(--color-text-muted)]">{rec.panceYield}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {priority.length > 10 && (
              <div className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
                Showing 10 of {priority.length} priority records.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Logs Section */}
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--color-text-muted)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Enrichment Logs ({logsTotal})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={logsOffset === 0}
              className="px-3 py-1 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-[var(--color-text-muted)]">
              {logsOffset + 1}–{Math.min(logsOffset + logsLimit, logsTotal)} of {logsTotal}
            </span>
            <button
              onClick={handleNextPage}
              disabled={logsOffset + logsLimit >= logsTotal}
              className="px-3 py-1 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
        {logs.length === 0 ? (
          <p className="text-[var(--color-text-muted)] italic">No log entries found.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, idx) => (
              <div
                key={`${log.entityId}-${log.missingField}-${log.timestamp}`}
                className={`border rounded-lg p-4 ${
                  log.status === 'success'
                    ? 'border-data-pass/30 bg-data-pass/5'
                    : log.status === 'failure'
                    ? 'border-data-fail/30 bg-data-fail/5'
                    : 'border-data-provisional/30 bg-data-provisional/5'
                }`}
              >
                <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleLogExpanded(idx)}>
                  <div className="flex items-center gap-3">
                    {log.status === 'success' && <CheckCircle2 className="w-5 h-5 text-data-pass" />}
                    {log.status === 'failure' && <XCircle className="w-5 h-5 text-data-fail" />}
                    {log.status === 'skipped' && <Clock className="w-5 h-5 text-data-provisional" />}
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">
                        {log.entityName} ({log.entityType})
                      </div>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        Field: <span className="font-mono">{log.missingField}</span> • {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.conflictDetected && (
                      <span className="px-2 py-0.5 bg-data-fail/20 text-data-fail text-xs rounded-full">Conflict</span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedLogIndex === idx ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <AnimatePresence>
                  {expandedLogIndex === idx && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-[var(--color-border)]"
                    >
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong className="text-[var(--color-text-muted)]">PDF:</strong>{' '}
                          {log.pdfPath ? <span className="font-mono truncate">{log.pdfPath}</span> : 'None'}
                        </div>
                        <div>
                          <strong className="text-[var(--color-text-muted)]">Context Length:</strong>{' '}
                          {log.contextLength ? `${log.contextLength} chars` : 'N/A'}
                        </div>
                        <div className="col-span-2">
                          <strong className="text-[var(--color-text-muted)]">Extracted Value:</strong>{' '}
                          <pre className="mt-1 p-2 bg-[var(--color-bg-tertiary)] rounded overflow-auto max-h-32 text-xs">
                            {JSON.stringify(log.extractedValue, null, 2)}
                          </pre>
                        </div>
                        {log.existingValue && (
                          <div className="col-span-2">
                            <strong className="text-[var(--color-text-muted)]">Existing Value:</strong>{' '}
                            <pre className="mt-1 p-2 bg-[var(--color-bg-tertiary)] rounded overflow-auto max-h-32 text-xs">
                              {JSON.stringify(log.existingValue, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.conflictDetected && (
                          <div className="col-span-2">
                            <strong className="text-[var(--color-text-muted)]">Similarity Score:</strong>{' '}
                            {log.similarityScore?.toFixed(3)}
                          </div>
                        )}
                        {log.error && (
                          <div className="col-span-2">
                            <strong className="text-[var(--color-text-muted)]">Error:</strong>{' '}
                            <span className="text-data-fail">{log.error}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};