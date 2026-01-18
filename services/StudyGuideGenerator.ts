import type { PerformanceRecord } from '@/types';

/**
 * Weak topic identified for study guide
 */
export interface WeakTopic {
  topic: string;
  system: string;
  accuracy: number;
  totalQuestions: number;
  commonMistakes: string[];
}

/**
 * Study guide section
 */
export interface StudyGuideSection {
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Complete study guide
 */
export interface StudyGuide {
  title: string;
  generatedDate: string;
  dateRange: { start: string; end: string };
  summary: string;
  weakTopics: WeakTopic[];
  sections: StudyGuideSection[];
  markdownContent: string;
}

/**
 * Get performance data from last N days
 */
function getRecentPerformance(
  performanceData: PerformanceRecord[],
  days: number
): PerformanceRecord[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTimestamp = cutoffDate.getTime();

  return performanceData.filter((record) => record.timestamp >= cutoffTimestamp);
}

/**
 * Identify weak topics from recent performance
 */
function identifyWeakTopics(
  recentPerformance: PerformanceRecord[],
  minQuestions: number = 3
): WeakTopic[] {
  const topicStats: Record<
    string,
    {
      system: string;
      correct: number;
      total: number;
      mistakes: Set<string>;
    }
  > = {};

  // Aggregate stats by topic
  recentPerformance.forEach((record) => {
    const topic = record.topic;
    if (!topicStats[topic]) {
      topicStats[topic] = {
        system: record.system || 'OTHER',
        correct: 0,
        total: 0,
        mistakes: new Set(),
      };
    }

    topicStats[topic].total += 1;
    if (record.isCorrect) {
      topicStats[topic].correct += 1;
    } else {
      // Track error types
      if (record.errorTag) {
        topicStats[topic].mistakes.add(record.errorTag);
      }
    }
  });

  // Convert to WeakTopic array and filter
  const weakTopics: WeakTopic[] = Object.entries(topicStats)
    .filter(([_, stats]) => stats.total >= minQuestions)
    .map(([topic, stats]) => ({
      topic,
      system: stats.system,
      accuracy: (stats.correct / stats.total) * 100,
      totalQuestions: stats.total,
      commonMistakes: Array.from(stats.mistakes),
    }))
    .filter((t) => t.accuracy < 70) // Only include topics with < 70% accuracy
    .sort((a, b) => a.accuracy - b.accuracy); // Weakest first

  return weakTopics.slice(0, 10); // Top 10 weakest topics
}

/**
 * Generate markdown content for study guide
 */
function generateMarkdownContent(studyGuide: StudyGuide): string {
  const { title, generatedDate, dateRange, summary, weakTopics, sections } = studyGuide;

  let markdown = `# ${title}\n\n`;
  markdown += `**Generated:** ${generatedDate}\n\n`;
  markdown += `**Period Covered:** ${dateRange.start} to ${dateRange.end}\n\n`;
  markdown += `---\n\n`;

  markdown += `## Summary\n\n${summary}\n\n`;
  markdown += `---\n\n`;

  // Weak Topics Section
  markdown += `## 📉 Areas Needing Attention\n\n`;
  if (weakTopics.length === 0) {
    markdown += `Great work! No significant weak areas identified in this period.\n\n`;
  } else {
    markdown += `The following topics showed accuracy below 70% and need focused review:\n\n`;
    weakTopics.forEach((topic, index) => {
      markdown += `### ${index + 1}. ${topic.topic} (${topic.system})\n\n`;
      markdown += `- **Accuracy:** ${topic.accuracy.toFixed(1)}%\n`;
      markdown += `- **Questions Attempted:** ${topic.totalQuestions}\n`;
      if (topic.commonMistakes.length > 0) {
        markdown += `- **Common Error Types:** ${topic.commonMistakes.join(', ')}\n`;
      }
      markdown += `\n`;
    });
  }

  markdown += `---\n\n`;

  // Study Recommendations
  sections.forEach((section) => {
    const priorityEmoji =
      section.priority === 'high' ? '🔴' : section.priority === 'medium' ? '🟡' : '🟢';

    markdown += `## ${priorityEmoji} ${section.title}\n\n`;
    markdown += `${section.content}\n\n`;
  });

  markdown += `---\n\n`;
  markdown += `## Next Steps\n\n`;
  markdown += `1. Review the topics listed above with your study materials\n`;
  markdown += `2. Practice questions specifically targeting weak areas\n`;
  markdown += `3. Use spaced repetition to reinforce learning\n`;
  markdown += `4. Revisit this guide weekly to track improvement\n\n`;

  markdown += `*This study guide was automatically generated based on your performance data. `;
  markdown += `Focus on understanding concepts rather than memorization.*\n`;

  return markdown;
}

/**
 * Generate a 1-page study guide from recent performance
 */
export function generateWeeklyStudyGuide(
  performanceData: PerformanceRecord[],
  days: number = 7
): StudyGuide {
  const recentPerformance = getRecentPerformance(performanceData, days);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const dateRange = {
    start: startDate.toLocaleDateString(),
    end: endDate.toLocaleDateString(),
  };

  // Identify weak topics
  const weakTopics = identifyWeakTopics(recentPerformance);

  // Calculate overall stats
  const totalQuestions = recentPerformance.length;
  const correctQuestions = recentPerformance.filter((r) => r.isCorrect).length;
  const overallAccuracy =
    totalQuestions > 0 ? ((correctQuestions / totalQuestions) * 100).toFixed(1) : '0.0';

  // Generate summary
  let summary = `Over the past ${days} days, you attempted ${totalQuestions} questions with an overall accuracy of ${overallAccuracy}%. `;

  if (weakTopics.length > 0) {
    summary += `${weakTopics.length} topic${weakTopics.length > 1 ? 's' : ''} identified for focused review. `;
  } else {
    summary += `Strong performance across all topics! `;
  }

  if (totalQuestions < 20) {
    summary += `Consider increasing practice volume to build a stronger baseline.`;
  } else if (parseFloat(overallAccuracy) > 80) {
    summary += `Excellent work! Continue with maintenance practice.`;
  } else {
    summary += `Focus on the high-yield topics below to improve your score.`;
  }

  // Generate sections with recommendations
  const sections: StudyGuideSection[] = [];

  // Priority topics section
  if (weakTopics.length > 0) {
    const topThree = weakTopics.slice(0, 3);
    sections.push({
      title: 'High-Priority Review Topics',
      content: topThree
        .map(
          (t, i) =>
            `${i + 1}. **${t.topic}** - Current accuracy: ${t.accuracy.toFixed(1)}%. ` +
            `Review core concepts and practice 5-10 questions daily.`
        )
        .join('\n\n'),
      priority: 'high',
    });
  }

  // System-specific recommendations
  const systemPerformance: Record<string, { correct: number; total: number }> = {};
  recentPerformance.forEach((record) => {
    const system = record.system || 'OTHER';
    if (!systemPerformance[system]) {
      systemPerformance[system] = { correct: 0, total: 0 };
    }
    systemPerformance[system].total += 1;
    if (record.isCorrect) systemPerformance[system].correct += 1;
  });

  const weakSystems = Object.entries(systemPerformance)
    .filter(([_, stats]) => stats.total >= 3 && stats.correct / stats.total < 0.7)
    .map(([system, stats]) => ({
      system,
      accuracy: ((stats.correct / stats.total) * 100).toFixed(1),
    }));

  if (weakSystems.length > 0) {
    sections.push({
      title: 'System-Level Focus Areas',
      content: weakSystems
        .map(
          (s) => `- **${s.system}** (${s.accuracy}%): Dedicate focused study time to this system`
        )
        .join('\n'),
      priority: 'medium',
    });
  }

  // Study strategy recommendations
  const strategies: string[] = [];
  const avgAccuracy = parseFloat(overallAccuracy);

  if (avgAccuracy < 50) {
    strategies.push('Start with content review before attempting more questions');
    strategies.push('Use active recall techniques (flashcards, self-testing)');
  } else if (avgAccuracy < 70) {
    strategies.push('Mix content review with practice questions');
    strategies.push('Focus on understanding rationales for incorrect answers');
  } else {
    strategies.push('Continue practice with emphasis on maintaining skills');
    strategies.push('Challenge yourself with harder question sets');
  }

  sections.push({
    title: 'Recommended Study Strategy',
    content: strategies.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    priority: 'medium',
  });

  const studyGuide: StudyGuide = {
    title: `Weekly High-Yield Review (${days}-Day Summary)`,
    generatedDate: endDate.toLocaleDateString(),
    dateRange,
    summary,
    weakTopics,
    sections,
    markdownContent: '', // Will be populated next
  };

  // Generate markdown
  studyGuide.markdownContent = generateMarkdownContent(studyGuide);

  return studyGuide;
}

/**
 * Export study guide to downloadable file
 */
export function exportStudyGuide(studyGuide: StudyGuide): {
  filename: string;
  content: string;
  mimeType: string;
} {
  const filename = `study-guide-${new Date().toISOString().split('T')[0]}.md`;
  return {
    filename,
    content: studyGuide.markdownContent,
    mimeType: 'text/markdown',
  };
}
