import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getApiEndpoint, API_ENDPOINTS } from '../../lib/utils/apiConfig';
import { useAuth } from '@clerk/clerk-react';
import {
  Check,
  X,
  Edit2,
  Trash2,
  Save,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface PreGeneratedQuestion {
  id: string;
  questionType: string;
  system: string | null;
  conditionId: string | null;
  difficulty: string;
  questionData: {
    question?: string;
    vignette?: string;
    options?: string[];
    correctAnswerIndex?: number;
    rationale?: string;
    explanation?: string;
    condition?: string;
  };
  generatedAt: string;
}

type QuestionWithEditState = PreGeneratedQuestion & {
  isEditing?: boolean;
  isExpanded?: boolean;
  editedQuestion?: string;
  editedOptions?: string[];
  editedRationale?: string;
  editedCorrectIndex?: number;
};

const QuestionCurationPanel = () => {
  const [questions, setQuestions] = useState<QuestionWithEditState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const { getToken } = useAuth();

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      // Use curation mode to get raw pre-generated questions for admin review
      const response = await fetch(
        `${getApiEndpoint(API_ENDPOINTS.QUESTIONS_POOL)}?mode=curation`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch questions for curation.');
      }
      const data = (await response.json()) as
        | PreGeneratedQuestion[]
        | { questions?: PreGeneratedQuestion[] };
      // Handle both array response and object with questions property
      const questionArray = Array.isArray(data) ? data : data.questions || [];
      setQuestions(
        questionArray.map((q: PreGeneratedQuestion) => ({
          ...q,
          isEditing: false,
          isExpanded: false,
          editedQuestion: q.questionData?.question || q.questionData?.vignette || '',
          editedOptions: q.questionData?.options || [],
          editedRationale: q.questionData?.rationale || q.questionData?.explanation || '',
          editedCorrectIndex: q.questionData?.correctAnswerIndex ?? 0,
        }))
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleAction = async (
    questionId: string,
    action: 'approve' | 'delete' | 'update',
    payload?: any
  ) => {
    try {
      const token = await getToken();
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.QUESTIONS_CURATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionId, action, ...payload }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || `Failed to ${action} question.`);
      }

      toast.success(
        `Question successfully ${action === 'approve' ? 'approved' : action === 'delete' ? 'deleted' : 'updated'}.`
      );

      if (action === 'approve' || action === 'delete') {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      } else {
        setQuestions((prev) =>
          prev.map((q) => (q.id === questionId ? { ...q, isEditing: false } : q))
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      toast.error(errorMessage);
    }
  };

  const toggleEdit = (id: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, isEditing: !q.isEditing } : q)));
  };

  const toggleExpand = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, isExpanded: !q.isExpanded } : q))
    );
  };

  const handleFieldChange = (id: string, field: string, value: any) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const handleSave = (q: QuestionWithEditState) => {
    handleAction(q.id, 'update', {
      question: {
        question: q.editedQuestion,
        options: q.editedOptions,
        correctAnswerIndex: q.editedCorrectIndex,
        rationale: q.editedRationale,
        system: q.system,
        difficulty: q.difficulty,
      },
    });
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter === 'all') return true;
    return q.system === filter;
  });

  const systems = [...new Set(questions.map((q) => q.system).filter(Boolean))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading questions for curation...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="p-4 bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)] rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>Error: {error}</span>
          <button
            onClick={fetchQuestions}
            className="ml-auto px-3 py-1 bg-[var(--color-data-fail)]/20 rounded-lg hover:bg-[var(--color-data-fail)]/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Question Curation</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Review and approve AI-generated questions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-full text-sm font-medium">
            {filteredQuestions.length} pending
          </span>
          <button
            onClick={fetchQuestions}
            className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filter */}
      {systems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-[var(--color-text-muted)]">Filter:</span>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              filter === 'all'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            All
          </button>
          {systems.map((system) => (
            <button
              key={system}
              onClick={() => setFilter(system!)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filter === system
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              {system}
            </button>
          ))}
        </div>
      )}

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          No questions pending review. Great job! 🎉
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q) => {
            const questionText =
              q.editedQuestion || q.questionData?.question || q.questionData?.vignette || '';
            const options = q.editedOptions || q.questionData?.options || [];
            const rationale =
              q.editedRationale || q.questionData?.rationale || q.questionData?.explanation || '';
            const correctIndex = q.editedCorrectIndex ?? q.questionData?.correctAnswerIndex ?? 0;

            return (
              <div
                key={q.id}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl overflow-hidden"
              >
                {/* Card Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  onClick={() => !q.isEditing && toggleExpand(q.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--color-text-primary)] font-medium line-clamp-2">
                        {questionText.substring(0, 200)}
                        {questionText.length > 200 ? '...' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {q.system && (
                        <span className="px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded">
                          {q.system}
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          q.difficulty === 'easy'
                            ? 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)]'
                            : q.difficulty === 'hard'
                              ? 'bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)]'
                              : 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]'
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      {q.isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {(q.isExpanded || q.isEditing) && (
                  <>
                    <div className="p-4 border-t border-[var(--color-border)] space-y-4">
                      {/* Question Text */}
                      {q.isEditing ? (
                        <textarea
                          value={q.editedQuestion}
                          onChange={(e) =>
                            handleFieldChange(q.id, 'editedQuestion', e.target.value)
                          }
                          className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          rows={4}
                        />
                      ) : (
                        <p className="text-[var(--color-text-primary)]">{questionText}</p>
                      )}

                      {/* Options */}
                      <div className="space-y-2">
                        {options.map((opt, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                q.isEditing && handleFieldChange(q.id, 'editedCorrectIndex', index)
                              }
                              className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-colors ${
                                index === correctIndex
                                  ? 'bg-[var(--color-data-pass)] text-white'
                                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-primary)]'
                              } ${q.isEditing ? 'cursor-pointer' : ''}`}
                              disabled={!q.isEditing}
                              title={q.isEditing ? 'Click to set as correct answer' : ''}
                            >
                              {String.fromCharCode(65 + index)}
                            </button>
                            {q.isEditing ? (
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOptions = [...(q.editedOptions || [])];
                                  newOptions[index] = e.target.value;
                                  handleFieldChange(q.id, 'editedOptions', newOptions);
                                }}
                                className="flex-1 p-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                              />
                            ) : (
                              <span
                                className={`${index === correctIndex ? 'text-[var(--color-data-pass)] font-medium' : 'text-[var(--color-text-secondary)]'}`}
                              >
                                {opt}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Rationale */}
                      <div className="pt-3 border-t border-[var(--color-border)]">
                        <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
                          Rationale:
                        </h4>
                        {q.isEditing ? (
                          <textarea
                            value={q.editedRationale}
                            onChange={(e) =>
                              handleFieldChange(q.id, 'editedRationale', e.target.value)
                            }
                            className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                            rows={4}
                          />
                        ) : (
                          <p className="text-sm text-[var(--color-text-secondary)]">{rationale}</p>
                        )}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="p-4 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)] flex justify-end gap-2">
                      {q.isEditing ? (
                        <>
                          <button
                            onClick={() => toggleEdit(q.id)}
                            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg transition-colors flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(q)}
                            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEdit(q.id);
                            }}
                            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg transition-colors flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(q.id, 'delete');
                            }}
                            className="px-4 py-2 text-sm font-medium text-[var(--color-data-fail)] hover:text-white hover:bg-[var(--color-data-fail)] bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/20 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(q.id, 'approve');
                            }}
                            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/90 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Approve
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuestionCurationPanel;
