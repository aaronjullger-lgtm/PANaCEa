/**
 * Todoist Integration Service
 *
 * Allows users to export their study plan and question review tasks to a
 * Todoist-compatible CSV. Direct OAuth/API linking is intentionally not
 * implemented client-side because Todoist token exchange requires a client
 * secret and access tokens must not be stored in browser storage.
 */

export interface TodoistTask {
  content: string;
  description?: string;
  due_date?: string; // YYYY-MM-DD format
  priority?: 1 | 2 | 3 | 4; // 4 is highest
  labels?: string[];
  project_id?: string;
}

export interface StudyTaskExport {
  projectName: string;
  tasks: TodoistTask[];
}

/**
 * Generate Todoist tasks from study plan
 */
export function generateStudyTasks(examDate: Date, weeklyPlan: any[]): StudyTaskExport {
  const tasks: TodoistTask[] = [];

  // Add exam date as high-priority task
  tasks.push({
    content: '🎯 PANCE Exam Day',
    description: 'Your PANCE exam is scheduled for today. Good luck!',
    due_date: examDate.toISOString().split('T')[0],
    priority: 4,
    labels: ['exam', 'pance'],
  });

  // Add weekly study tasks
  for (const week of weeklyPlan) {
    const weekStart = new Date(week.startDate);

    // Add week overview task
    tasks.push({
      content: `📚 ${week.weekLabel}: ${week.topics.join(', ')}`,
      description: week.description,
      due_date: weekStart.toISOString().split('T')[0],
      priority: 3,
      labels: ['study', 'weekly-plan'],
    });

    // Add daily study sessions for the week
    for (let day = 0; day < 7; day++) {
      const studyDate = new Date(weekStart);
      studyDate.setDate(studyDate.getDate() + day);

      // Skip if date is in the past
      if (studyDate < new Date()) continue;

      const dayName = studyDate.toLocaleDateString('en-US', { weekday: 'long' });

      tasks.push({
        content: `Study: ${week.topics[0] || 'Review'} (${dayName})`,
        description: `Daily study session for ${week.weekLabel}. Focus: ${week.topics.join(', ')}`,
        due_date: studyDate.toISOString().split('T')[0],
        priority: 2,
        labels: ['study', 'daily'],
      });

      // Add practice questions task (weekdays only)
      if (day < 5) {
        tasks.push({
          content: `Practice Questions: ${week.topics[0] || 'Mixed'}`,
          description: `Complete 20-30 practice questions for ${week.topics.join(', ')}`,
          due_date: studyDate.toISOString().split('T')[0],
          priority: 2,
          labels: ['practice', 'questions'],
        });
      }
    }
  }

  return {
    projectName: 'PANCE Study Plan',
    tasks,
  };
}

/**
 * Generate Todoist tasks from missed questions
 */
export function generateMissedQuestionTasks(missedQuestions: any[]): TodoistTask[] {
  const tasks: TodoistTask[] = [];
  const today = new Date();

  // Group missed questions by topic
  const questionsByTopic = new Map<string, any[]>();
  for (const q of missedQuestions) {
    const topic = q.system || q.subcategory || 'General';
    if (!questionsByTopic.has(topic)) {
      questionsByTopic.set(topic, []);
    }
    questionsByTopic.get(topic)!.push(q);
  }

  // Create review tasks for each topic
  let dayOffset = 0;
  for (const [topic, questions] of questionsByTopic) {
    const reviewDate = new Date(today);
    reviewDate.setDate(reviewDate.getDate() + dayOffset);

    tasks.push({
      content: `To Review: ${topic} (${questions.length} questions)`,
      description: `Review and reinforce the ${questions.length} questions in ${topic}. Focus on understanding the rationale and key concepts.`,
      due_date: reviewDate.toISOString().split('T')[0],
      priority: 3,
      labels: ['review', 'missed-questions', topic.toLowerCase()],
    });

    dayOffset = (dayOffset + 1) % 7; // Spread across the week
  }

  return tasks;
}

/**
 * Generate CSV format for manual import to Todoist
 * Format: TYPE,CONTENT,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE
 */
export function generateTodoistCSV(tasks: TodoistTask[]): string {
  const lines: string[] = [];

  // Add header
  lines.push('TYPE,CONTENT,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE');

  for (const task of tasks) {
    const content = `"${task.content.replace(/"/g, '""')}"`;
    const priority = task.priority || 1;
    const date = task.due_date || '';
    const labels = task.labels?.map((l) => `@${l}`).join(' ') || '';

    lines.push(`task,${content} ${labels},${priority},1,,,${date},en,`);
  }

  return lines.join('\n');
}

/**
 * Download Todoist CSV file
 */
export function downloadTodoistCSV(
  tasks: TodoistTask[],
  filename: string = 'panacea-study-plan.csv'
) {
  const csv = generateTodoistCSV(tasks);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Instructions for manual Todoist import
 */
export const TODOIST_IMPORT_INSTRUCTIONS = `
## How to Import to Todoist:

### Method 1: CSV Import (Recommended)
1. Download the CSV file above
2. Go to Todoist Settings → Integrations → Import from template
3. Select "Import from CSV"
4. Upload the downloaded file
5. Review and confirm the import

### Task Priority Levels:
- Priority 4 (Red): Exam dates and critical milestones
- Priority 3 (Orange): Weekly overviews and review sessions
- Priority 2 (Yellow): Daily study sessions
- Priority 1 (Normal): General tasks

### Labels:
- @exam - Exam day
- @study - Study sessions
- @practice - Practice questions
- @review - Review sessions
- @weekly-plan - Weekly planning tasks
- @missed-questions - Questions to review
- @[topic] - Topic-specific tasks
`.trim();
