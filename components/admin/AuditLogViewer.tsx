/**
 * Audit Log Viewer Component
 * Displays audit trail of all content changes for compliance and tracking
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  User,
  Clock,
  FileText,
  Edit,
  Check,
  X,
  Eye,
  ChevronDown,
  Filter,
  Download,
} from 'lucide-react';
import type { AuditLogEntry, ChangeType } from '../../types/admin-cms';

interface AuditLogViewerProps {
  contentId?: string; // If provided, show logs for specific content
  showFilters?: boolean;
}

export function AuditLogViewer({ contentId, showFilters = true }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChangeType, setSelectedChangeType] = useState<ChangeType | 'all'>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const toggleLogExpanded = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const getChangeTypeIcon = (changeType: ChangeType) => {
    switch (changeType) {
      case 'create':
        return <FileText className="w-4 h-4" />;
      case 'update':
        return <Edit className="w-4 h-4" />;
      case 'delete':
        return <X className="w-4 h-4" />;
      case 'publish':
        return <Check className="w-4 h-4" />;
      case 'approve':
        return <Check className="w-4 h-4" />;
      case 'unpublish':
      case 'reject':
        return <X className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getChangeTypeColor = (changeType: ChangeType) => {
    switch (changeType) {
      case 'create':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'update':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'delete':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'publish':
      case 'approve':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'unpublish':
      case 'reject':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
            <History className="w-6 h-6 text-[var(--color-accent)]" />
            Audit Log
          </h3>
          <button className="px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-muted)]">Filter by:</span>
            </div>
            <select
              value={selectedChangeType}
              onChange={(e) => setSelectedChangeType(e.target.value as ChangeType | 'all')}
              className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
            >
              <option value="all">All Changes</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="publish">Publish</option>
              <option value="unpublish">Unpublish</option>
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
            </select>
          </div>
        )}
      </div>

      {/* Log Entries */}
      <div className="divide-y divide-[var(--color-border)]">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No audit log entries found</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-[var(--color-bg-tertiary)]/30 transition-colors">
              <div className="flex items-start gap-4">
                {/* Timeline Indicator */}
                <div className="flex-shrink-0 pt-1">
                  <div className={`p-2 rounded-lg border ${getChangeTypeColor(log.changeType)}`}>
                    {getChangeTypeIcon(log.changeType)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${getChangeTypeColor(log.changeType)}`}>
                          {log.changeType.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          v{log.version}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-primary)]">
                        {log.changeDescription}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleLogExpanded(log.id)}
                      className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
                    >
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${
                          expandedLogs.has(log.id) ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log.changedBy}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(log.changedAt)}
                    </div>
                    {log.conditionId && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {log.conditionId}
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {expandedLogs.has(log.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 p-3 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]"
                    >
                      <div className="space-y-2 text-xs">
                        {log.changedFields && log.changedFields.length > 0 && (
                          <div>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              Changed Fields:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {log.changedFields.map((field, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded"
                                >
                                  {field}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-[var(--color-text-primary)]">
                            User Role:
                          </span>{' '}
                          <span className="text-[var(--color-text-muted)]">
                            {log.changedByRole}
                          </span>
                        </div>
                        {log.ipAddress && (
                          <div>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              IP Address:
                            </span>{' '}
                            <span className="text-[var(--color-text-muted)]">
                              {log.ipAddress}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-[var(--color-text-primary)]">
                            Timestamp:
                          </span>{' '}
                          <span className="text-[var(--color-text-muted)]">
                            {new Date(log.changedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
