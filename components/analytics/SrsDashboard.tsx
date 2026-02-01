import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { FSRSCard, FSRS, Rating, FSRSState, defaultParameters } from '../../lib/fsrs';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint, API_ENDPOINTS } from '../../lib/utils/apiConfig';
import { toast } from 'sonner';
import FSRSInsightCard from './FSRSInsightCard';

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

    srsData.forEach((card) => {
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
        name: `${index * 10}-${(index + 1) * 10 - 1}`,
        count,
      })),
    };
  }, [srsData]);

  if (isLoading) {
    return <div className="text-[var(--color-text-muted)]">Loading SRS Analytics...</div>;
  }

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-[var(--color-text-primary)]">
        Spaced Repetition (SRS) Analytics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl shadow">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)]">
            Projected Retention
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">
            {analytics.retentionRate.toFixed(1)}%
          </p>
        </div>
        <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl shadow">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)]">
            Average Stability (Days)
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">
            {analytics.avgStability.toFixed(1)}
          </p>
        </div>
        <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl shadow">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)]">Reviews Due Today</h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">
            {analytics.upcomingReviews}
          </p>
        </div>
      </div>
      <div>
        <h2 className="text-xl md:text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
          Memory Stability Distribution
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.stabilityDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="var(--color-accent)" name="Number of Items" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* FSRS Insight Card - Per-Topic Drilldown */}
      <div className="mt-6">
        <h2 className="text-xl md:text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
          Topic Deep Dive
        </h2>
        <FSRSInsightCard
          data={{
            conceptName: 'Cardiovascular',
            conditionId: 'cv-demo',
            system: 'Cardiovascular',
            stability: analytics.avgStability || 7.0,
            difficulty: 5.0,
            retrievability: (analytics.retentionRate || 85) / 100,
            state: 'review',
            dueDate: new Date(Date.now() + Math.round(analytics.avgStability || 7) * 86400000),
            reviewCount: 5,
            lastReview: new Date(Date.now() - 3 * 86400000),
            stabilityHistory: [
              {
                date: new Date(Date.now() - 14 * 86400000).toLocaleDateString(),
                stability: (analytics.avgStability || 7) * 0.3,
              },
              {
                date: new Date(Date.now() - 10 * 86400000).toLocaleDateString(),
                stability: (analytics.avgStability || 7) * 0.5,
              },
              {
                date: new Date(Date.now() - 7 * 86400000).toLocaleDateString(),
                stability: (analytics.avgStability || 7) * 0.65,
              },
              {
                date: new Date(Date.now() - 3 * 86400000).toLocaleDateString(),
                stability: (analytics.avgStability || 7) * 0.85,
              },
              { date: new Date().toLocaleDateString(), stability: analytics.avgStability || 7 },
            ],
          }}
          compact={false}
        />
      </div>
    </div>
  );
};

export default SrsDashboard;
