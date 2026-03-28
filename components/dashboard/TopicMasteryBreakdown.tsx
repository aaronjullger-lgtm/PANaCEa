import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TASK_TYPES } from '../../lib/taskTypes';

interface TopicProgress {
  [key: string]: {
    stability: number;
    mastery: number;
    state: number;
    nextReview: string | null;
  };
}

interface TopicMasteryBreakdownProps {
  conditionId: string;
  conditionName?: string;
}

export function TopicMasteryBreakdown({ conditionId, conditionName }: TopicMasteryBreakdownProps) {
  const [data, setData] = useState<TopicProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      try {
        const token = await getToken();
        const response = await fetch(`/api/user/topic-progress/${conditionId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (response.ok) {
          const result = (await response.json()) as TopicProgress;
          setData(result);
        } else {
          setError('Unable to load topic mastery data.');
        }
      } catch {
        setError('Unable to load topic mastery data.');
      } finally {
        setLoading(false);
      }
    };

    if (conditionId) {
      fetchData();
    }
  }, [conditionId, getToken]);

  if (loading) return <div className="text-sm text-[var(--color-text-muted)] py-4 text-center">Loading mastery...</div>;
  if (error) return <div className="text-sm text-[var(--color-text-muted)] py-4 text-center">{error}</div>;
  if (!data) return null;

  const taskTypeLabels: Record<string, string> = {
    [TASK_TYPES.DIAGNOSIS]: 'Diagnosis',
    [TASK_TYPES.TREATMENT]: 'Treatment',
    [TASK_TYPES.MECHANISM]: 'Mechanism',
    [TASK_TYPES.WORKUP]: 'Workup',
    [TASK_TYPES.PREVENTION]: 'Prevention',
    [TASK_TYPES.CLINICAL_PEARL]: 'Clinical Pearls',
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{conditionName ? `Mastery: ${conditionName}` : 'Topic Mastery'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(data).map(([type, stats]) => (
          <div key={type} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{taskTypeLabels[type] || type}</span>
              <span className="text-muted-foreground">{Math.round(stats.mastery * 100)}%</span>
            </div>
            <Progress value={stats.mastery * 100} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Stability: {stats.stability.toFixed(1)} days
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
