import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle2, BarChart3, Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { logAuditEvent } from '@/services/domain/audit/mappingAuditLogger';
import type { PreviewResult } from '@/services/domain/mappingEnrichment/previewService';

export interface MappingSuggestion {
  id: string;
  taxonomyCode: string;
  taxonomyName: string;
  suggestedSystemCode: string;
  confidence: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IGNORED';
}

interface ChangePreviewModalProps {
  open: boolean;
  onClose: () => void;
  selectedSuggestions: MappingSuggestion[];
  onApprovePreview?: (result: PreviewResult) => void;
}

export const ChangePreviewModal: React.FC<ChangePreviewModalProps> = ({
  open,
  onClose,
  selectedSuggestions,
  onApprovePreview,
}) => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

  // Fetch preview when selected suggestions change
  useEffect(() => {
    if (open && selectedSuggestions.length > 0) {
      fetchPreview();
    } else {
      setPreviewResult(null);
      setError(null);
    }
  }, [open, selectedSuggestions]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(
        getApiEndpoint(API_ENDPOINTS.MAPPING_ENRICHMENT_PREVIEW),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            changes: selectedSuggestions.map(s => ({
              taxonomyCode: s.taxonomyCode,
              systemCode: s.suggestedSystemCode,
              // previousSystemCode omitted (assume unmapped)
            })),
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        let errorMsg = `Request failed with status ${response.status}`;
        try {
          const json = JSON.parse(text);
          errorMsg = json.error || json.message || errorMsg;
        } catch {
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      setPreviewResult(result.data);

      // Log audit event for preview
      await logAuditEvent({
        action: 'PREVIEW',
        taxonomyCodes: selectedSuggestions.map(s => s.taxonomyCode),
        systemCodes: selectedSuggestions.map(s => s.suggestedSystemCode),
        metadata: { previewId: 'generated' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch preview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePreview = () => {
    if (previewResult && onApprovePreview) {
      onApprovePreview(previewResult);
    }
  };

  const handleClose = () => {
    setPreviewResult(null);
    setError(null);
    onClose();
  };

  const renderComplianceTable = (summary: any, title: string) => {
    const systems = summary?.systems || [];
    return (
      <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4">
        <h4 className="font-semibold text-[var(--color-accent)] mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          {title}
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 font-medium text-text-secondary">System</th>
                <th className="text-left py-2 font-medium text-text-secondary">Target</th>
                <th className="text-left py-2 font-medium text-text-secondary">Actual</th>
                <th className="text-left py-2 font-medium text-text-secondary">Deviation</th>
                <th className="text-left py-2 font-medium text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((sys: any) => (
                <tr key={sys.system} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2 font-medium text-text-primary">{sys.system}</td>
                  <td className="py-2 text-text-secondary">{sys.targetPercent?.toFixed(1) ?? '0.0'}%</td>
                  <td className="py-2 text-text-secondary">{sys.actualPercent?.toFixed(1) ?? '0.0'}%</td>
                  <td className={`py-2 ${(sys.deviation ?? 0) >= 0 ? 'text-data-positive' : 'text-data-negative'}`}>
                    {(sys.deviation ?? 0) >= 0 ? '+' : ''}{sys.deviation?.toFixed(1) ?? '0.0'}%
                  </td>
                  <td className="py-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      sys.status === 'met'
                        ? 'bg-data-positive/10 text-data-positive'
                        : sys.status === 'under'
                        ? 'bg-data-warning/10 text-data-warning'
                        : 'bg-data-negative/10 text-data-negative'
                    }`}>
                      {sys.status === 'met' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {sys.status === 'under' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {sys.status === 'over' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {sys.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-text-secondary">
          <p><strong>Compliance Score:</strong> {summary?.complianceScore?.toFixed(1) ?? '0.0'}%</p>
          <p><strong>Mapped Taxonomies:</strong> {summary?.totalMappedTaxonomies ?? 0}</p>
          <p><strong>Systems Met:</strong> {summary?.systemsMet ?? 0} | <strong>Under:</strong> {summary?.systemsUnder ?? 0} | <strong>Over:</strong> {summary?.systemsOver ?? 0}</p>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-action-muted/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-[var(--color-bg-primary)] w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-action-muted rounded-lg">
                  <BarChart3 className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Mapping Change Preview</h2>
                  <p className="text-sm text-text-secondary">
                    Preview blueprint coverage impact of {selectedSuggestions.length} mapping suggestion(s)
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-action-muted rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {loading && (
                <div className="flex items-center justify-center py-12" role="status" aria-label="Loading preview">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
                  <span className="ml-3 text-text-secondary">Computing preview…</span>
                </div>
              )}

              {error && (
                <div className="p-4 border border-data-negative/30 bg-data-negative/10 rounded-lg">
                  <div className="flex items-center gap-2 text-data-negative">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Preview failed</span>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{error}</p>
                  <button
                    onClick={fetchPreview}
                    className="mt-3 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent)]/90 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && previewResult && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
                      <h3 className="font-semibold text-lg text-text-primary mb-2">Before</h3>
                      <p className="text-text-secondary mb-4">Current taxonomy mapping distribution</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Compliance Score</span>
                          <span className="font-bold text-text-primary">{previewResult?.before?.complianceScore?.toFixed(1) ?? '0.0'}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Mapped Taxonomies</span>
                          <span className="font-bold text-text-primary">{previewResult?.before?.totalMappedTaxonomies ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Systems Met</span>
                          <span className="font-bold text-data-positive">{previewResult?.before?.systemsMet ?? 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5 border-l-4 border-l-data-positive">
                      <h3 className="font-semibold text-lg text-text-primary mb-2">After</h3>
                      <p className="text-text-secondary mb-4">Projected distribution after applying changes</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Compliance Score</span>
                          <span className="font-bold text-text-primary">{previewResult?.after?.complianceScore?.toFixed(1) ?? '0.0'}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Mapped Taxonomies</span>
                          <span className="font-bold text-text-primary">{previewResult?.after?.totalMappedTaxonomies ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Systems Met</span>
                          <span className="font-bold text-data-positive">{previewResult?.after?.systemsMet ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Tables */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {renderComplianceTable(previewResult.before, 'Current Compliance')}
                    {renderComplianceTable(previewResult.after, 'Projected Compliance')}
                  </div>

                  {/* Recommendations */}
                  {previewResult.after.recommendations && previewResult.after.recommendations.length > 0 && (
                    <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-5">
                      <h4 className="font-semibold text-[var(--color-accent)] mb-3">Recommendations</h4>
                      <ul className="space-y-2">
                        {previewResult.after.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle2 className="w-4 h-4 text-data-positive shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Changes List */}
                  <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-5">
                    <h4 className="font-semibold text-[var(--color-accent)] mb-3">Proposed Changes</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)]">
                            <th className="text-left py-2 font-medium text-text-secondary">Taxonomy</th>
                            <th className="text-left py-2 font-medium text-text-secondary">Current System</th>
                            <th className="text-left py-2 font-medium text-text-secondary">Proposed System</th>
                            <th className="text-left py-2 font-medium text-text-secondary">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSuggestions.map((s) => (
                            <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0">
                              <td className="py-2">
                                <div className="font-medium text-text-primary">{s.taxonomyName}</div>
                                <div className="text-xs text-text-secondary">{s.taxonomyCode}</div>
                              </td>
                              <td className="py-2 text-text-secondary">
                                <span className="px-2 py-1 bg-action-muted rounded">Unmapped</span>
                              </td>
                              <td className="py-2">
                                <span className="px-2 py-1 bg-data-positive/10 text-data-positive rounded">
                                  {s.suggestedSystemCode}
                                </span>
                              </td>
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-action-muted rounded-full h-2">
                                    <div
                                      className="bg-data-positive h-2 rounded-full"
                                      style={{ width: `${s.confidence * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-text-secondary text-sm">{(s.confidence * 100).toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6 rounded-b-2xl flex justify-between items-center">
              <div className="text-sm text-text-secondary">
                This preview is for planning purposes only. No changes have been saved.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-5 py-2 border border-[var(--color-border)] text-text-secondary hover:bg-action-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprovePreview}
                  disabled={!previewResult || loading}
                  className="px-5 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Proceed to Approval
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};