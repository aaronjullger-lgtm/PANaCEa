import type { PatientQuestion, QuestionCategory } from '@/types/drill-modes';

export type OSCEPersistedChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type RawOSCEChatMessage = {
  role?: unknown;
  content?: unknown;
  speaker?: unknown;
  text?: unknown;
  timestamp?: unknown;
};

function normalizeRole(raw: RawOSCEChatMessage): 'user' | 'assistant' | null {
  if (raw.role === 'user' || raw.role === 'student') return 'user';
  if (raw.role === 'assistant' || raw.role === 'model' || raw.role === 'patient') return 'assistant';
  if (raw.speaker === 'student' || raw.speaker === 'user') return 'user';
  if (raw.speaker === 'patient' || raw.speaker === 'assistant' || raw.speaker === 'model') {
    return 'assistant';
  }
  return null;
}

function readContent(raw: RawOSCEChatMessage): string | null {
  const value = typeof raw.content === 'string' ? raw.content : raw.text;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readTimestamp(raw: RawOSCEChatMessage): number {
  if (typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)) {
    return raw.timestamp;
  }
  if (typeof raw.timestamp === 'string') {
    const parsed = Date.parse(raw.timestamp);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function categorizeQuestion(question: string): QuestionCategory {
  const lowerQuestion = question.toLowerCase();
  if (
    lowerQuestion.includes('history') ||
    lowerQuestion.includes('when') ||
    lowerQuestion.includes('how long') ||
    lowerQuestion.includes('family')
  ) {
    return 'history';
  }
  if (
    lowerQuestion.includes('exam') ||
    lowerQuestion.includes('physical') ||
    lowerQuestion.includes('abdomen') ||
    lowerQuestion.includes('heart')
  ) {
    return 'physical';
  }
  if (
    lowerQuestion.includes('lab') ||
    lowerQuestion.includes('test') ||
    lowerQuestion.includes('ecg') ||
    lowerQuestion.includes('xray')
  ) {
    return 'labs';
  }
  return 'other';
}

export function osceMessagesToPatientQuestions(messages: unknown): PatientQuestion[] {
  if (!Array.isArray(messages)) return [];

  const questions: PatientQuestion[] = [];
  let pendingQuestion: { text: string; timestamp: number } | null = null;

  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;

    const raw = message as RawOSCEChatMessage;
    const role = normalizeRole(raw);
    const content = readContent(raw);
    if (!role || !content) continue;

    if (role === 'user') {
      pendingQuestion = { text: content, timestamp: readTimestamp(raw) };
      continue;
    }

    if (pendingQuestion) {
      questions.push({
        questionText: pendingQuestion.text,
        category: categorizeQuestion(pendingQuestion.text),
        relevance: 'helpful',
        response: content,
        timestamp: pendingQuestion.timestamp,
      });
      pendingQuestion = null;
    }
  }

  return questions;
}

export function patientQuestionsToOSCEChatMessages(
  questions: PatientQuestion[],
): OSCEPersistedChatMessage[] {
  return questions.flatMap((question) => [
    { role: 'user' as const, content: question.questionText },
    { role: 'assistant' as const, content: question.response },
  ]);
}
