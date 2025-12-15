/**
 * Todoist Integration Service
 * 
 * Allows users to export their study plan and question review tasks to Todoist.
 * Integrates with Todoist API to create projects, tasks, and subtasks.
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
      content: `Review Missed Questions: ${topic} (${questions.length} questions)`,
      description: `Review and understand the ${questions.length} questions you missed in ${topic}. Focus on understanding the rationale and key concepts.`,
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
    const labels = task.labels?.map(l => `@${l}`).join(' ') || '';
    
    lines.push(`task,${content} ${labels},${priority},1,,,${date},en,`);
  }
  
  return lines.join('\n');
}

/**
 * Download Todoist CSV file
 */
export function downloadTodoistCSV(tasks: TodoistTask[], filename: string = 'panacea-study-plan.csv') {
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
 * Todoist OAuth configuration and token management
 */
export interface TodoistOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TodoistTokens {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
}

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  is_shared: boolean;
}

/**
 * Generate OAuth URL for Todoist integration
 */
export function getTodoistOAuthUrl(config: TodoistOAuthConfig): string {
  const state = Math.random().toString(36).substring(7);
  // Store state in sessionStorage for validation
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('todoist_oauth_state', state);
  }
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: 'data:read_write',
    state: state,
    response_type: 'code',
  });
  
  return `https://todoist.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  state: string,
  config: TodoistOAuthConfig
): Promise<TodoistTokens> {
  // Validate state parameter
  if (typeof window !== 'undefined') {
    const storedState = sessionStorage.getItem('todoist_oauth_state');
    if (storedState !== state) {
      throw new Error('Invalid OAuth state parameter');
    }
    sessionStorage.removeItem('todoist_oauth_state');
  }

  const response = await fetch('https://todoist.com/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed: ${response.statusText}`);
  }

  const tokens: TodoistTokens = await response.json();
  
  // Store encrypted tokens securely
  await storeTokensSecurely(tokens);
  
  return tokens;
}

/**
 * Store tokens securely with encryption
 */
async function storeTokensSecurely(tokens: TodoistTokens): Promise<void> {
  // In a real implementation, encrypt tokens before storage
  const encryptedTokens = await encryptTokens(tokens);
  localStorage.setItem('todoist_tokens', JSON.stringify(encryptedTokens));
}

/**
 * Retrieve and decrypt stored tokens
 */
async function getStoredTokens(): Promise<TodoistTokens | null> {
  const stored = localStorage.getItem('todoist_tokens');
  if (!stored) return null;
  
  try {
    const encryptedTokens = JSON.parse(stored);
    return await decryptTokens(encryptedTokens);
  } catch (error) {
    console.error('Failed to decrypt stored tokens:', error);
    localStorage.removeItem('todoist_tokens');
    return null;
  }
}

/**
 * Simple encryption for tokens (use proper encryption in production)
 */
async function encryptTokens(tokens: TodoistTokens): Promise<string> {
  // This is a simplified encryption - use proper crypto in production
  const key = await getEncryptionKey();
  const data = JSON.stringify(tokens);
  return btoa(data + key); // Base64 encoding with key
}

/**
 * Simple decryption for tokens
 */
async function decryptTokens(encryptedData: string): Promise<TodoistTokens> {
  const key = await getEncryptionKey();
  const decoded = atob(encryptedData);
  const data = decoded.replace(key, '');
  return JSON.parse(data);
}

/**
 * Get encryption key (derive from user session or environment)
 */
async function getEncryptionKey(): Promise<string> {
  // In production, derive from user session or secure environment variable
  return 'panacea_todoist_key_' + (window.location.hostname || 'localhost');
}

/**
 * Create or get Todoist project for PANaCEa
 */
export async function ensureTodoistProject(projectName: string = 'PANCE Study Plan'): Promise<string> {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('No Todoist authentication found');
  }

  // Get existing projects
  const projects = await getTodoistProjects(tokens.accessToken);
  
  // Check if project already exists
  const existingProject = projects.find(p => p.name === projectName);
  if (existingProject) {
    return existingProject.id;
  }

  // Create new project
  const response = await fetch('https://api.todoist.com/rest/v2/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName,
      color: 'blue',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create Todoist project: ${response.statusText}`);
  }

  const project = await response.json();
  return project.id;
}

/**
 * Get user's Todoist projects
 */
async function getTodoistProjects(accessToken: string): Promise<TodoistProject[]> {
  const response = await fetch('https://api.todoist.com/rest/v2/projects', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Todoist projects: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Export tasks directly to Todoist via API
 */
export async function exportTasksToTodoist(tasks: TodoistTask[]): Promise<void> {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('No Todoist authentication found. Please connect your Todoist account first.');
  }

  const projectId = await ensureTodoistProject();
  
  // Create tasks in batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (task) => {
      const todoistTask = {
        content: task.content,
        description: task.description,
        due_date: task.due_date,
        priority: task.priority || 1,
        project_id: projectId,
        labels: task.labels || [],
      };

      const response = await fetch('https://api.todoist.com/rest/v2/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(todoistTask),
      });

      if (!response.ok) {
        console.error(`Failed to create task: ${task.content}`, response.statusText);
      }
    }));

    // Rate limiting: wait between batches
    if (i + batchSize < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Check if user is connected to Todoist
 */
export async function isTodoistConnected(): Promise<boolean> {
  const tokens = await getStoredTokens();
  if (!tokens) return false;

  // Verify token is still valid
  try {
    const response = await fetch('https://api.todoist.com/rest/v2/projects', {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Disconnect from Todoist
 */
export async function disconnectTodoist(): Promise<void> {
  localStorage.removeItem('todoist_tokens');
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

### Method 2: OAuth Integration (Coming Soon)
We're working on direct OAuth integration with Todoist for one-click exports!

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
