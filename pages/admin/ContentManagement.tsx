/**
 * Admin Content Management System (CMS)
 * Main page for viewing, editing, and managing clinical content
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Edit,
  Eye,
  Clock,
  Check,
  X,
  ChevronDown,
  Download,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { InlineSpinner } from '@/components/loading';
import type {
  MedicalContent,
  ContentStatus,
  ContentFilter,
  ContentSort,
} from '../../types/admin-cms';
import type { SystemCode } from '../../types';

interface ContentManagementProps {
  userRole: 'admin' | 'superadmin';
  userId: string;
}

export function ContentManagement({ userRole, userId }: ContentManagementProps) {
  const [content, setContent] = useState<MedicalContent[]>([]);
  const [filteredContent, setFilteredContent] = useState<MedicalContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ContentStatus | 'all'>('all');
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<ContentSort>({ field: 'updatedAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Load content (in production, this would fetch from API/database)
  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setLoading(true);
    try {
      // Dynamically import the content service to avoid loading it in the main bundle
      const { loadAllContent } = await import('../../lib/api/contentService');
      const loadedContent = await loadAllContent();
      setContent(loadedContent);
      setFilteredContent(loadedContent);
    } catch (error) {
      console.error('Failed to load content:', error);
      setContent([]);
      setFilteredContent([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search logic
  useEffect(() => {
    let filtered = [...content];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.condition.toLowerCase().includes(query) ||
          item.conditionId.toLowerCase().includes(query) ||
          item.subcategory.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((item) => item.status === selectedStatus);
    }

    // System filter
    if (selectedSystem !== 'all') {
      filtered = filtered.filter((item) => item.system === selectedSystem);
    }

    // Sort
    filtered.sort((a, b) => {
      const field = sortBy.field;
      let comparison = 0;

      if (field === 'updatedAt') {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (field === 'condition') {
        comparison = a.condition.localeCompare(b.condition);
      } else if (field === 'system') {
        comparison = a.system.localeCompare(b.system);
      } else if (field === 'version') {
        comparison = a.version - b.version;
      } else if (field === 'status') {
        comparison = a.status.localeCompare(b.status);
      }

      return sortBy.direction === 'asc' ? comparison : -comparison;
    });

    setFilteredContent(filtered);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [content, searchQuery, selectedStatus, selectedSystem, sortBy]);

  const getStatusColor = (status: ContentStatus) => {
    switch (status) {
      case 'published':
        return 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)] border-[var(--color-data-pass)]/30';
      case 'approved':
        return 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/30';
      case 'pending_review':
        return 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)] border-[var(--color-data-provisional)]/30';
      case 'draft':
        return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border-[var(--color-border)]';
      case 'archived':
        return 'bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)] border-[var(--color-data-fail)]/30';
      default:
        return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border-[var(--color-border)]';
    }
  };

  const getStatusIcon = (status: ContentStatus) => {
    switch (status) {
      case 'published':
        return <Check className="w-3 h-3" />;
      case 'approved':
        return <Check className="w-3 h-3" />;
      case 'pending_review':
        return <Clock className="w-3 h-3" />;
      case 'draft':
        return <Edit className="w-3 h-3" />;
      case 'archived':
        return <X className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-[var(--color-accent)]" />
            Content Management System
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Manage clinical content, conditions, drugs, and medical education materials
          </p>
        </div>

        {/* Action Bar */}
        <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Search conditions, IDs, categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80 transition-colors flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Content
              </button>
              <button className="px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80 transition-colors" aria-label="Upload content">
                <Upload className="w-4 h-4" aria-hidden="true" />
              </button>
              <button className="px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80 transition-colors" aria-label="Download content">
                <Download className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Expanded Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 pt-4 border-t border-[var(--color-border)]"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value as ContentStatus | 'all')}
                      className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                    >
                      <option value="all">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="pending_review">Pending Review</option>
                      <option value="approved">Approved</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  {/* System Filter */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      System
                    </label>
                    <select
                      value={selectedSystem}
                      onChange={(e) => setSelectedSystem(e.target.value as SystemCode | 'all')}
                      className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                    >
                      <option value="all">All Systems</option>
                      <option value="CV">Cardiovascular</option>
                      <option value="PULM">Pulmonary</option>
                      <option value="GI">Gastrointestinal</option>
                      <option value="NEURO">Neurology</option>
                      <option value="ENDO">Endocrine</option>
                      <option value="RENAL">Renal</option>
                      <option value="HEME">Hematology</option>
                      <option value="ID">Infectious Disease</option>
                      <option value="MSK">Musculoskeletal</option>
                      <option value="DERM">Dermatology</option>
                      <option value="PSYCH">Psychiatry</option>
                      <option value="HEENT">HEENT</option>
                      <option value="GU">Genitourinary</option>
                      <option value="REPRO">Reproductive</option>
                      <option value="PRO">Professional</option>
                    </select>
                  </div>

                  {/* Sort */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      Sort By
                    </label>
                    <select
                      value={`${sortBy.field}-${sortBy.direction}`}
                      onChange={(e) => {
                        const [field, direction] = e.target.value.split('-');
                        setSortBy({ field: field as any, direction: direction as any });
                      }}
                      className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                    >
                      <option value="updatedAt-desc">Last Updated (Newest)</option>
                      <option value="updatedAt-asc">Last Updated (Oldest)</option>
                      <option value="condition-asc">Name (A-Z)</option>
                      <option value="condition-desc">Name (Z-A)</option>
                      <option value="system-asc">System (A-Z)</option>
                      <option value="version-desc">Version (Highest)</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content List */}
        <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] overflow-hidden">
          {loading ? (
            <div
              role="status"
              aria-live="polite"
              aria-label="Loading content"
              className="flex items-center justify-center p-12"
            >
              <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                No content found
              </h3>
              <p className="text-[var(--color-text-muted)] max-w-md">
                No medical content matches your current filters. Try adjusting your search or
                filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Condition
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      System
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Version
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filteredContent
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-[var(--color-bg-tertiary)]/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-[var(--color-text-primary)]">
                              {item.condition}
                            </div>
                            <div className="text-sm text-[var(--color-text-muted)]">
                              {item.subcategory}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded">
                            {item.system}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${getStatusColor(item.status)}`}
                          >
                            {getStatusIcon(item.status)}
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">
                          v{item.version}
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors" aria-label="Preview content">
                              <Eye className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
                            </button>
                            <button className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors" aria-label="Edit content">
                              <Edit className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
                            </button>
                            <button className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors" aria-label="View history">
                              <Clock className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredContent.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-muted)]">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredContent.length)} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredContent.length)} of{' '}
              {filteredContent.length} items
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-[var(--color-text-primary)]">
                Page {currentPage} of {Math.ceil(filteredContent.length / itemsPerPage)}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(Math.ceil(filteredContent.length / itemsPerPage), p + 1)
                  )
                }
                disabled={currentPage >= Math.ceil(filteredContent.length / itemsPerPage)}
                className="px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
