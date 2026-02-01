/**
 * Mock Session Service
 *
 * Provides fake patient/question data for development without a live database.
 * Enable by setting VITE_USE_MOCK=true in .env or .env.local
 *
 * Features:
 * - Deterministic fake data (seeded random for consistency)
 * - Simulates API latency
 * - Covers all main session service methods
 * - Useful for UI development and testing
 */

import type { Question, SessionSettings } from '@/types';

// Define SessionState locally since it's not exported from mainSessionService
interface SessionState {
  sessionId: string;
  startTime: number;
  questionsAnswered: number;
  correctAnswers: number;
  totalTimeMs: number;
  systemPerformance: Record<string, { correct: number; total: number }>;
}

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

/**
 * Simple seeded random for deterministic fake data
 */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const random = seededRandom(42); // Fixed seed for reproducibility

/**
 * Generate a fake UUID
 */
function fakeUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Simulate network latency
 */
function simulateLatency(minMs = 100, maxMs = 500): Promise<void> {
  const delay = minMs + random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================================================
// MOCK QUESTIONS
// ============================================================================

const MOCK_CONDITIONS = [
  { id: 'hypertension', name: 'Hypertension', system: 'CARDIOVASCULAR' },
  { id: 'type-2-diabetes', name: 'Type 2 Diabetes Mellitus', system: 'ENDOCRINE' },
  { id: 'community-acquired-pneumonia', name: 'Community-Acquired Pneumonia', system: 'PULMONARY' },
  { id: 'acute-appendicitis', name: 'Acute Appendicitis', system: 'GASTROINTESTINAL' },
  { id: 'migraine', name: 'Migraine Headache', system: 'NEUROLOGICAL' },
  { id: 'major-depressive-disorder', name: 'Major Depressive Disorder', system: 'PSYCHIATRY' },
  { id: 'acute-otitis-media', name: 'Acute Otitis Media', system: 'HEENT' },
  { id: 'osteoarthritis', name: 'Osteoarthritis', system: 'MUSCULOSKELETAL' },
];

const MOCK_VIGNETTE_TEMPLATES = [
  'A {age}-year-old {gender} presents to the clinic with {symptom} for the past {duration}. {history}. On examination, {findings}. Which of the following is the most likely diagnosis?',
  'A {age}-year-old {gender} is brought to the emergency department with {symptom}. {history}. Vital signs show {vitals}. What is the most appropriate next step in management?',
  'A {age}-year-old {gender} with a history of {pmh} presents with {symptom}. Physical examination reveals {findings}. Laboratory results show {labs}. What is the most appropriate treatment?',
];

const AGES = ['25', '34', '45', '52', '67', '78', '42', '58'];
const GENDERS = ['male', 'female'];
const SYMPTOMS = [
  'chest pain radiating to the left arm',
  'persistent cough with sputum production',
  'severe headache with photophobia',
  'right lower quadrant abdominal pain',
  'progressive fatigue and weight loss',
  'shortness of breath on exertion',
];

/**
 * Generate a single mock question
 */
function generateMockQuestion(index: number): Question {
  const condition = MOCK_CONDITIONS[index % MOCK_CONDITIONS.length]!;
  const template = MOCK_VIGNETTE_TEMPLATES[index % MOCK_VIGNETTE_TEMPLATES.length]!;

  const age = AGES[Math.floor(random() * AGES.length)] ?? '45';
  const gender = GENDERS[Math.floor(random() * GENDERS.length)] ?? 'male';
  const symptom = SYMPTOMS[Math.floor(random() * SYMPTOMS.length)] ?? 'chest pain';

  const vignette = template
    .replace('{age}', age)
    .replace('{gender}', gender)
    .replace('{symptom}', symptom)
    .replace('{duration}', '3 days')
    .replace('{history}', 'Past medical history is significant for hypertension')
    .replace('{findings}', 'tenderness on palpation')
    .replace('{vitals}', 'BP 142/88, HR 88, RR 18, T 37.8°C')
    .replace('{labs}', 'elevated WBC count')
    .replace('{pmh}', 'diabetes');

  const distractors = MOCK_CONDITIONS.filter((c) => c.id !== condition.id)
    .slice(0, 3)
    .map((c) => c.name);

  const correctIndex = Math.floor(random() * 4);
  const allOptions = [...distractors];
  allOptions.splice(correctIndex, 0, condition.name);

  return {
    id: fakeUUID(),
    conditionId: condition.id,
    condition: condition.name,
    system: condition.system as Question['system'],
    topic: condition.system,
    difficulty: (['easy', 'medium', 'hard'] as const)[Math.floor(random() * 3)],
    question: vignette,
    vignette: vignette,
    options: allOptions,
    correctAnswerIndex: correctIndex,
    correctIndex: correctIndex,
    rationale: `${condition.name} is the correct diagnosis based on the clinical presentation. The key findings supporting this diagnosis include the patient's symptoms, physical examination findings, and relevant history.`,
    pearls: [
      `Key diagnostic features of ${condition.name}`,
      'Remember to correlate clinical findings with labs',
    ],
  };
}

/**
 * Generate a batch of mock questions
 */
function generateMockQuestions(count: number): Question[] {
  return Array.from({ length: count }, (_, i) => generateMockQuestion(i));
}

// ============================================================================
// MOCK SESSION STATE
// ============================================================================

let mockSessionState: SessionState | null = null;

// ============================================================================
// MOCK SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Initialize a mock session
 */
export async function initializeSession(): Promise<SessionState> {
  await simulateLatency(50, 150);

  mockSessionState = {
    sessionId: `mock-session-${Date.now()}`,
    startTime: Date.now(),
    questionsAnswered: 0,
    correctAnswers: 0,
    totalTimeMs: 0,
    systemPerformance: {},
  };

  console.log('[MockService] Session initialized:', mockSessionState.sessionId);
  return mockSessionState;
}

/**
 * Get current mock session state
 */
export function getSessionState(): SessionState | null {
  return mockSessionState;
}

/**
 * Get mock pool status
 */
export function getPoolStatus() {
  return {
    available: 100,
    needsGeneration: false,
  };
}

/**
 * Fetch mock session questions
 */
export async function fetchSessionQuestions(
  settings: SessionSettings,
  _token?: string | null,
  count: number = 10
): Promise<{
  questions: Question[];
  analytics: {
    questionsServed: number;
    fromPool: number;
    fromMain: number;
    generated: number;
    fromSeeds: number;
    avgDifficulty: number;
    systemDistribution: Record<string, number>;
  };
  poolStatus: { available: number; needsGeneration: boolean };
}> {
  await simulateLatency(200, 600); // Simulate API call

  const questions = generateMockQuestions(count);

  // Filter by system if specified
  const filteredQuestions =
    settings.focus && settings.focus !== 'all'
      ? questions.filter((q) => {
          const systemMap: Record<string, string> = {
            cardiology: 'CARDIOVASCULAR',
            pulmonology: 'PULMONARY',
            gastroenterology: 'GASTROINTESTINAL',
            neurology: 'NEUROLOGICAL',
            psychiatry: 'PSYCHIATRY',
          };
          return q.system === systemMap[settings.focus || ''] || !systemMap[settings.focus || ''];
        })
      : questions;

  const systemDistribution: Record<string, number> = {};
  filteredQuestions.forEach((q) => {
    systemDistribution[q.system || 'UNKNOWN'] =
      (systemDistribution[q.system || 'UNKNOWN'] || 0) + 1;
  });

  console.log('[MockService] Returning', filteredQuestions.length, 'mock questions');

  return {
    questions: filteredQuestions,
    analytics: {
      questionsServed: filteredQuestions.length,
      fromPool: filteredQuestions.length,
      fromMain: 0,
      generated: 0,
      fromSeeds: 0,
      avgDifficulty: 2.0,
      systemDistribution,
    },
    poolStatus: {
      available: 100 - filteredQuestions.length,
      needsGeneration: false,
    },
  };
}

/**
 * Mock question answer recording
 */
export async function recordAnswer(
  questionId: string,
  isCorrect: boolean,
  timeSpentMs: number
): Promise<void> {
  await simulateLatency(50, 150);

  if (mockSessionState) {
    mockSessionState.questionsAnswered++;
    if (isCorrect) mockSessionState.correctAnswers++;
    mockSessionState.totalTimeMs += timeSpentMs;
  }

  console.log('[MockService] Answer recorded:', { questionId, isCorrect, timeSpentMs });
}

/**
 * Mock session completion
 */
export async function completeSession(): Promise<{
  sessionId: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  totalTimeMs: number;
}> {
  await simulateLatency(100, 300);

  const result = {
    sessionId: mockSessionState?.sessionId || 'unknown',
    totalQuestions: mockSessionState?.questionsAnswered || 0,
    correctAnswers: mockSessionState?.correctAnswers || 0,
    accuracy: mockSessionState
      ? (mockSessionState.correctAnswers / mockSessionState.questionsAnswered) * 100
      : 0,
    totalTimeMs: mockSessionState?.totalTimeMs || 0,
  };

  console.log('[MockService] Session completed:', result);
  mockSessionState = null;

  return result;
}

// ============================================================================
// MOCK PATIENT DATA (for Patient Encounter Mode)
// ============================================================================

export interface MockPatient {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  chiefComplaint: string;
  vitals: {
    bp: string;
    hr: number;
    rr: number;
    temp: number;
    o2sat: number;
  };
  history: string[];
  medications: string[];
}

const MOCK_PATIENTS: MockPatient[] = [
  {
    id: 'mock-patient-1',
    name: 'John Smith',
    age: 58,
    gender: 'male',
    chiefComplaint: 'Chest pain for the past 2 hours',
    vitals: { bp: '158/92', hr: 92, rr: 18, temp: 37.2, o2sat: 97 },
    history: ['Hypertension', 'Type 2 Diabetes', 'Former smoker'],
    medications: ['Lisinopril 10mg', 'Metformin 500mg BID'],
  },
  {
    id: 'mock-patient-2',
    name: 'Sarah Johnson',
    age: 34,
    gender: 'female',
    chiefComplaint: 'Severe headache with nausea',
    vitals: { bp: '118/72', hr: 78, rr: 16, temp: 36.8, o2sat: 99 },
    history: ['Migraine disorder', 'Anxiety'],
    medications: ['Sumatriptan 50mg PRN', 'Sertraline 50mg'],
  },
  {
    id: 'mock-patient-3',
    name: 'Robert Chen',
    age: 72,
    gender: 'male',
    chiefComplaint: 'Shortness of breath and productive cough',
    vitals: { bp: '132/84', hr: 88, rr: 22, temp: 38.4, o2sat: 92 },
    history: ['COPD', 'Coronary artery disease', 'Current smoker'],
    medications: ['Tiotropium inhaler', 'Aspirin 81mg', 'Atorvastatin 40mg'],
  },
];

/**
 * Get a random mock patient
 */
export function getRandomMockPatient(): MockPatient {
  const index = Math.floor(random() * MOCK_PATIENTS.length);
  return MOCK_PATIENTS[index] ?? MOCK_PATIENTS[0]!;
}

/**
 * Get all mock patients
 */
export function getAllMockPatients(): MockPatient[] {
  return [...MOCK_PATIENTS];
}

// ============================================================================
// SERVICE SWITCHING HELPER
// ============================================================================

/**
 * Check if mock mode is enabled
 */
export function isMockModeEnabled(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true';
}

/**
 * Log mock mode status on load
 */
if (typeof window !== 'undefined') {
  const mockEnabled = isMockModeEnabled();
  console.log(
    mockEnabled
      ? '🎭 [MockService] MOCK MODE ENABLED - Using fake data'
      : '🔌 [MockService] Mock mode disabled - Using live API'
  );
}
