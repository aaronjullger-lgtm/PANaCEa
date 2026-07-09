// Render smoke tests for EncounterLogSidebar — establishes a safety net for the
// PatientEncounterMode active-view decomposition (the parent has no tests).

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EncounterLogSidebar, type EncounterLogSidebarProps } from './EncounterLogSidebar';

// Minimal stand-ins for the structural types the sidebar reads.
const baseSession = {
  id: 'sess-1',
  questions: [] as { questionText: string; response: string }[],
} as unknown as EncounterLogSidebarProps['session'];

const baseClinicalFidelity = {
  rawLabValues: false,
} as unknown as EncounterLogSidebarProps['clinicalFidelity'];

const baseRapportMeter = {} as unknown as EncounterLogSidebarProps['rapportMeter'];

function makeProps(overrides: Partial<EncounterLogSidebarProps> = {}): EncounterLogSidebarProps {
  return {
    showRapport: false,
    rapportMeter: baseRapportMeter,
    session: baseSession,
    physicalFindings: [],
    diagnosticResults: [],
    languageMode: 'english',
    isFidelityModeActive: false,
    clinicalFidelity: baseClinicalFidelity,
    diagnosisFeedback: null,
    userDiagnosis: '',
    isTyping: false,
    typingStatusMessage: '',
    isLoading: false,
    ...overrides,
  };
}

describe('EncounterLogSidebar', () => {
  it('renders the Encounter Log heading', () => {
    render(<EncounterLogSidebar {...makeProps()} />);
    expect(screen.getByText('Encounter Log')).toBeTruthy();
  });

  it('shows the empty-state prompt when there is no activity', () => {
    render(<EncounterLogSidebar {...makeProps()} />);
    expect(
      screen.getByText(/Start the encounter by asking about the patient's history/i)
    ).toBeTruthy();
  });

  it('renders history Q&A entries (English mode passes response through untranslated)', () => {
    const session = {
      id: 'sess-1',
      questions: [{ questionText: 'Any chest pain?', response: 'Yes, since this morning.' }],
    } as unknown as EncounterLogSidebarProps['session'];
    render(<EncounterLogSidebar {...makeProps({ session })} />);
    expect(screen.getByText(/Any chest pain\?/)).toBeTruthy();
    expect(screen.getByText(/Yes, since this morning\./)).toBeTruthy();
    // Empty-state prompt should NOT appear once there is activity.
    expect(screen.queryByText(/Start the encounter by asking/i)).toBeNull();
  });

  it('renders physical-exam findings', () => {
    const physicalFindings = [
      { maneuver: 'Cardiac auscultation', finding: 'S3 gallop present' },
    ] as unknown as EncounterLogSidebarProps['physicalFindings'];
    render(<EncounterLogSidebar {...makeProps({ physicalFindings })} />);
    expect(screen.getByText(/Cardiac auscultation/)).toBeTruthy();
    expect(screen.getByText(/S3 gallop present/)).toBeTruthy();
  });

  it('renders submitted diagnosis feedback (incorrect shows expected answer)', () => {
    const diagnosisFeedback = {
      isCorrect: false,
      correctDiagnosis: 'Inferior STEMI',
      score: 0,
      feedback: 'Reconsider the ECG.',
    } as unknown as EncounterLogSidebarProps['diagnosisFeedback'];
    render(
      <EncounterLogSidebar
        {...makeProps({ diagnosisFeedback, userDiagnosis: 'Pericarditis' })}
      />
    );
    expect(screen.getByText('Pericarditis')).toBeTruthy();
    expect(screen.getByText(/Expected: Inferior STEMI/)).toBeTruthy();
  });

  it('shows the typing status message when the patient is responding', () => {
    render(
      <EncounterLogSidebar
        {...makeProps({ isTyping: true, typingStatusMessage: 'Patient is responding…' })}
      />
    );
    expect(screen.getByText('Patient is responding…')).toBeTruthy();
  });
});
