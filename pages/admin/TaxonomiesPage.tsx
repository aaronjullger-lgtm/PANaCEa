/**
 * Taxonomies Management Page
 * Admin-only page for managing MedicalTaxonomy entries.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
} from 'lucide-react';
import { InlineSpinner } from '@/components/loading';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../config/routes';

interface MedicalTaxonomy {
  code: string;
  name: string;
  description?: string | null;
  weight: number;
  isActive: boolean;
}

export function TaxonomiesPage() {
  const navigate = useNavigate();
  const { user, getToken } = useAuth();
  const [taxonomies, setTaxonomies] = useState<MedicalTaxonomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTaxonomy, setEditingTaxonomy] = useState<MedicalTaxonomy | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    weight: 0.11,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchTaxonomies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/taxonomies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error(`Failed to fetch taxonomies: ${response.statusText}`);
      }
      const result = await response.json();
      setTaxonomies(result.data?.taxonomies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchTaxonomies();
  }, [fetchTaxonomies]);

  const handleCreate = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Code and name are required');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/taxonomies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create taxonomy');
      }
      await fetchTaxonomies();
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (code: string, updates: Partial<MedicalTaxonomy>) => {
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/taxonomies/${code}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update');
      }
      await fetchTaxonomies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (code: string, hard = false) => {
    if (!window.confirm(`Delete taxonomy ${code}?`)) return;
    try {
      const token = await getToken();
      const url = `/api/admin/taxonomies/${code}${hard ? '?hard=true' : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
      }
      await fetchTaxonomies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      weight: 0.11,
      isActive: true,
    });
  };

  const openEditModal = (taxonomy: MedicalTaxonomy) => {
    setEditingTaxonomy(taxonomy);
    setFormData({
      code: taxonomy.code,
      name: taxonomy.name,
      description: taxonomy.description || '',
      weight: taxonomy.weight,
      isActive: taxonomy.isActive,
    });
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setEditingTaxonomy(null);
    resetForm();
  };

  const saveEdit = async () => {
    if (!editingTaxonomy) return;
    await handleUpdate(editingTaxonomy.code, formData);
    closeModals();
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading taxonomies"
        className="flex items-center justify-center min-h-screen"
      >
        <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
        <span className="ml-2 text-lg">Loading taxonomies...</span>
      </div>
    );
  }

  if (error && error.includes('Admin access required')) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <Shield className="w-16 h-16 mx-auto text-[var(--color-data-fail)] mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-[var(--color-text-secondary)] mb-6">You must be an administrator to view this page.</p>
        <button
          onClick={() => navigate(ROUTES.HOME)}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:opacity-90"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(ROUTES.ADMIN)}
            className="p-2 rounded-full bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]"
            aria-label="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold">Medical Taxonomies</h1>
            <p className="text-[var(--color-text-secondary)]">Manage system codes, names, and blueprint weights</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Add Taxonomy
        </button>
      </div>

      {error && !error.includes('Admin access required') && (
        <div className="mb-6 p-4 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded-lg text-[var(--color-data-fail)]">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
            <tr>
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Code</th>
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Name</th>
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Weight</th>
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Status</th>
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {taxonomies.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-[var(--color-text-muted)]">
                  No taxonomies found. Create the first one.
                </td>
              </tr>
            ) : (
              taxonomies.map((tax) => (
                <tr key={tax.code} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
                  <td className="py-3 px-4 font-mono">{tax.code}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{tax.name}</div>
                    {tax.description && (
                      <div className="text-sm text-[var(--color-text-muted)]">{tax.description}</div>
                    )}
                  </td>
                  <td className="py-3 px-4">{(tax.weight * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        tax.isActive
                          ? 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)]'
                          : 'bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)]'
                      }`}
                    >
                      {tax.isActive ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" /> Inactive
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(tax)}
                        className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded"
                        aria-label="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tax.code, false)}
                        className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/10 rounded"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTaxonomy) && (
        <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--color-bg-primary)] rounded-2xl p-6 max-w-md w-full shadow-xl"
          >
            <h2 className="text-xl font-bold mb-4">
              {editingTaxonomy ? 'Edit Taxonomy' : 'Create New Taxonomy'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  placeholder="e.g., CV"
                  disabled={!!editingTaxonomy}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  placeholder="e.g., Cardiovascular System"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Weight (0‑1)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm">
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModals}
                className="px-4 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={editingTaxonomy ? saveEdit : handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <InlineSpinner size="sm" />}
                {editingTaxonomy ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}