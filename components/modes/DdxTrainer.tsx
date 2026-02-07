import React, { useState, useEffect, useCallback } from 'react';
import { DdxProblem } from '../../functions/api/ddx/generate';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint, API_ENDPOINTS } from '../../lib/utils/apiConfig';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import Loader from '../loading/Loader';

const DdxTrainer = () => {
  const [problem, setProblem] = useState<DdxProblem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const { getToken } = useAuth();

  const fetchProblem = useCallback(async () => {
    setIsLoading(true);
    setSelectedAnswer(null);
    setIsRevealed(false);
    try {
      const token = await getToken();
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.DDX_GENERATE), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch new DDx problem.');
      const data = (await response.json()) as DdxProblem;
      setProblem(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProblem();
  }, [fetchProblem]);

  const handleSelectAnswer = (diagnosisName: string) => {
    if (isRevealed) return;
    setSelectedAnswer(diagnosisName);
  };

  const handleSubmit = () => {
    if (!selectedAnswer) {
      toast.info('Please select a diagnosis.');
      return;
    }
    setIsRevealed(true);
  };

  if (isLoading) return <Loader />;
  if (!problem) return <div>No problem loaded. Try refreshing.</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Clinical Vignette</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg leading-relaxed">{problem.vignette}</p>
        </CardContent>
      </Card>

      <h3 className="text-xl font-bold mb-4">Select the most likely diagnosis:</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {problem.diagnoses.map((dx) => (
          <Button
            key={dx.name}
            variant={selectedAnswer === dx.name ? 'default' : 'outline'}
            onClick={() => handleSelectAnswer(dx.name)}
            className={`h-auto text-wrap justify-start p-4 ${
              isRevealed && dx.isCorrect ? 'bg-green-500 hover:bg-green-600 text-white' : ''
            } ${
              isRevealed && selectedAnswer === dx.name && !dx.isCorrect
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : ''
            }`}
          >
            {dx.name}
          </Button>
        ))}
      </div>

      {!isRevealed ? (
        <div className="text-center">
          <Button onClick={handleSubmit}>Submit</Button>
        </div>
      ) : (
        <div>
          <h3 className="text-xl font-bold mb-4">Rationales</h3>
          <div className="space-y-4">
            {Object.entries(problem.rationales).map(([dxName, rationale]) => (
              <Card key={dxName}>
                <CardHeader>
                  <CardTitle
                    className={dxName === problem.correctDiagnosis ? 'text-green-600' : ''}
                  >
                    {dxName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{rationale}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button onClick={fetchProblem}>Next Problem</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DdxTrainer;
