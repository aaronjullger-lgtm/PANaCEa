/**
 * Media Approval Dashboard
 *
 * Admin interface for reviewing and approving uploaded medical images
 * Implements the "no-use to use folder" workflow
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  X,
  Check,
  ThumbsDown,
  Eye,
  AlertCircle,
  TrendingUp,
  Upload,
  RefreshCw,
} from 'lucide-react';

interface MediaAsset {
  id: string;
  filename: string;
  originalUrl: string;
  thumbnailUrl?: string;
  type: string;
  tags: string[];
  description?: string;
  qualityScore?: number;
  isClinical: boolean;
  uploadedAt: string;
  uploadedBy?: string;
  correctDiagnosis?: string;
  distractors?: string[];
  aiMetadata?: {
    assessment?: {
      issues: string[];
      recommendations: string[];
      aiAnalysis?: {
        description: string;
        clinicalFeatures: string[];
        diagnosticQuality: string;
      };
    };
  };
  Condition?: {
    name: string;
  };
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  approvalRate: number;
}

export function MediaApprovalDashboard() {
  const { getToken } = useAuth();
  const [pendingMedia, setPendingMedia] = useState<MediaAsset[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadPendingMedia = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const params = new URLSearchParams({
        status: 'pending',
      });

      if (filter !== 'all') {
        params.append('category', filter);
      }

      const response = await fetch(`/api/admin/media/upload?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setPendingMedia(data.media || []);
        // Calculate stats from response
        if (data.total !== undefined) {
          const pending = data.media?.length || 0;
          // Fetch approved/rejected counts separately if needed
          setStats({
            pending,
            approved: 0,
            rejected: 0,
            total: data.total,
            approvalRate: 0,
          });
        }
      } else {
        setError(data.error || 'Failed to load media');
      }
    } catch (err) {
      console.error('Error loading pending media:', err);
      setError('Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [filter, getToken]);

  useEffect(() => {
    loadPendingMedia();
  }, [loadPendingMedia]);

  const handleApprove = async (mediaId: string) => {
    try {
      setActionLoading(true);
      const token = await getToken();

      const response = await fetch('/api/admin/media/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'approve',
          mediaId,
        }),
      });

      if (response.ok) {
        setPendingMedia((prev) => prev.filter((m) => m.id !== mediaId));
        setSelectedMedia(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to approve');
      }
    } catch (err) {
      console.error('Error approving media:', err);
      setError('Failed to approve media');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (mediaId: string, reason: string) => {
    try {
      setActionLoading(true);
      const token = await getToken();

      const response = await fetch('/api/admin/media/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'reject',
          mediaId,
          reason,
        }),
      });

      if (response.ok) {
        setPendingMedia((prev) => prev.filter((m) => m.id !== mediaId));
        setSelectedMedia(null);
        setShowRejectionModal(false);
        setRejectionReason('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to reject');
      }
    } catch (err) {
      console.error('Error rejecting media:', err);
      setError('Failed to reject media');
    } finally {
      setActionLoading(false);
    }
  };

  const getQualityBadgeColor = (score?: number) => {
    if (!score) return 'bg-[var(--color-text-muted)]';
    if (score >= 80) return 'bg-[var(--color-data-pass)]';
    if (score >= 60) return 'bg-[var(--color-data-provisional)]';
    return 'bg-[var(--color-data-fail)]';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-secondary)]">Loading pending media...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)] p-6">
      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="bg-[var(--color-bg-error)] border border-[var(--color-border-error)] rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--color-data-fail)]">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-[var(--color-data-fail)] hover:opacity-80"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              Media Approval Dashboard
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              Review and approve uploaded medical images for educational use
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadPendingMedia}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Media
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">Pending</p>
                <p className="text-3xl font-bold text-[var(--color-data-provisional)]">
                  {stats.pending}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-[var(--color-data-provisional)]" />
            </div>
          </div>

          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">Approved</p>
                <p className="text-3xl font-bold text-[var(--color-data-pass)]">{stats.approved}</p>
              </div>
              <Check className="w-8 h-8 text-[var(--color-data-pass)]" />
            </div>
          </div>

          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">Rejected</p>
                <p className="text-3xl font-bold text-[var(--color-data-fail)]">{stats.rejected}</p>
              </div>
              <ThumbsDown className="w-8 h-8 text-[var(--color-data-fail)]" />
            </div>
          </div>

          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">Approval Rate</p>
                <p className="text-3xl font-bold text-[var(--color-accent)]">
                  {stats.approvalRate}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-[var(--color-accent)]" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex gap-2">
          {['all', 'ecg', 'derm', 'radiology', 'labs', 'diagrams'].map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === category
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      <div className="max-w-7xl mx-auto">
        {pendingMedia.length === 0 ? (
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-12 text-center">
            <Check className="w-16 h-16 text-[var(--color-data-pass)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              All caught up!
            </h3>
            <p className="text-[var(--color-text-secondary)]">
              No pending media to review at this time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingMedia.map((media) => (
              <div
                key={media.id}
                className="bg-[var(--color-bg-primary)] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image Preview */}
                <div
                  className="relative h-48 bg-[var(--color-bg-tertiary)] cursor-pointer"
                  onClick={() => setSelectedMedia(media)}
                >
                  <img
                    src={media.thumbnailUrl || media.originalUrl}
                    alt={media.filename}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <span
                      className={`${getQualityBadgeColor(media.qualityScore)} text-white text-xs font-bold px-2 py-1 rounded`}
                    >
                      {media.qualityScore || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4">
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 truncate">
                    {media.filename}
                  </h3>

                  {media.Condition && (
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {media.Condition.name}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1 mb-3">
                    {media.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(media.id)}
                      className="flex-1 bg-[var(--color-data-pass)] hover:opacity-90 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMedia(media);
                        setShowRejectionModal(true);
                      }}
                      className="flex-1 bg-[var(--color-data-fail)] hover:opacity-90 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => setSelectedMedia(media)}
                      className="bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] p-2 rounded-lg transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedMedia && !showRejectionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-primary)] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  Media Details
                </h2>
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Full Image */}
              <img
                src={selectedMedia.originalUrl}
                alt={selectedMedia.filename}
                className="w-full rounded-lg mb-6"
              />

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-1">Quality Score</p>
                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedMedia.qualityScore || 'N/A'}/100
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-1">Clinical Image</p>
                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedMedia.isClinical ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* AI Analysis */}
              {selectedMedia.aiMetadata?.assessment?.aiAnalysis && (
                <div className="mb-6">
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                    AI Analysis
                  </h3>
                  <p className="text-[var(--color-text-secondary)] mb-3">
                    {selectedMedia.aiMetadata.assessment.aiAnalysis.description}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                    Diagnostic Quality:{' '}
                    <span className="font-medium">
                      {selectedMedia.aiMetadata.assessment.aiAnalysis.diagnosticQuality}
                    </span>
                  </p>
                  {selectedMedia.aiMetadata.assessment.aiAnalysis.clinicalFeatures.length > 0 && (
                    <div>
                      <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                        Clinical Features:
                      </p>
                      <ul className="list-disc list-inside text-[var(--color-text-secondary)]">
                        {selectedMedia.aiMetadata.assessment.aiAnalysis.clinicalFeatures.map(
                          (feature, idx) => (
                            <li key={idx}>{feature}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Issues and Recommendations */}
              {selectedMedia.aiMetadata?.assessment && (
                <>
                  {selectedMedia.aiMetadata.assessment.issues.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                        Issues
                      </h3>
                      <ul className="list-disc list-inside text-[var(--color-data-fail)]">
                        {selectedMedia.aiMetadata.assessment.issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedMedia.aiMetadata.assessment.recommendations.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                        Recommendations
                      </h3>
                      <ul className="list-disc list-inside text-[var(--color-accent)]">
                        {selectedMedia.aiMetadata.assessment.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(selectedMedia.id)}
                  className="flex-1 bg-[var(--color-data-pass)] hover:opacity-90 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Approve for Use
                </button>
                <button
                  onClick={() => setShowRejectionModal(true)}
                  className="flex-1 bg-[var(--color-data-fail)] hover:opacity-90 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ThumbsDown className="w-5 h-5" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedMedia && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-primary)] rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Reject Media
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-4">
              Please provide a reason for rejection:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full h-32 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] mb-4"
              placeholder="e.g., Poor image quality, not clinically relevant, duplicate..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                }}
                className="flex-1 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedMedia.id, rejectionReason)}
                disabled={!rejectionReason.trim() || actionLoading}
                className="flex-1 bg-[var(--color-data-fail)] hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {actionLoading ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <MediaUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            loadPendingMedia();
          }}
        />
      )}
    </div>
  );
}

/**
 * Media Upload Modal Component
 */
function MediaUploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { getToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('derm');
  const [correctDiagnosis, setCorrectDiagnosis] = useState('');
  const [distractors, setDistractors] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
    } else {
      setError('Please drop an image file');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const token = await getToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      if (correctDiagnosis) {
        formData.append('correctDiagnosis', correctDiagnosis);
      }

      if (distractors) {
        // Parse comma-separated distractors into JSON array
        const distractorArray = distractors
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);
        formData.append('distractors', JSON.stringify(distractorArray));
      }

      if (description) {
        formData.append('description', description);
      }

      const response = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--color-bg-primary)] rounded-lg max-w-lg w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Upload Medical Image
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* File Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-colors ${
            dragOver
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
              : 'border-[var(--color-border)]'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="w-20 h-20 object-cover rounded"
              />
              <div className="text-left">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{file.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs text-[var(--color-data-fail)] hover:opacity-80 mt-1"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
              <p className="text-[var(--color-text-secondary)] mb-2">
                Drag & drop an image here, or
              </p>
              <label className="cursor-pointer text-[var(--color-accent)] hover:opacity-90">
                browse files
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </>
          )}
        </div>

        {/* Category */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
          >
            <option value="ecg">ECG</option>
            <option value="derm">Dermatology</option>
            <option value="radiology">Radiology</option>
            <option value="labs">Labs</option>
            <option value="diagrams">Diagrams</option>
          </select>
        </div>

        {/* Correct Diagnosis (for drill questions) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Correct Diagnosis (for drill questions)
          </label>
          <input
            type="text"
            value={correctDiagnosis}
            onChange={(e) => setCorrectDiagnosis(e.target.value)}
            placeholder="e.g., Atrial Fibrillation"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
          />
        </div>

        {/* Distractors */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Wrong Answers (comma-separated)
          </label>
          <input
            type="text"
            value={distractors}
            onChange={(e) => setDistractors(e.target.value)}
            placeholder="e.g., Sinus Tachycardia, Atrial Flutter, SVT"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
          />
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the image..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 bg-[var(--color-accent)] hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
