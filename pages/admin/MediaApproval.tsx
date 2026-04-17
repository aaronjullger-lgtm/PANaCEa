/**
 * Media Approval Page
 *
 * Admin interface for reviewing and approving uploaded medical images and educational resources.
 * Implements the "Upload -> AI Check -> Human Approve -> Live" workflow.
 *
 * Features:
 * - Gallery view of pending media with filters
 * - Full preview with AI metadata and quality scores
 * - Batch approval/rejection actions
 * - Search and filter capabilities
 *
 * SECURITY NOTE:
 * ---------------
 * Client-side access checks in this component are for UI/UX purposes only.
 * All administrative operations are protected server-side via:
 *   - /api/media/pending - requireAdmin() middleware
 *   - /api/media/approve - requireAdmin() middleware
 *   - /api/media/stats - requireAdmin() middleware
 *
 * The server validates Clerk JWT tokens and verifies admin role in database
 * before allowing any data modification. Client-side checks prevent unnecessary
 * API calls but do NOT provide security.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  ThumbsDown,
  Eye,
  AlertCircle,
  TrendingUp,
  Filter,
  Search,
  RefreshCw,
  FileText,
  Video,
  Music,
  Image,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useUser } from '@clerk/clerk-react';
import { InlineSpinner } from '@/components/loading';

interface MediaAsset {
  id: string;
  filename: string;
  originalUrl: string;
  thumbnailUrl?: string;
  type: string;
  mediaType: string; // 'image' | 'pdf' | 'video' | 'audio'
  tags: string[];
  description?: string;
  qualityScore?: number;
  isClinical: boolean;
  folder: string;
  status: string;
  uploadedAt: string;
  uploadedBy?: string;
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
  condition?: {
    id: string;
    name: string;
    system: string;
  };
  sourceUrl?: string;
  citation?: string;
  textContent?: string;
  pageCount?: number;
  duration?: number;
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  approvalRate: number;
}

interface MediaApprovalProps {
  onClose?: () => void;
}

export function MediaApproval({ onClose }: MediaApprovalProps) {
  const [pendingMedia, setPendingMedia] = useState<MediaAsset[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [batchMode, setBatchMode] = useState(false);

  // Get authenticated user from Clerk
  const { getToken } = useAuth();
  const { user } = useUser();
  const currentUserId = user?.id || 'unknown-user';

  useEffect(() => {
    loadPendingMedia();
  }, [filter]);

  const loadPendingMedia = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        includeStats: 'true',
      });

      if (filter !== 'all') {
        params.append('category', filter);
      }

      const token = await getToken();
      const response = await fetch(`/api/admin/media/pending?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (await response.json()) as {
        success?: boolean;
        media?: MediaAsset[];
        stats?: ApprovalStats | null;
      };
      if (data.success) {
        setPendingMedia(data.media ?? []);
        setStats(data.stats ?? null);
      }
    } catch (error) {
      console.error('Error loading pending media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (mediaId: string) => {
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/media/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mediaId,
          action: 'approve',
        }),
      });

      if (response.ok) {
        setPendingMedia((prev) => prev.filter((m) => m.id !== mediaId));
        setSelectedItems((prev) => {
          const next = new Set(prev);
          next.delete(mediaId);
          return next;
        });
        loadPendingMedia();
        setSelectedMedia(null);
      }
    } catch (error) {
      console.error('Error approving media:', error);
    }
  };

  const handleReject = async (mediaId: string, reason: string) => {
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/media/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mediaId,
          action: 'reject',
          reason,
        }),
      });

      if (response.ok) {
        setPendingMedia((prev) => prev.filter((m) => m.id !== mediaId));
        setSelectedItems((prev) => {
          const next = new Set(prev);
          next.delete(mediaId);
          return next;
        });
        loadPendingMedia();
        setSelectedMedia(null);
        setShowRejectionModal(false);
        setRejectionReason('');
      }
    } catch (error) {
      console.error('Error rejecting media:', error);
    }
  };

  const handleBatchApprove = async () => {
    const promises = Array.from(selectedItems).map((id) => handleApprove(id));
    await Promise.all(promises);
    setSelectedItems(new Set());
    setBatchMode(false);
  };

  const handleBatchReject = () => {
    setShowRejectionModal(true);
  };

  const toggleSelection = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getQualityBadgeColor = (score?: number) => {
    if (!score) return 'bg-[var(--color-bg-tertiary)]';
    if (score >= 80) return 'bg-[var(--color-data-pass)]';
    if (score >= 60) return 'bg-[var(--color-data-provisional)]';
    return 'bg-[var(--color-data-fail)]';
  };

  const getMediaTypeIcon = (mediaType: string) => {
    const iconClass = 'w-5 h-5';
    switch (mediaType) {
      case 'pdf':
        return <FileText className={iconClass} />;
      case 'video':
        return <Video className={iconClass} />;
      case 'audio':
        return <Music className={iconClass} />;
      default:
        return <Image className={iconClass} />;
    }
  };

  const filteredMedia = pendingMedia.filter((media) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        media.filename.toLowerCase().includes(search) ||
        media.tags.some((tag) => tag.toLowerCase().includes(search)) ||
        media.description?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading pending media"
        className="flex items-center justify-center min-h-screen"
      >
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <InlineSpinner size="xl" className="text-[var(--color-accent)]" />
          </div>
          <p className="text-[var(--color-text-muted)]">Loading pending media...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              Media Approval Dashboard
            </h1>
            <p className="text-[var(--color-text-muted)]">
              Review and approve uploaded medical images and educational resources
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              aria-label="Close media approval panel"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setBatchMode(!batchMode)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              batchMode
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
            }`}
          >
            {batchMode ? 'Cancel Batch' : 'Batch Mode'}
          </button>

          {batchMode && selectedItems.size > 0 && (
            <>
              <button
                onClick={handleBatchApprove}
                className="px-4 py-2 bg-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/90 text-[var(--color-text-inverse)] rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Approve {selectedItems.size}
              </button>
              <button
                onClick={handleBatchReject}
                className="px-4 py-2 bg-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/90 text-[var(--color-text-inverse)] rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <ThumbsDown className="w-4 h-4" />
                Reject {selectedItems.size}
              </button>
            </>
          )}

          <button
            onClick={loadPendingMedia}
            className="ml-auto p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search media by filename, tags, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            className="bg-[var(--color-bg-secondary)] rounded-lg p-6 shadow-sm"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-muted)] mb-1">Pending</p>
                <p className="text-3xl font-bold text-[var(--color-data-provisional)]">{stats.pending}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-[var(--color-data-provisional)]" />
            </div>
          </motion.div>

          <motion.div
            className="bg-[var(--color-bg-secondary)] rounded-lg p-6 shadow-sm"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-muted)] mb-1">Approved</p>
                <p className="text-3xl font-bold text-[var(--color-data-pass)]">{stats.approved}</p>
              </div>
              <Check className="w-8 h-8 text-[var(--color-data-pass)]" />
            </div>
          </motion.div>

          <motion.div
            className="bg-[var(--color-bg-secondary)] rounded-lg p-6 shadow-sm"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-muted)] mb-1">Rejected</p>
                <p className="text-3xl font-bold text-[var(--color-data-fail)]">{stats.rejected}</p>
              </div>
              <ThumbsDown className="w-8 h-8 text-[var(--color-data-fail)]" />
            </div>
          </motion.div>

          <motion.div
            className="bg-[var(--color-bg-secondary)] rounded-lg p-6 shadow-sm"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-muted)] mb-1">Approval Rate</p>
                <p className="text-3xl font-bold text-[var(--color-accent)]">
                  {stats.approvalRate}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-[var(--color-accent)]" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-[var(--color-text-muted)]" />
          {['all', 'ecg', 'derm', 'radiology', 'labs', 'diagrams', 'pdf', 'video'].map(
            (category) => (
              <button
                key={category}
                onClick={() => setFilter(category)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === category
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Media Grid */}
      <div className="max-w-7xl mx-auto">
        {filteredMedia.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-12 text-center">
            <Check className="w-16 h-16 text-[var(--color-data-pass)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              All caught up!
            </h3>
            <p className="text-[var(--color-text-muted)]">
              {searchTerm
                ? 'No media matches your search.'
                : 'No pending media to review at this time.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredMedia.map((media) => (
                <motion.div
                  key={media.id}
                  initial={{ scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                    selectedItems.has(media.id) ? 'ring-2 ring-[var(--color-accent)]' : ''
                  }`}
                >
                  {/* Image Preview */}
                  <div
                    className="relative h-48 bg-[var(--color-bg-tertiary)] cursor-pointer"
                    onClick={() => !batchMode && setSelectedMedia(media)}
                  >
                    {batchMode && (
                      <div className="absolute top-2 left-2 z-10">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(media.id)}
                          onChange={() => toggleSelection(media.id)}
                          className="w-5 h-5 rounded"
                        />
                      </div>
                    )}

                    {media.mediaType === 'image' ? (
                      <img
                        src={media.thumbnailUrl || media.originalUrl}
                        alt={media.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl">
                        {getMediaTypeIcon(media.mediaType)}
                      </div>
                    )}

                    <div className="absolute top-2 right-2 flex gap-2">
                      <span
                        className={`${getQualityBadgeColor(media.qualityScore)} text-[var(--color-text-inverse)] text-xs font-bold px-2 py-1 rounded`}
                      >
                        {media.qualityScore || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-[var(--color-text-primary)] truncate flex-1">
                        {media.filename}
                      </h3>
                      <span className="text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] px-2 py-1 rounded ml-2">
                        {media.mediaType}
                      </span>
                    </div>

                    {media.condition && (
                      <p className="text-sm text-[var(--color-text-muted)] mb-2">
                        {media.condition.name}
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
                      {media.tags.length > 3 && (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          +{media.tags.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    {!batchMode && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(media.id)}
                          className="flex-1 bg-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/90 text-[var(--color-text-inverse)] font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMedia(media);
                            setShowRejectionModal(true);
                          }}
                          className="flex-1 bg-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/90 text-[var(--color-text-inverse)] font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => setSelectedMedia(media)}
                          className="bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-muted)] p-2 rounded-lg transition-colors"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedMedia && !showRejectionModal && (
        <div className="fixed inset-0 bg-[var(--color-bg-tertiary)]/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--color-bg-secondary)] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
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

              {/* Full Media Preview */}
              {selectedMedia.mediaType === 'image' ? (
                <img
                  src={selectedMedia.originalUrl}
                  alt={selectedMedia.filename}
                  className="w-full rounded-lg mb-6"
                />
              ) : (
                <div className="w-full h-64 bg-[var(--color-bg-tertiary)] rounded-lg mb-6 flex items-center justify-center text-8xl">
                  {getMediaTypeIcon(selectedMedia.mediaType)}
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-1">Quality Score</p>
                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedMedia.qualityScore || 'N/A'}/100
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-1">Clinical Image</p>
                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedMedia.isClinical ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-1">Media Type</p>
                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedMedia.mediaType}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-1">Folder</p>
                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedMedia.folder}
                  </p>
                </div>
              </div>

              {/* Additional fields for PDFs/Videos */}
              {(selectedMedia.pageCount || selectedMedia.duration) && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {selectedMedia.pageCount && (
                    <div>
                      <p className="text-sm text-[var(--color-text-muted)] mb-1">Pages</p>
                      <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {selectedMedia.pageCount}
                      </p>
                    </div>
                  )}
                  {selectedMedia.duration && (
                    <div>
                      <p className="text-sm text-[var(--color-text-muted)] mb-1">Duration</p>
                      <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {Math.floor(selectedMedia.duration / 60)}:
                        {(selectedMedia.duration % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Source and Citation */}
              {(selectedMedia.sourceUrl || selectedMedia.citation) && (
                <div className="mb-6">
                  {selectedMedia.citation && (
                    <div className="mb-4">
                      <p className="text-sm text-[var(--color-text-muted)] mb-1">Citation</p>
                      <p className="text-sm text-[var(--color-text-secondary)] italic">
                        {selectedMedia.citation}
                      </p>
                    </div>
                  )}
                  {selectedMedia.sourceUrl && (
                    <div>
                      <p className="text-sm text-[var(--color-text-muted)] mb-1">Source URL</p>
                      <a
                        href={selectedMedia.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-accent)] hover:underline"
                      >
                        {selectedMedia.sourceUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* AI Analysis */}
              {selectedMedia.aiMetadata?.assessment?.aiAnalysis && (
                <div className="mb-6">
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                    AI Analysis
                  </h3>
                  <p className="text-[var(--color-text-secondary)] mb-3">
                    {selectedMedia.aiMetadata.assessment.aiAnalysis.description}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)] mb-2">
                    Diagnostic Quality:{' '}
                    <span className="font-medium">
                      {selectedMedia.aiMetadata.assessment.aiAnalysis.diagnosticQuality}
                    </span>
                  </p>
                  {selectedMedia.aiMetadata.assessment.aiAnalysis.clinicalFeatures.length > 0 && (
                    <div>
                      <p className="text-sm text-[var(--color-text-muted)] mb-2">
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
                  className="flex-1 bg-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/90 text-[var(--color-text-inverse)] font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Approve for Use
                </button>
                <button
                  onClick={() => setShowRejectionModal(true)}
                  className="flex-1 bg-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/90 text-[var(--color-text-inverse)] font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ThumbsDown className="w-5 h-5" />
                  Reject
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedMedia && (
        <div className="fixed inset-0 bg-[var(--color-bg-tertiary)]/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--color-bg-secondary)] rounded-lg max-w-md w-full p-6"
          >
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Reject Media
            </h2>
            <p className="text-[var(--color-text-muted)] mb-4">
              Please provide a reason for rejection:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full h-32 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] mb-4 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              placeholder="e.g., Poor image quality, not clinically relevant, duplicate..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                }}
                className="flex-1 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-muted)] font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedMedia.id, rejectionReason)}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/90 disabled:bg-[var(--color-bg-tertiary)] disabled:cursor-not-allowed text-[var(--color-text-inverse)] font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default MediaApproval;
