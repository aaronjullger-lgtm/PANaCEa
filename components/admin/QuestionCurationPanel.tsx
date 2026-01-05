import React, { useState, useEffect, useCallback } from 'react';
import { PreGeneratedQuestion } from '../../types';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { getApiEndpoint, API_ENDPOINTS } from '../../lib/utils/apiConfig';
import { useAuth } from '@clerk/clerk-react';

type QuestionWithEditState = PreGeneratedQuestion & { isEditing?: boolean };

const QuestionCurationPanel = () => {
  const [questions, setQuestions] = useState<QuestionWithEditState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.QUESTIONS_POOL), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch questions for curation.');
      }
      const data: PreGeneratedQuestion[] = await response.json();
      setQuestions(data.map(q => ({ ...q, isEditing: false })));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      toast.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, error]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleAction = async (questionId: string, action: 'approve' | 'delete' | 'update', payload?: any) => {
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
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} question.`);
      }

      toast.success(`Question successfully ${action}d.`);
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      toast.error(errorMessage);
    }
  };

  const toggleEdit = (id: string) => {
    setQuestions(prev =>
      prev.map(q => (q.id === id ? { ...q, isEditing: !q.isEditing } : q))
    );
  };

  const handleFieldChange = (id: string, field: keyof PreGeneratedQuestion, value: any) => {
    setQuestions(prev =>
      prev.map(q => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  if (isLoading) return <div>Loading questions for curation...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold">Question Curation</h2>
      <p>{questions.length} questions pending review.</p>
      {questions.map((q) => (
        <Card key={q.id}>
          <CardHeader>
            <CardTitle>
              {q.isEditing ? (
                <Textarea
                  value={q.question}
                  onChange={(e) => handleFieldChange(q.id, 'question', e.target.value)}
                  className="text-base"
                />
              ) : (
                q.question
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {q.options.map((opt, index) => (
              <div key={index} className="flex items-center">
                {q.isEditing ? (
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const newOptions = [...q.options];
                      newOptions[index] = e.target.value;
                      handleFieldChange(q.id, 'options', newOptions);
                    }}
                  />
                ) : (
                  <p className={`${index === q.correctAnswerIndex ? 'font-bold text-green-600' : ''}`}>
                    {String.fromCharCode(65 + index)}. {opt}
                  </p>
                )}
              </div>
            ))}
            <h4 className="font-semibold mt-2">Rationale:</h4>
            {q.isEditing ? (
              <Textarea
                value={q.rationale}
                onChange={(e) => handleFieldChange(q.id, 'rationale', e.target.value)}
              />
            ) : (
              <p className="text-sm">{q.rationale}</p>
            )}
            {q.imageUrl && <img src={q.imageUrl} alt="Clinical image" className="mt-2 max-w-xs rounded-md" />}
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            {q.isEditing ? (
              <>
                <Button variant="outline" onClick={() => toggleEdit(q.id)}>Cancel</Button>
                <Button onClick={() => handleAction(q.id, 'update', { question: q })}>Save Changes</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => toggleEdit(q.id)}>Edit</Button>
                <Button variant="destructive" onClick={() => handleAction(q.id, 'delete')}>Delete</Button>
                <Button onClick={() => handleAction(q.id, 'approve')}>Approve</Button>
              </>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default QuestionCurationPanel;
