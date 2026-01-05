import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FSRSCard, FSRS, Rating, FSRSState, defaultParameters } from '../../lib/fsrs';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint, API_ENDPOINTS } from '../../lib/utils/apiConfig';
import { toast } from 'sonner';

// Mock function to get user's FSRS data. In a real app, this would be a service call.
async function fetchUserSrsData(userId: string, token: string): Promise<FSRSCard[]> {
  // This is a placeholder. You would fetch this from your backend.
  // Example: GET /api/srs/all-cards
  console.log('Fetching SRS data for user:', userId);
  // Let's generate some mock data based on the FSRS model
  const fsrs = new FSRS();
  const mockData: FSRSCard[] = [];
  for (let i = 0; i < 100; i++) {
    let card = fsrs.createEmptyCard();
    const ratings = [Rating.Good, Rating.Good, Rating.Hard, Rating.Easy, Rating.Again, Rating.Good];
    let now = new Date();
    for (const rating of ratings.slice(0, Math.floor(Math.random() * 6))) {
      const result = fsrs.next(card, now, rating);
      card = result.card;
      now = result.due;
    }
    mockData.push(card);
  }
  return mockData;
}

const SrsDashboard = () => {
  const [srsData, setSrsData] = useState<FSRSCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, getToken } = useAuth();

  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const token = await getToken();
        const data = await fetchUserSrsData(userId, token || '');
        setSrsData(data);
      } catch (error) {
        toast.error('Failed to load SRS analytics data.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [userId, getToken]);

  const analytics = useMemo(() => {
    if (srsData.length === 0) {
      return {
        retentionRate: 0,
        avgStability: 0,
        upcomingReviews: 0,
        stabilityDistribution: [],
      };
    }

    let totalRecalls = 0;
    let successfulRecalls = 0;
    let totalStability = 0;
    let upcomingReviews = 0;
    const now = new Date();

    const stabilityDistribution = Array(10).fill(0);

    srsData.forEach(card => {
      if (card.state === FSRSState.Review) {
        totalRecalls++;
        // Simplified retention: assume if it's in review, it was recalled successfully at least once
        if (card.lapses === 0) successfulRecalls++;
        
        totalStability += card.stability;

        const dueDate = new Date(card.last_review.getTime() + card.scheduled_days * 86400000);
        if (dueDate <= now) {
          upcomingReviews++;
        }

        const stabilityBucket = Math.min(Math.floor(card.stability / 10), 9);
        stabilityDistribution[stabilityBucket]++;
      }
    });

    return {
      retentionRate: totalRecalls > 0 ? (successfulRecalls / totalRecalls) * 100 : 0,
      avgStability: srsData.length > 0 ? totalStability / srsData.length : 0,
      upcomingReviews,
      stabilityDistribution: stabilityDistribution.map((count, index) => ({
        name: `${index * 10}-${(index + 1) * 10 -1}`,
        count,
      })),
    };
  }, [srsData]);

  if (isLoading) return <div>Loading SRS Analytics...</div>;

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Spaced Repetition (SRS) Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow">
          <h3 className="text-sm font-medium text-slate-500">Projected Retention</h3>
          <p className="text-3xl font-bold">{analytics.retentionRate.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow">
          <h3 className="text-sm font-medium text-slate-500">Average Stability (Days)</h3>
          <p className="text-3xl font-bold">{analytics.avgStability.toFixed(1)}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow">
          <h3 className="text-sm font-medium text-slate-500">Reviews Due Today</h3>
          <p className="text-3xl font-bold">{analytics.upcomingReviews}</p>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold mb-4">Memory Stability Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.stabilityDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="var(--color-accent)" name="Number of Items" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SrsDashboard;
