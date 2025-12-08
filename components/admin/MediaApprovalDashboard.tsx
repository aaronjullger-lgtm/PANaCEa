/**
 * Media Approval Dashboard
 * 
 * Admin interface for reviewing and approving uploaded medical images
 * Implements the "no-use to use folder" workflow
 */

import React, { useState, useEffect } from 'react';
import { X, Check, ThumbsDown, Eye, AlertCircle, TrendingUp } from 'lucide-react';

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
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  approvalRate: number;
}

export function MediaApprovalDashboard() {
  const [pendingMedia, setPendingMedia] = useState<MediaAsset[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);

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

      const response = await fetch(`/api/media/pending?${params}`);
      const data = await response.json();

      if (data.success) {
        setPendingMedia(data.media);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading pending media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (mediaId: string) => {
    try {
      const response = await fetch('/api/media/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          mediaId,
          approvedBy: 'current-user', // TODO: Get from auth context
        }),
      });

      if (response.ok) {
        // Remove from pending list
        setPendingMedia(prev => prev.filter(m => m.id !== mediaId));
        // Reload stats
        loadPendingMedia();
        setSelectedMedia(null);
      }
    } catch (error) {
      console.error('Error approving media:', error);
    }
  };

  const handleReject = async (mediaId: string, reason: string) => {
    try {
      const response = await fetch('/api/media/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          mediaId,
          approvedBy: 'current-user', // TODO: Get from auth context
          rejectionReason: reason,
        }),
      });

      if (response.ok) {
        // Remove from pending list
        setPendingMedia(prev => prev.filter(m => m.id !== mediaId));
        // Reload stats
        loadPendingMedia();
        setSelectedMedia(null);
        setShowRejectionModal(false);
        setRejectionReason('');
      }
    } catch (error) {
      console.error('Error rejecting media:', error);
    }
  };

  const getQualityBadgeColor = (score?: number) => {
    if (!score) return 'bg-gray-500';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading pending media...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F1419] p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Media Approval Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review and approve uploaded medical images for educational use
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1F283A] rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending</p>
                <p className="text-3xl font-bold text-orange-600">{stats.pending}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1F283A] rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Approved</p>
                <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <Check className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1F283A] rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rejected</p>
                <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <ThumbsDown className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1F283A] rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Approval Rate</p>
                <p className="text-3xl font-bold text-blue-600">{stats.approvalRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex gap-2">
          {['all', 'ecg', 'derm', 'radiology', 'labs', 'diagrams'].map(category => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-[#1F283A] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#364154]'
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
          <div className="bg-white dark:bg-[#1F283A] rounded-lg p-12 text-center">
            <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              All caught up!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              No pending media to review at this time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingMedia.map(media => (
              <div
                key={media.id}
                className="bg-white dark:bg-[#1F283A] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image Preview */}
                <div
                  className="relative h-48 bg-gray-200 dark:bg-gray-800 cursor-pointer"
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
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 truncate">
                    {media.filename}
                  </h3>

                  {media.condition && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {media.condition.name}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1 mb-3">
                    {media.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(media.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMedia(media);
                        setShowRejectionModal(true);
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => setSelectedMedia(media)}
                      className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 p-2 rounded-lg transition-colors"
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
          <div className="bg-white dark:bg-[#1F283A] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Media Details
                </h2>
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Quality Score</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedMedia.qualityScore || 'N/A'}/100
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Clinical Image</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedMedia.isClinical ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* AI Analysis */}
              {selectedMedia.aiMetadata?.assessment?.aiAnalysis && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AI Analysis</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">
                    {selectedMedia.aiMetadata.assessment.aiAnalysis.description}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Diagnostic Quality: <span className="font-medium">
                      {selectedMedia.aiMetadata.assessment.aiAnalysis.diagnosticQuality}
                    </span>
                  </p>
                  {selectedMedia.aiMetadata.assessment.aiAnalysis.clinicalFeatures.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Clinical Features:</p>
                      <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                        {selectedMedia.aiMetadata.assessment.aiAnalysis.clinicalFeatures.map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
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
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Issues</h3>
                      <ul className="list-disc list-inside text-red-600 dark:text-red-400">
                        {selectedMedia.aiMetadata.assessment.issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedMedia.aiMetadata.assessment.recommendations.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Recommendations</h3>
                      <ul className="list-disc list-inside text-blue-600 dark:text-blue-400">
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
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Approve for Use
                </button>
                <button
                  onClick={() => setShowRejectionModal(true)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
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
          <div className="bg-white dark:bg-[#1F283A] rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Reject Media
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for rejection:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full h-32 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0F1419] text-gray-900 dark:text-white mb-4"
              placeholder="e.g., Poor image quality, not clinically relevant, duplicate..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedMedia.id, rejectionReason)}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
