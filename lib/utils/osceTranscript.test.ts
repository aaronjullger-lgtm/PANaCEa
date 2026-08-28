import { describe, expect, it } from 'vitest';
import {
  osceMessagesToPatientQuestions,
  patientQuestionsToOSCEChatMessages,
} from './osceTranscript';
import type { PatientQuestion } from '@/types/drill-modes';

describe('osceTranscript utilities', () => {
  it('hydrates saved user and assistant messages into patient questions', () => {
    const questions = osceMessagesToPatientQuestions([
      { role: 'user', content: 'When did the chest pain start?', timestamp: 1_720_000_000_000 },
      { role: 'assistant', content: 'It started two hours ago.' },
      { role: 'user', content: 'Any family history of heart disease?', timestamp: '2026-07-20T11:00:00.000Z' },
      { role: 'assistant', content: 'My father had a heart attack.' },
    ]);

    expect(questions).toEqual([
      {
        questionText: 'When did the chest pain start?',
        category: 'history',
        relevance: 'helpful',
        response: 'It started two hours ago.',
        timestamp: 1_720_000_000_000,
      },
      {
        questionText: 'Any family history of heart disease?',
        category: 'history',
        relevance: 'helpful',
        response: 'My father had a heart attack.',
        timestamp: Date.parse('2026-07-20T11:00:00.000Z'),
      },
    ]);
  });

  it('supports legacy speaker/text transcript rows without dropping existing turns', () => {
    const questions = osceMessagesToPatientQuestions([
      { speaker: 'student', text: 'Do you have shortness of breath?' },
      { speaker: 'patient', text: 'Yes, it is worse with walking.' },
    ]);

    expect(questions).toMatchObject([
      {
        questionText: 'Do you have shortness of breath?',
        category: 'other',
        relevance: 'helpful',
        response: 'Yes, it is worse with walking.',
      },
    ]);
  });

  it('serializes patient questions into the API chat schema', () => {
    const questions: PatientQuestion[] = [
      {
        questionText: 'Any lab tests today?',
        category: 'labs',
        relevance: 'helpful',
        response: 'No tests yet.',
        timestamp: 1,
      },
      {
        questionText: 'Can I examine your heart?',
        category: 'physical',
        relevance: 'helpful',
        response: 'Sure.',
        timestamp: 2,
      },
    ];

    expect(patientQuestionsToOSCEChatMessages(questions)).toEqual([
      { role: 'user', content: 'Any lab tests today?' },
      { role: 'assistant', content: 'No tests yet.' },
      { role: 'user', content: 'Can I examine your heart?' },
      { role: 'assistant', content: 'Sure.' },
    ]);
  });
});
