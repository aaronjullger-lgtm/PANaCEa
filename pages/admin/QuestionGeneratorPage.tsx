/**
 * Taxonomy‑Driven Question Generator
 * Admin‑only page for generating PANCE‑style questions based on NCCPA blueprint weights.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
  Eye,
  Save,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../config/routes';

interface MedicalTaxonomy {
  code: string;
  name: string;
  weight: number;
  isActive: boolean;
}

interface SystemMapping {
  taxonomyCode: string;
  subcategory: string;
  canonicalName: string;
}

interface GeneratedQuestion {
  type: string;
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: {
    rationale: string;
    incorrect?: Record<string, string>;
  };
  difficulty: number;
  system?: string;
  metadata?: any;
}

export function QuestionGeneratorPage() {
  const navigate = useNavigate();
  const { user, getToken } = useAuth();
  const [taxonomies, setTaxonomies] = useState<MedicalTaxonomy[]>([]);
  const [mappings, setMappings] = useState<SystemMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [questionType, setQuestionType] = useState('vignette');
  const [count, setCount] = useState(1);
  const [previewIndex, setPreviewIndex] = useState(0);

  const fetchTaxonomies = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/taxonomies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setTaxonomies(result.data?.taxonomies || []);
        if (result.data?.taxonomies?.length > 0 && !selectedTaxonomy) {
          setSelectedTaxonomy(result.data.taxonomies[0].code);
        }
      }
    } catch (err) {
      // ignore
    }
  }, [getToken, selectedTaxonomy]);

  const fetchMappings = useCallback(async () => {
    if (!selectedTaxonomy) return;
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/system-mappings?taxonomyCode=${selectedTaxonomy}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setMappings(result.data?.mappings || []);
        if (result.data?.mappings?.length > 0 && !selectedSubcategory) {
          setSelectedSubcategory(result.data.mappings[0].subcategory);
        }
      }
    } catch (err) {
      // ignore
    }
  }, [getToken, selectedTaxonomy, selectedSubcategory]);

  useEffect(() => {
    fetchTaxonomies();
  }, [fetchTaxonomies]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  useEffect(() => {
    setSelectedSubcategory('');
  }, [selectedTaxonomy]);

  const handleGenerate = async () => {
    if (!selectedTaxonomy) {
      setError('Please select a taxonomy');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          taxonomyCode: selectedTaxonomy,
          subcategory: selectedSubcategory || undefined,
          type: questionType,
          count,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }
      const result = await response.json();
      setGeneratedQuestions(result.data?.questions || []);
      setPreviewIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveQuestion = async (question: GeneratedQuestion) => {
    // TODO: integrate with Question/MedicalContent storage
    toast.info('Question saving is not yet available. This feature is coming soon.');
  };

  const handleRegenerate = () => {
    setGeneratedQuestions([]);
    setError(null);
  };

  const getTaxonomyName = (code: string) => {
    const tax = taxonomies.find(t => t.code === code);
    return tax ? `${tax.name} (${tax.weight * 100}%)` : code;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
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
            <h1 className="text-3xl font-bold">Question Generator</h1>
            <p className="text-[var(--color-text-secondary)]">
              Generate PANCE‑style questions balanced by NCCPA blueprint weights
            </p>
          </div>
        </div>
        <button
          onClick={handleRegenerate}
          className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg flex items-center gap-2 hover:bg-[var(--color-bg-tertiary)]"
          disabled={generatedQuestions.length === 0}
        >
          <RefreshCw className="w-4 h-4" /> Reset
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left panel: controls */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">Generation Parameters</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1">Taxonomy *</label>
                <select
                  value={selectedTaxonomy}
                  onChange={(e) => setSelectedTaxonomy(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                >
                  <option value="">Select a taxonomy</option>
                  {taxonomies.filter(t => t.isActive).map(tax => (
                    <option key={tax.code} value={tax.code}>
                      {tax.code} – {tax.name} ({tax.weight * 100}%)
                    </option>
                  ))}
                </select>
                {selectedTaxonomy && (
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {getTaxonomyName(selectedTaxonomy)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Subcategory (optional)</label>
                <select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                  disabled={mappings.length === 0}
                >
                  <option value="">Any subcategory</option>
                  {mappings.map(map => (
                    <option key={map.subcategory} value={map.subcategory}>
                      {map.subcategory}
                      {map.canonicalName && ` (${map.canonicalName})`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {selectedSubcategory
                    ? `Selected: ${selectedSubcategory}`
                    : 'If left empty, a random subcategory will be chosen.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Question Type</label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg"
                >
                  <option value="vignette">Clinical Vignette (Third‑Order)</option>
                  <option value="mcq">Multiple Choice</option>
                  <option value="contrastive">Contrastive (Compare/Contrast)</option>
                  <option value="simple">Simple Recall</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Number of Questions</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>1</span>
                  <span className="font-semibold">{count}</span>
                  <span>10</span>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || !selectedTaxonomy}
                className="w-full px-4 py-3 bg-[var(--color-accent)] text-white rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Generate Questions
                  </>
                )}
              </button>
            </div>
          </div>

          {generatedQuestions.length > 0 && (
            <div className="mt-6 bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-[var(--color-data-pass)]00" />
                <span className="font-semibold text-[var(--color-data-pass)]00">
                  {generatedQuestions.length} question{generatedQuestions.length > 1 ? 's' : ''} generated
                </span>
              </div>
              <p className="text-sm text-[var(--color-data-pass)]00">
                Questions are ready for preview. You can save them to the database as draft content.
              </p>
            </div>
          )}
        </div>

        {/* Right panel: preview */}
        <div className="lg:col-span-2">
          {generatedQuestions.length === 0 ? (
            <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] shadow-sm p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-[var(--color-bg-tertiary)] rounded-full flex items-center justify-center mb-4">
                <RefreshCw className="w-8 h-8 text-[var(--color-text-muted)]" />
              </div>
              <h3 className="text-xl font-bold mb-2">No questions yet</h3>
              <p className="text-[var(--color-text-secondary)] mb-6">
                Configure the parameters on the left and click “Generate Questions” to start.
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating || !selectedTaxonomy}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Generate Your First Question
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Generated Questions</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-secondary)]">
                    {previewIndex + 1} of {generatedQuestions.length}
                  </span>
                  <button
                    onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                    disabled={previewIndex === 0}
                    className="p-1.5 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setPreviewIndex(i => Math.min(generatedQuestions.length - 1, i + 1))}
                    disabled={previewIndex === generatedQuestions.length - 1}
                    className="p-1.5 disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              </div>

              {generatedQuestions.map((q, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: idx === previewIndex ? 1 : 0, y: 0 }}
                  style={{ display: idx === previewIndex ? 'block' : 'none' }}
                  className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 mb-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full text-sm font-medium">
                        {q.system || selectedTaxonomy}
                        <span className="text-xs">•</span>
                        {q.type}
                        <span className="text-xs">•</span>
                        Difficulty: {q.difficulty.toFixed(1)}
                      </div>
                      <h3 className="text-xl font-bold mt-2">Question</h3>
                    </div>
                    <button
                      onClick={() => handleSaveQuestion(q)}
                      className="px-4 py-2 bg-[var(--color-data-pass)] text-white rounded-lg flex items-center gap-2 hover:bg-[var(--color-data-pass)]"
                    >
                      <Save className="w-4 h-4" /> Save as Draft
                    </button>
                  </div>

                  <div className="prose prose-slate max-w-none mb-6">
                    <p className="text-lg font-medium">{q.question}</p>
                  </div>

                  {q.options && q.options.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold mb-2">Options</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`p-3 border rounded-lg ${opt === q.correctAnswer ? 'border-[var(--color-data-pass)] bg-[var(--color-data-pass)]/10' : 'border-[var(--color-border)]'}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                              <span>{opt}</span>
                              {opt === q.correctAnswer && (
                                <CheckCircle className="w-4 h-4 text-[var(--color-data-pass)] ml-auto" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.explanation && (
                    <div className="border-t pt-6">
                      <h4 className="font-semibold mb-2">Explanation</h4>
                      <p className="text-[var(--color-text-primary)] mb-3">{q.explanation.rationale}</p>
                      {q.explanation.incorrect && Object.keys(q.explanation.incorrect).length > 0 && (
                        <div>
                          <h5 className="font-medium mb-1">Why other options are incorrect:</h5>
                          <ul className="list-disc pl-5 text-[var(--color-text-primary)]">
                            {Object.entries(q.explanation.incorrect).map(([key, reason]) => (
                              <li key={key}>
                                <span className="font-mono">{key}:</span> {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6 flex justify-between items-center text-sm text-[var(--color-text-muted)]">
                    <div>
                      <span className="font-medium">Taxonomy:</span> {selectedTaxonomy} – {getTaxonomyName(selectedTaxonomy)}
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleSaveQuestion(q)}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => toast.info('Edit functionality is coming soon.')}
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setGeneratedQuestions(prev => prev.filter((_, i) => i !== idx))}
                        className="text-[var(--color-data-fail)] hover:text-[var(--color-data-fail)]/80"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setPreviewIndex(0)}
                  disabled={previewIndex === 0}
                  className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg disabled:opacity-30"
                >
                  First
                </button>
                <div className="flex items-center gap-2">
                  {generatedQuestions.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPreviewIndex(idx)}
                      className={`w-2 h-2 rounded-full ${idx === previewIndex ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
                      aria-label={`Go to question ${idx + 1}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setPreviewIndex(generatedQuestions.length - 1)}
                  disabled={previewIndex === generatedQuestions.length - 1}
                  className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg disabled:opacity-30"
                >
                  Last
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}