/**
 * Version History Viewer Component
 * Shows historical versions of content with diff comparison
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  GitBranch,
  Eye,
  RotateCcw,
  ChevronDown,
  Clock,
  User,
  FileText,
} from 'lucide-react';
import type { ContentVersion, MedicalContent } from '../../types/admin-cms';

interface VersionHistoryViewerProps {
  contentId: string;
  currentVersion: number;
  onRestore?: (version: number) => Promise<void>;
  onCompare?: (oldVersion: number, newVersion: number) => void;
}

export function VersionHistoryViewer({
  contentId,
  currentVersion,
  onRestore,
  onCompare,
}: VersionHistoryViewerProps) {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  const toggleVersionExpanded = (versionId: string) => {
    setExpandedVersions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(versionId)) {
        newSet.delete(versionId);
      } else {
        newSet.add(versionId);
      }
      return newSet;
    });
  };

  const toggleVersionSelected = (version: number) => {
    setSelectedVersions((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version);
      } else {
        // Only allow 2 versions to be selected for comparison
        if (prev.length >= 2) {
          const secondVersion = prev[1];
          return secondVersion !== undefined ? [secondVersion, version] : [version];
        }
        return [...prev, version].sort((a, b) => a - b);
      }
    });
  };

  const handleCompare = () => {
    const firstVersion = selectedVersions[0];
    const secondVersion = selectedVersions[1];
    if (
      selectedVersions.length === 2 &&
      onCompare &&
      firstVersion !== undefined &&
      secondVersion !== undefined
    ) {
      onCompare(firstVersion, secondVersion);
    }
  };

  const handleRestore = async (version: number) => {
    if (onRestore && confirm(`Are you sure you want to restore to version ${version}?`)) {
      await onRestore(version);
    }
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]';
      case 'update':
        return 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]';
      case 'publish':
        return 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)]';
      default:
        return 'bg-[var(--color-bg-tertiary)]/20 text-[var(--color-text-muted)]';
    }
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
            <GitBranch className="w-6 h-6 text-[var(--color-accent)]" />
            Version History
          </h3>
          {selectedVersions.length === 2 && (
            <button
              onClick={handleCompare}
              className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:opacity-90 transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Compare v{selectedVersions[0]} ↔ v{selectedVersions[1]}
            </button>
          )}
        </div>
        {selectedVersions.length > 0 && selectedVersions.length < 2 && (
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            Select one more version to compare
          </p>
        )}
      </div>

      {/* Version Timeline */}
      <div className="divide-y divide-[var(--color-border)]">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No version history available</p>
          </div>
        ) : (
          versions.map((version, index) => {
            const isLatest = version.version === currentVersion;
            const isSelected = selectedVersions.includes(version.version);
            const isExpanded = expandedVersions.has(version.id);

            return (
              <div
                key={version.id}
                className={`p-4 hover:bg-[var(--color-bg-tertiary)]/30 transition-colors ${
                  isSelected ? 'bg-[var(--color-accent)]/5' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div className="flex-shrink-0 relative">
                      {isLatest ? (
                        <div className="w-3 h-3 rounded-full bg-[var(--color-accent)] ring-4 ring-[var(--color-accent)]/20" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-[var(--color-border)]" />
                      )}
                    </div>
                    {index < versions.length - 1 && (
                      <div className="w-0.5 h-full min-h-[40px] bg-[var(--color-border)] mt-2" />
                    )}
                  </div>

                  {/* Checkbox for Selection */}
                  <div className="flex-shrink-0 pt-0.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleVersionSelected(version.version)}
                      className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-[var(--color-text-primary)]">
                            v{version.version}
                          </span>
                          {isLatest && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded">
                              CURRENT
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${getChangeTypeColor(
                              version.changeType
                            )}`}
                          >
                            {version.changeType.toUpperCase()}
                          </span>
                        </div>
                        {version.changeDescription && (
                          <p className="text-sm text-[var(--color-text-primary)] mb-2">
                            {version.changeDescription}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {version.changedBy}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(version.changedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isLatest && onRestore && (
                          <button
                            onClick={() => handleRestore(version.version)}
                            className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
                            title="Restore this version"
                          >
                            <RotateCcw className="w-4 h-4 text-[var(--color-text-muted)]" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleVersionExpanded(version.id)}
                          className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
                        >
                          <ChevronDown
                            className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 p-3 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]"
                        >
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                            Content Snapshot
                          </h4>
                          <div className="text-xs space-y-2">
                            {version.content.overview && (
                              <div>
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  Overview:
                                </span>
                                <p className="text-[var(--color-text-muted)] mt-1">
                                  {version.content.overview}
                                </p>
                              </div>
                            )}
                            {version.content.treatment && version.content.treatment.length > 0 && (
                              <div>
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  Treatments:
                                </span>
                                <ul className="text-[var(--color-text-muted)] mt-1 list-disc list-inside">
                                  {version.content.treatment.map((t, i) => (
                                    <li key={i}>{t}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
