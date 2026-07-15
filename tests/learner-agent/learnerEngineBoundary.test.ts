import { describe, it, expect } from 'vitest';

/**
 * Ensures learner agent tools are read/compute for NBA and write only via services.
 */
describe('learner engine boundary', () => {
  it('get_next_best_action is read-only category', async () => {
    const { getNextBestActionTool } = await import(
      '@/lib/services/learnerAgent/tools/index'
    );
    expect(getNextBestActionTool.category).toBe('read');
  });

  it('start_study_session is write but does not import fsrs directly', async () => {
    const { startStudySessionTool } = await import(
      '@/lib/services/learnerAgent/tools/index'
    );
    expect(startStudySessionTool.category).toBe('write');
    const src = startStudySessionTool.execute.toString();
    expect(src).not.toContain('schedulingStates');
    expect(src).not.toContain('fsrsStability');
  });

  it('learnerNextActionService does not call Gemini', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/learner/learnerNextActionService.ts'),
      'utf8'
    );
    expect(file).not.toMatch(/gemini|openai|generateContent/i);
  });
});
