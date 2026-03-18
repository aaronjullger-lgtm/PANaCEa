/**
 * System Mappings Management Page
 * Admin-only page for managing SystemMapping entries.
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
  Loader2,
  Shield,
  Tag,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../config/routes';

interface SystemMapping {
  taxonomyCode: string;
  subcategory: string;
  canonicalName: string;
  aliases: string[];
  searchKeywords: string[];
  parentCategory?: string | null;
  blueprintTags: string[];
}

interface MedicalTaxonomy {
  code: string;
  name: string;
  weight: number;
  isActive: boolean;
}

export function SystemMappingsPage() {
  const navigate = useNavigate();
  const { user, getToken } = useAuth();
  const [mappings, setMappings] = useState<SystemMapping[]>([]);
  const [taxonomies, setTaxonomies] = useState<MedicalTaxonomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<SystemMapping | null>(null);
  const [formData, setFormData] = useState({
    taxonomyCode: '',
    subcategory: '',
    canonicalName: '',
    aliases: '',
    searchKeywords: '',
    parentCategory: '',
    blueprintTags: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/system-mappings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error(`Failed to fetch system mappings: ${response.statusText}`);
      }
      const result = await response.json();
      setMappings(result.data?.mappings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const fetchTaxonomies = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/taxonomies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setTaxonomies(result.data?.taxonomies || []);
      }
    } catch (err) {
      // ignore; taxonomies not critical
    }
  }, [getToken]);

  useEffect(() => {
    fetchMappings();
    fetchTaxonomies();
  }, [fetchMappings, fetchTaxonomies]);

  const handleCreate = async () => {
    if (!formData.taxonomyCode.trim() || !formData.subcategory.trim() || !formData.canonicalName.trim()) {
      setError('Taxonomy code, subcategory, and canonical name are required');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const payload = {
        taxonomyCode: formData.taxonomyCode,
        subcategory: formData.subcategory,
        canonicalName: formData.canonicalName,
        aliases: formData.aliases.split(',').map(s => s.trim()).filter(Boolean),
        searchKeywords: formData.searchKeywords.split(',').map(s => s.trim()).filter(Boolean),
        parentCategory: formData.parentCategory || undefined,
        blueprintTags: formData.blueprintTags.split(',').map(s => s.trim()).filter(Boolean),
      };
      const response = await fetch('/api/admin/system-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create mapping');
      }
      await fetchMappings();
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (taxonomyCode: string, subcategory: string, updates: Partial<SystemMapping>) => {
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/system-mappings/${taxonomyCode}/${encodeURIComponent(subcategory)}`, {
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
      await fetchMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (taxonomyCode: string, subcategory: string) => {
    if (!window.confirm(`Delete mapping ${taxonomyCode} - ${subcategory}?`)) return;
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/system-mappings/${taxonomyCode}/${encodeURIComponent(subcategory)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
      }
      await fetchMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const resetForm = () => {
    setFormData({
      taxonomyCode: '',
      subcategory: '',
      canonicalName: '',
      aliases: '',
      searchKeywords: '',
      parentCategory: '',
      blueprintTags: '',
    });
  };

  const openEditModal = (mapping: SystemMapping) => {
    setEditingMapping(mapping);
    setFormData({
      taxonomyCode: mapping.taxonomyCode,
      subcategory: mapping.subcategory,
      canonicalName: mapping.canonicalName,
      aliases: mapping.aliases.join(', '),
      searchKeywords: mapping.searchKeywords.join(', '),
      parentCategory: mapping.parentCategory || '',
      blueprintTags: mapping.blueprintTags.join(', '),
    });
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setEditingMapping(null);
    resetForm();
  };

  const saveEdit = async () => {
    if (!editingMapping) return;
    const updates: Partial<SystemMapping> = {
      canonicalName: formData.canonicalName,
      aliases: formData.aliases.split(',').map(s => s.trim()).filter(Boolean),
      searchKeywords: formData.searchKeywords.split(',').map(s => s.trim()).filter(Boolean),
      parentCategory: formData.parentCategory || undefined,
      blueprintTags: formData.blueprintTags.split(',').map(s => s.trim()).filter(Boolean),
    };
    await handleUpdate(editingMapping.taxonomyCode, editingMapping.subcategory, updates);
    closeModals();
  };

  const getTaxonomyName = (code: string) => {
    const tax = taxonomies.find(t => t.code === code);
    return tax ? `${tax.name} (${tax.weight * 100}%)` : code;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        <span className="ml-2 text-lg">Loading system mappings...</span>
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
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90"
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
            <h1 className="text-3xl font-bold">System Mappings</h1>
            <p className="text-[var(--color-text-secondary)]">Link taxonomy codes to subcategories, canonical names, and search keywords</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Add Mapping
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
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Taxonomy</th>
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Subcategory</th>
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Canonical Name</th>
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Aliases</th>
              <th className="py-3 px-4 text-left font-semibold text-[var(--color-text-primary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-[var(--color-text-muted)]">
                  No system mappings found. Create the first one.
                </td>
              </tr>
            ) : (
              mappings.map((map) => (
                <tr key={`${map.taxonomyCode}-${map.subcategory}`} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold">{map.taxonomyCode}</div>
                    <div className="text-sm text-[var(--color-text-muted)]">{getTaxonomyName(map.taxonomyCode)}</div>
                  </td>
                  <td className="py-3 px-4 font-medium">{map.subcategory}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold">{map.canonicalName}</div>
                    {map.parentCategory && (
                      <div className="text-sm text-[var(--color-text-muted)]">Parent: {map.parentCategory}</div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {map.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {map.aliases.map((alias, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-full text-xs"
                          >
                            <Tag className="w-3 h-3" /> {alias}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(map)}
                        className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded"
                        aria-label="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(map.taxonomyCode, map.subcategory)}
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
      {(showCreateModal || editingMapping) && (
        <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--color-bg-primary)] rounded-2xl p-6 max-w-md w-full shadow-xl"
          >
            <h2 className="text-xl font-bold mb-4">
              {editingMapping ? 'Edit System Mapping' : 'Create New System Mapping'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Taxonomy Code *</label>
                <select
                  value={formData.taxonomyCode}
                  onChange={(e) => setFormData({ ...formData, taxonomyCode: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  disabled={!!editingMapping}
                >
                  <option value="">Select a taxonomy</option>
                  {taxonomies.filter(t => t.isActive).map(tax => (
                    <option key={tax.code} value={tax.code}>
                      {tax.code} – {tax.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subcategory *</label>
                <input
                  type="text"
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  placeholder="e.g., Hypertension"
                  disabled={!!editingMapping}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Canonical Name *</label>
                <input
                  type="text"
                  value={formData.canonicalName}
                  onChange={(e) => setFormData({ ...formData, canonicalName: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  placeholder="e.g., Essential Hypertension"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Aliases (comma‑separated)</label>
                <input
                  type="text"
                  value={formData.aliases}
                  onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  placeholder="e.g., HTN, high blood pressure"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Search Keywords (comma‑separated)</label>
                <input
                  type="text"
                  value={formData.searchKeywords}
                  onChange={(e) => setFormData({ ...formData, searchKeywords: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  placeholder="e.g., systolic, diastolic, antihypertensive"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parent Category (optional)</label>
                <input
                  type="text"
                  value={formData.parentCategory}
                  onChange={(e) => setFormData({ ...formData, parentCategory: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  placeholder="e.g., Cardiovascular Diseases"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Blueprint Tags (comma‑separated)</label>
                <input
                  type="text"
                  value={formData.blueprintTags}
                  onChange={(e) => setFormData({ ...formData, blueprintTags: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  placeholder="e.g., NCCPA, critical, high-yield"
                />
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
                onClick={editingMapping ? saveEdit : handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingMapping ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}