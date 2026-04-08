import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@clerk/clerk-react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Target,
  Users,
  Zap,
  BarChart3,
  Database,
  Eye,
  Sparkles,
  TrendingUp,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SuggestionTable } from './SuggestionTable';
import { BulkApprovalPanel } from './BulkApprovalPanel';
import { ChangePreviewModal } from './mapping-enrichment/ChangePreviewModal';
import { AuditLogTable } from './mapping-enrichment/AuditLogTable';
import type { MappingSuggestion } from './SuggestionTable';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

interface DashboardStats {
  totalSuggestions: number;
  pendingSuggestions: number;
  approvedSuggestions: number;
  rejectedSuggestions: number;
  totalGaps: number;
  activeGaps: number;
  inactiveGaps: number;
  lastUpdated: string;
}

interface GapDetectionResult {
  taxonomyCode: string;
  taxonomyName: string;
  description: string | null;
  weight: number;
  isActive: boolean;
  missingMappingsCount: number;
  exampleUnmappedSubcategories?: string[];
}

export const MappingEnrichmentDashboard: React.FC = () => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [gaps, setGaps] = useState<GapDetectionResult[]>([]);
  const [detectingGaps, setDetectingGaps] = useState(false);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [expandedGapIndex, setExpandedGapIndex] = useState<number | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<MappingSuggestion[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Fetch initial data
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [suggestionsRes, gapsRes] = await Promise.all([
        fetch(getApiEndpoint(API_ENDPOINTS.MAPPING_ENRICHMENT_SUGGESTIONS), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(getApiEndpoint(API_ENDPOINTS.MAPPING_ENRICHMENT_GAPS), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!suggestionsRes.ok) {
        throw new Error(`Failed to fetch suggestions: ${suggestionsRes.status}`);
      }
      if (!gapsRes.ok) {
        throw new Error(`Failed to fetch gaps: ${gapsRes.status}`);
      }

      const suggestionsData = await suggestionsRes.json();
      const gapsData = await gapsRes.json();

      // Calculate stats
      const totalSuggestions = suggestionsData.suggestions?.length || 0;
      const pendingSuggestions = suggestionsData.suggestions?.filter(
        (s: any) => s.status === 'PENDING'
      ).length || 0;
      const approvedSuggestions = suggestionsData.suggestions?.filter(
        (s: any) => s.status === 'APPROVED'
      ).length || 0;
      const rejectedSuggestions = suggestionsData.suggestions?.filter(
        (s: any) => s.status === 'REJECTED'
      ).length || 0;
      const totalGaps = gapsData.gaps?.length || 0;
      const activeGaps = gapsData.gaps?.filter((g: any) => g.isActive).length || 0;
      const inactiveGaps = totalGaps - activeGaps;

      setStats({
        totalSuggestions,
        pendingSuggestions,
        approvedSuggestions,
        rejectedSuggestions,
        totalGaps,
        activeGaps,
        inactiveGaps,
        lastUpdated: new Date().toISOString(),
      });

      setGaps(gapsData.gaps || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const detectGaps = async () => {
    setDetectingGaps(true);
    try {
      const token = await getToken();
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.MAPPING_ENRICHMENT_GAPS), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch gaps');
      }
      // Refresh data to update gaps list
      await fetchDashboardData();
    } catch (err) {
      console.error('Error detecting gaps:', err);
      toast.error('Failed to detect gaps. Please try again.');
    } finally {
      setDetectingGaps(false);
    }
  };

  const generateSuggestions = async () => {
    setGeneratingSuggestions(true);
    try {
      const token = await getToken();
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.MAPPING_ENRICHMENT_SUGGEST), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error('Failed to generate suggestions');
      }
      // Refresh data
      await fetchDashboardData();
    } catch (err) {
      console.error('Error generating suggestions:', err);
      toast.error('Failed to generate suggestions. Please try again.');
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  const toggleGapExpanded = (index: number) => {
    setExpandedGapIndex(expandedGapIndex === index ? null : index);
  };

  const handleSuggestionSelectionChange = (selectedIds: string[]) => {
    setSelectedSuggestionIds(selectedIds);
  };

  const handleSelectedSuggestionsChange = (suggestions: MappingSuggestion[]) => {
    setSelectedSuggestions(suggestions);
  };

  const handleBulkActionComplete = () => {
    // Refresh data after bulk action
    fetchDashboardData();
    setSelectedSuggestionIds([]);
    setSelectedSuggestions([]);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading && !stats) {
    return (
      <div role="status" className="flex items-center justify-center h-64">
        <div className="text-[var(--color-text-muted)]">Loading mapping enrichment dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-bg-secondary)] rounded-xl">
            <Target className="w-6 h-6 text-[var(--color-action-primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              System Mapping Enrichment Assistant
            </h1>
            <p className="text-[var(--color-text-muted)]">
              Detect gaps and approve AI‑generated system mappings for NCCPA blueprint compliance.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner – shown immediately below header when present */}
      {error && (
        <div className="p-4 bg-[var(--color-bg-error)] border border-[var(--color-border)] rounded-xl">
          <div className="flex items-center gap-2 text-[var(--color-data-fail)]">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Error loading dashboard:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Pending Suggestions</p>
              <p className="text-3xl font-bold text-[var(--color-data-provisional)]">
                {stats?.pendingSuggestions ?? 0}
              </p>
            </div>
            <div className="p-2 bg-[var(--color-bg-primary)] rounded-lg">
              <Clock className="w-5 h-5 text-[var(--color-data-provisional)]" />
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            {stats?.totalSuggestions ?? 0} total suggestions
          </div>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Approved Mappings</p>
              <p className="text-3xl font-bold text-[var(--color-data-pass)]">
                {stats?.approvedSuggestions ?? 0}
              </p>
            </div>
            <div className="p-2 bg-[var(--color-bg-primary)] rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-[var(--color-data-pass)]" />
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            {stats?.rejectedSuggestions ?? 0} rejected
          </div>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Active Gaps</p>
              <p className="text-3xl font-bold text-[var(--color-data-fail)]">
                {stats?.activeGaps ?? 0}
              </p>
            </div>
            <div className="p-2 bg-[var(--color-bg-primary)] rounded-lg">
              <AlertTriangle className="w-5 h-5 text-[var(--color-data-fail)]" />
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            {stats?.totalGaps ?? 0} total gaps
          </div>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">System Coverage</p>
              <p className="text-3xl font-bold text-[var(--color-accent)]">
                {stats && stats.totalGaps > 0
                  ? `${Math.round(((stats.totalGaps - stats.activeGaps) / stats.totalGaps) * 100)}%`
                  : '100%'}
              </p>
            </div>
            <div className="p-2 bg-[var(--color-bg-primary)] rounded-lg">
              <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            Updated {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleTimeString() : 'N/A'}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-4 items-center bg-[var(--color-bg-secondary)] rounded-xl p-4">
        <button
          onClick={detectGaps}
          disabled={detectingGaps}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)] text-[var(--color-text-inverse)] rounded-lg transition-colors disabled:opacity-50"
        >
          {detectingGaps ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {detectingGaps ? 'Detecting Gaps…' : 'Detect Gaps'}
        </button>
        <button
          onClick={generateSuggestions}
          disabled={generatingSuggestions}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-action-secondary)] hover:bg-[var(--color-action-secondary-hover)] text-[var(--color-text-inverse)] rounded-lg transition-colors disabled:opacity-50"
        >
          {generatingSuggestions ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {generatingSuggestions ? 'Generating Suggestions…' : 'Generate Suggestions'}
        </button>
        <div className="text-sm text-[var(--color-text-muted)] ml-auto">
          Use the table below to review, approve, or reject AI‑generated mapping suggestions.
        </div>
      </div>

      {/* Gaps Section (Collapsible) */}
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--color-text-muted)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Detected Gaps ({gaps.length})
            </h2>
          </div>
          <button
            onClick={() => setExpandedGapIndex(expandedGapIndex === null ? 0 : null)}
            className="text-sm text-[var(--color-action-primary)] hover:underline"
          >
            {expandedGapIndex === null ? 'Show All' : 'Hide All'}
          </button>
        </div>
        <AnimatePresence>
          {gaps.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-muted)]">
              No gaps detected. All taxonomy nodes have system mappings.
            </div>
          ) : (
            <div className="space-y-2">
              {gaps.slice(0, 5).map((gap, index) => (
                <motion.div
                  key={gap.taxonomyCode}
                  initial={{ y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="border border-[var(--color-border)] rounded-lg p-4"
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleGapExpanded(index)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${gap.isActive ? 'bg-[var(--color-data-fail)]' : 'bg-[var(--color-bg-secondary)]'}`}
                      />
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">
                          {gap.taxonomyName}
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          {gap.taxonomyCode} • {gap.weight}% weight
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-[var(--color-text-muted)]">
                        Missing {gap.missingMappingsCount} mapping(s)
                      </span>
                      {expandedGapIndex === index ? (
                        <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
                      )}
                    </div>
                  </div>
                  {expandedGapIndex === index && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-[var(--color-border)]"
                    >
                      <p className="text-sm text-[var(--color-text-primary)] mb-2">
                        {gap.description || 'No description available.'}
                      </p>
                      {gap.exampleUnmappedSubcategories && gap.exampleUnmappedSubcategories.length > 0 && (
                        <div className="text-sm text-[var(--color-text-muted)]">
                          Example subcategories: {gap.exampleUnmappedSubcategories.join(', ')}
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
              {gaps.length > 5 && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => toast.info('Full gap list is coming in a future update.')}
                    className="text-sm text-[var(--color-action-primary)] hover:underline"
                  >
                    View all {gaps.length} gaps →
                  </button>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Suggestion Table */}
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[var(--color-action-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Mapping Suggestions
            </h2>
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Select rows to perform bulk actions
          </div>
        </div>
        <SuggestionTable onSelectionChange={handleSuggestionSelectionChange} onSelectedSuggestionsChange={handleSelectedSuggestionsChange} />
      </div>

      {/* Audit Log */}
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--color-action-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Audit Log
            </h2>
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            View all mapping change activities
          </div>
        </div>
        <AuditLogTable />
      </div>

      {/* Preview & Bulk Actions */}
      {selectedSuggestionIds.length > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-action-secondary)] hover:bg-[var(--color-action-secondary-hover)] text-[var(--color-text-inverse)] rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
            Preview Changes
          </button>
          <span className="text-sm text-[var(--color-text-muted)]">
            {selectedSuggestionIds.length} suggestion(s) selected
          </span>
        </div>
      )}

      {/* Bulk Approval Panel */}
      {selectedSuggestionIds.length > 0 && (
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <BulkApprovalPanel
            selectedSuggestionIds={selectedSuggestionIds}
            onComplete={handleBulkActionComplete}
          />
        </div>
      )}

      {/* Footer Notes */}
      <div className="text-sm text-[var(--color-text-muted)] space-y-2">
        <p>
          <strong>Phase 6.2 – Curation UI & Bulk Operations</strong> • The System Mapping Enrichment
          Assistant ensures every MedicalTaxonomy node is linked to the correct NCCPA blueprint system
          (Cardiovascular, Pulmonary, etc.) using AI‑generated suggestions and human curation.
        </p>
        <p>
          Gaps are detected by querying taxonomy nodes with zero SystemMapping entries. Suggestions are
          generated using Gemini embeddings and keyword matching. Approved suggestions create
          SystemMapping records; rejected/ignored suggestions are logged for audit.
        </p>
      </div>

      <ChangePreviewModal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        selectedSuggestions={selectedSuggestions}
        onApprovePreview={() => setShowPreviewModal(false)}
      />
    </div>
  );
};