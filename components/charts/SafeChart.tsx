/**
 * SafeChart Component
 * 
 * Recharts wrapper with:
 * - NaN protection (empty state fallback)
 * - Formatted X/Y axis labels
 * - Stormy Slate styling
 */

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface SafeChartProps {
  data: Array<{ x: string | number; y: number }>;
  xLabel: string;
  yLabel: string;
  emptyMessage?: string;
  onStartSession?: () => void;
}

export function SafeChart({ 
  data, 
  xLabel, 
  yLabel, 
  emptyMessage = 'No data yet',
  onStartSession 
}: SafeChartProps) {
  // Filter out NaN/invalid values
  const validData = data.filter(d => 
    typeof d.y === 'number' && !isNaN(d.y) && isFinite(d.y)
  );

  if (validData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)] rounded-lg">
        <TrendingUp className="w-12 h-12 text-[var(--color-text-muted)] mb-3" />
        <p className="text-[var(--color-text-muted)] text-sm mb-4">{emptyMessage}</p>
        {onStartSession && (
          <button
            onClick={onStartSession}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-[var(--color-accent)]/80 transition"
          >
            Start First Session
          </button>
        )}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={validData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="x" 
          stroke="#94a3b8"
          label={{ value: xLabel, position: 'insideBottom', offset: -5, fill: '#cbd5e1' }}
        />
        <YAxis 
          stroke="#94a3b8"
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#cbd5e1' }}
          tickFormatter={(value) => `${Math.round(value)}%`}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#1e293b', 
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#f1f5f9'
          }}
        />
        <Line 
          type="monotone" 
          dataKey="y" 
          stroke="#3b82f6" 
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
