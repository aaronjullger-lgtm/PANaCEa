/**
 * Content Editor Component
 * Edit medical content with real-time preview and diff view
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Save,
  X,
  Eye,
  Code,
  History,
  Check,
  AlertCircle,
  FileText,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import type { MedicalContent } from '../../types/admin-cms';

interface ContentEditorProps {
  content: MedicalContent | null;
  onSave: (content: Partial<MedicalContent>) => Promise<void>;
  onClose: () => void;
  userRole: 'admin' | 'superadmin';
}

export function ContentEditor({ content, onSave, onClose, userRole }: ContentEditorProps) {
  const [editedContent, setEditedContent] = useState<Partial<MedicalContent>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (content) {
      setEditedContent({ ...content });
    }
  }, [content]);

  useEffect(() => {
    if (content) {
      const changed = JSON.stringify(editedContent) !== JSON.stringify(content);
      setHasChanges(changed);
    }
  }, [editedContent, content]);

  const handleFieldChange = (field: string, value: any) => {
    setEditedContent((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleArrayFieldChange = (field: string, index: number, value: string) => {
    setEditedContent((prev) => {
      const array = (prev[field as keyof typeof prev] as string[]) || [];
      const newArray = [...array];
      newArray[index] = value;
      return {
        ...prev,
        [field]: newArray,
      };
    });
  };

  const handleAddArrayItem = (field: string) => {
    setEditedContent((prev) => {
      const array = (prev[field as keyof typeof prev] as string[]) || [];
      return {
        ...prev,
        [field]: [...array, ''],
      };
    });
  };

  const handleRemoveArrayItem = (field: string, index: number) => {
    setEditedContent((prev) => {
      const array = (prev[field as keyof typeof prev] as string[]) || [];
      const newArray = array.filter((_, i) => i !== index);
      return {
        ...prev,
        [field]: newArray,
      };
    });
  };

  const validateContent = (): boolean => {
    const errors: string[] = [];

    // Required fields
    if (!editedContent.overview || editedContent.overview.trim().length === 0) {
      errors.push('Overview is required');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!validateContent()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(editedContent);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save content:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!content?.condition || !content?.system) {
      setValidationErrors(['Condition name and system are required to generate content']);
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/admin/generate-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conditionName: content.condition,
          system: content.system,
          subcategory: content.subcategory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate content');
      }

      const result = await response.json();
      const generatedContent = result.content;

      // Update the editor with AI-generated content
      setEditedContent((prev) => ({
        ...prev,
        content: generatedContent.content,
      }));
      setHasChanges(true);
    } catch (error: any) {
      console.error('Failed to generate content:', error);
      setValidationErrors([error.message || 'Failed to generate content with AI']);
    } finally {
      setGenerating(false);
    }
  };

  if (!content) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl max-w-6xl w-full my-8"
        >
          {/* Header */}
          <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] p-6 rounded-t-2xl">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3 mb-2">
                  <FileText className="w-7 h-7 text-[var(--color-accent)]" />
                  Edit Content
                </h2>
                <div className="text-sm text-[var(--color-text-muted)]">
                  <span className="font-medium">{content.condition}</span>
                  <span className="mx-2">|</span>
                  <span>
                    {content.system} / {content.subcategory}
                  </span>
                  <span className="mx-2">|</span>
                  <span>Version {content.version}</span>
                </div>
                {hasChanges && (
                  <div className="mt-2 text-sm text-[var(--color-data-provisional)] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Unsaved changes
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--color-text-inverse)] border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Draft
                  </>
                )}
              </button>
              <button
                onClick={handleGenerateWithAI}
                disabled={generating}
                className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate content with AI"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--color-text-inverse)] border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate with AI
                  </>
                )}
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80 transition-colors flex items-center gap-2"
              >
                {showPreview ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPreview ? 'Edit' : 'Preview'}
              </button>
              <button className="px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80 transition-colors flex items-center gap-2">
                <History className="w-4 h-4" />
                History
              </button>
              {userRole === 'superadmin' && (
                <button className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Approve & Publish
                </button>
              )}
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-[var(--color-data-fail)]/10 border-b border-[var(--color-data-fail)]/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--color-data-fail)] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-[var(--color-data-fail)] mb-2">
                    Validation Errors
                  </h3>
                  <ul className="list-disc list-inside text-sm text-[var(--color-data-fail)]/80 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Content Form */}
          <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
            {/* Overview */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Overview <span className="text-[var(--color-data-fail)]">*</span>
              </label>
              <textarea
                value={editedContent.overview || ''}
                onChange={(e) => handleFieldChange('overview', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                placeholder="1-3 sentence summary of the condition..."
              />
            </div>

            {/* Etiology/Pathophysiology */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Etiology & Pathophysiology
              </label>
              <textarea
                value={editedContent.etiologyPathophysiology || ''}
                onChange={(e) => handleFieldChange('etiologyPathophysiology', e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                placeholder="Detailed explanation of causes and mechanism..."
              />
            </div>

            {/* Treatment */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Treatment
              </label>
              <div className="space-y-2">
                {(editedContent.treatment || []).map((treatment, index) => (
                  <div key={index} className="flex gap-2">
                    <textarea
                      value={treatment}
                      onChange={(e) => handleArrayFieldChange('treatment', index, e.target.value)}
                      rows={2}
                      className="flex-1 px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                      placeholder="Treatment option..."
                    />
                    <button
                      onClick={() => handleRemoveArrayItem('treatment', index)}
                      className="px-3 py-2 bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)] rounded-lg hover:bg-[var(--color-data-fail)]/30 transition-colors self-start"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => handleAddArrayItem('treatment')}
                  className="px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80 transition-colors text-sm"
                >
                  + Add Treatment
                </button>
              </div>
            </div>

            {/* Basic Science Links */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Basic Science Links
              </label>
              <p className="text-sm text-[var(--color-text-muted)] mb-3">
                Connect foundational concepts for integrated learning
              </p>
              <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-center text-sm text-[var(--color-text-muted)]">
                Basic science link editor coming soon...
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] p-4 rounded-b-2xl flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-muted)]">
              Last saved:{' '}
              {content.updatedAt ? new Date(content.updatedAt).toLocaleString() : 'Never'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
