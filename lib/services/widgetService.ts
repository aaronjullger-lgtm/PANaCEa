/**
 * Widget Service
 * 
 * Creates embeddable widgets for Notion, Obsidian, and other note-taking apps.
 * Widgets include "Question of the Day" and "Current Streak" displays.
 */

import type { Question, PerformanceRecord } from '../../types';

export interface WidgetConfig {
  userId: string;
  widgetType: 'question-of-day' | 'streak' | 'stats-summary';
  theme?: 'light' | 'dark';
  accentColor?: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Date | null;
}

/**
 * Calculate current and longest study streak from performance data
 */
export function calculateStreak(performanceData: PerformanceRecord[]): StreakData {
  if (performanceData.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
    };
  }

  // Sort by date (newest first)
  const sorted = [...performanceData].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  // Get unique dates
  const uniqueDates = new Set<string>();
  sorted.forEach(record => {
    const date = new Date(Number(record.timestamp));
    const dateStr = date.toISOString().split('T')[0];
    uniqueDates.add(dateStr);
  });

  const dates = Array.from(uniqueDates).sort().reverse();
  
  if (dates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
    };
  }

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Check if user studied today or yesterday (to maintain streak)
  if (dates[0] === todayStr || dates[0] === yesterdayStr) {
    currentStreak = 1;
    let checkDate = new Date(dates[0]);
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(checkDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      
      if (dates[i] === prevDateStr) {
        currentStreak++;
        checkDate = prevDate;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;
  
  for (let i = 0; i < dates.length - 1; i++) {
    const currentDate = new Date(dates[i]);
    const nextDate = new Date(dates[i + 1]);
    const daysDiff = Math.round((currentDate.getTime() - nextDate.getTime()) / (24 * 60 * 60 * 1000));
    
    if (daysDiff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    lastStudyDate: new Date(dates[0]),
  };
}

/**
 * Generate HTML for streak widget
 */
export function generateStreakWidgetHTML(streakData: StreakData, theme: 'light' | 'dark' = 'light'): string {
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1f2937' : '#ffffff';
  const textColor = isDark ? '#f9fafb' : '#111827';
  const accentColor = isDark ? '#818cf8' : '#6366f1';
  const secondaryColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      padding: 16px;
    }
    .widget {
      background: ${bgColor};
      border: 2px solid ${borderColor};
      border-radius: 12px;
      padding: 20px;
      max-width: 300px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .icon {
      width: 24px;
      height: 24px;
      color: ${accentColor};
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: ${textColor};
    }
    .streak-number {
      font-size: 48px;
      font-weight: 700;
      color: ${accentColor};
      text-align: center;
      margin: 16px 0;
    }
    .streak-label {
      text-align: center;
      font-size: 14px;
      color: ${secondaryColor};
      margin-bottom: 16px;
    }
    .stats {
      display: flex;
      justify-content: space-around;
      padding-top: 16px;
      border-top: 1px solid ${borderColor};
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: ${textColor};
    }
    .stat-label {
      font-size: 12px;
      color: ${secondaryColor};
      margin-top: 4px;
    }
    .emoji {
      font-size: 32px;
      text-align: center;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="widget">
    <div class="header">
      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div class="title">Study Streak</div>
    </div>
    
    ${streakData.currentStreak > 0 ? `
      <div class="emoji">${streakData.currentStreak >= 7 ? '🔥' : '⭐'}</div>
      <div class="streak-number">${streakData.currentStreak}</div>
      <div class="streak-label">${streakData.currentStreak === 1 ? 'Day' : 'Days'} in a row!</div>
    ` : `
      <div class="emoji">📚</div>
      <div class="streak-number">0</div>
      <div class="streak-label">Start your streak today!</div>
    `}
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${streakData.longestStreak}</div>
        <div class="stat-label">Best Streak</div>
      </div>
      <div class="stat">
        <div class="stat-value">${streakData.lastStudyDate ? new Date(streakData.lastStudyDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</div>
        <div class="stat-label">Last Study</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML for Question of the Day widget
 */
export function generateQuestionOfDayHTML(question: Question, theme: 'light' | 'dark' = 'light'): string {
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1f2937' : '#ffffff';
  const textColor = isDark ? '#f9fafb' : '#111827';
  const accentColor = isDark ? '#34d399' : '#10b981';
  const secondaryColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const tagBg = isDark ? '#374151' : '#f3f4f6';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      padding: 16px;
    }
    .widget {
      background: ${bgColor};
      border: 2px solid ${borderColor};
      border-radius: 12px;
      padding: 20px;
      max-width: 500px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .icon {
      width: 24px;
      height: 24px;
      color: ${accentColor};
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: ${textColor};
    }
    .date {
      font-size: 12px;
      color: ${secondaryColor};
    }
    .tags {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .tag {
      background: ${tagBg};
      color: ${secondaryColor};
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .question-text {
      color: ${textColor};
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .options {
      list-style: none;
      margin-bottom: 16px;
    }
    .option {
      color: ${secondaryColor};
      font-size: 13px;
      padding: 8px 12px;
      margin-bottom: 6px;
      background: ${tagBg};
      border-radius: 6px;
      border-left: 3px solid transparent;
    }
    .footer {
      text-align: center;
      padding-top: 12px;
      border-top: 1px solid ${borderColor};
      color: ${secondaryColor};
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="widget">
    <div class="header">
      <div class="header-left">
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <div class="title">Question of the Day</div>
      </div>
      <div class="date">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>
    
    <div class="tags">
      ${question.system ? `<span class="tag">${question.system}</span>` : ''}
      ${question.subcategory ? `<span class="tag">${question.subcategory}</span>` : ''}
    </div>
    
    <div class="question-text">${question.question}</div>
    
    <ol class="options">
      ${question.options.map((opt, idx) => `
        <li class="option">${String.fromCharCode(65 + idx)}) ${opt}</li>
      `).join('')}
    </ol>
    
    <div class="footer">
      Study this question in PANaCEa to see the full explanation!
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate embeddable iframe code for Notion/Obsidian
 */
export function generateEmbedCode(widgetUrl: string, height: number = 400): string {
  return `<iframe src="${widgetUrl}" width="100%" height="${height}" frameborder="0" style="border-radius: 8px;"></iframe>`;
}

/**
 * Generate markdown embed code for Obsidian
 */
export function generateObsidianEmbed(widgetUrl: string): string {
  return `\`\`\`html
<iframe src="${widgetUrl}" width="100%" height="400" frameborder="0" style="border-radius: 8px;"></iframe>
\`\`\``;
}

/**
 * Get a random question for "Question of the Day"
 * In a real implementation, this would be seeded by date to ensure consistency
 */
export function getQuestionOfDay(questions: Question[], date: Date = new Date()): Question | null {
  if (questions.length === 0) return null;
  
  // Use date as seed for consistent daily question
  const dateStr = date.toISOString().split('T')[0];
  const seed = dateStr.split('-').reduce((acc, val) => acc + parseInt(val), 0);
  
  const index = seed % questions.length;
  return questions[index];
}
