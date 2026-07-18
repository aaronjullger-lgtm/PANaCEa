import { describe, expect, it } from 'vitest';

import { formatTranscript } from './evaluate';

describe('OSCE SPBench transcript formatting', () => {
  it('formats the persisted chat message schema with the correct speakers', () => {
    const transcript = formatTranscript([
      { role: 'user', content: 'When did the chest pain start?' },
      { role: 'assistant', content: 'It started about two hours ago.' },
      { role: 'user', content: 'Does the pain radiate anywhere?' },
    ]);

    expect(transcript).toBe(
      [
        'Student: When did the chest pain start?',
        'Patient: It started about two hours ago.',
        'Student: Does the pain radiate anywhere?',
      ].join('\n'),
    );
  });

  it('preserves the legacy student/text transcript shape', () => {
    const transcript = formatTranscript([
      { role: 'student', text: 'Any shortness of breath?' },
      { role: 'patient', text: 'A little, yes.' },
    ]);

    expect(transcript).toBe(
      [
        'Student: Any shortness of breath?',
        'Patient: A little, yes.',
      ].join('\n'),
    );
  });
});
