/**
 * Tests for the LangGraph runtime agent registry, dispatcher, and each
 * individual agent. All AI calls are mocked so the graph executes against
 * deterministic stubs.
 *
 * @module tests/agents-runtime.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const routeTask = vi.fn();
  const routeStructured = vi.fn();
  return { routeTask, routeStructured };
});

vi.mock('@/lib/langchain/router', () => ({
  routeTask: mocks.routeTask,
  routeStructured: mocks.routeStructured,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.routeTask.mockReset();
  mocks.routeStructured.mockReset();
});

import { clearRegistryForTests } from '@/lib/agents/shared/runtime';

beforeEach(async () => {
  clearRegistryForTests();
  vi.resetModules();
  await import('@/lib/agents/encounter/standardizedPatient');
  await import('@/lib/agents/encounter/intentRouter');
  await import('@/lib/agents/encounter/spbenchGrader');
  await import('@/lib/agents/encounter/ddxGenerator');
  await import('@/lib/agents/encounter/diagnosticWorkupAdvisor');
  await import('@/lib/agents/encounter/feedbackSummarizer');
  await import('@/lib/agents/encounter/soapNoteGrader');
  await import('@/lib/agents/ops/callGeminiAuditor');
});

const ctx = { env: { GEMINI_API_KEY: 'test-key' } };

describe('agent registry', () => {
  it('lists all registered agents with their tier', async () => {
    const { listAgents } = await import('@/lib/agents/shared/runtime');
    const names = listAgents().map((a) => a.name);
    expect(names).toContain('standardized-patient');
    expect(names).toContain('intent-router');
    expect(names).toContain('spbench-grader');
    expect(names).toContain('callgemini-auditor');
  });

  it('returns not_found for an unknown agent name', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('does-not-exist', {}, ctx);
    expect(r.status).toBe('internal_error');
    expect(r.error?.message).toContain('not found');
    expect(r.output).toBeNull();
  });
});

describe('standardized-patient agent', () => {
  it('returns env_missing when ctx.env.GEMINI_API_KEY is absent', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('standardized-patient', {
      sessionId: 's1',
      studentUtterance: 'Where does it hurt?',
    }, { env: {} });
    expect(r.status).toBe('env_missing');
    expect(r.error?.cause).toBe('standardized-patient.env');
  });

  it('returns schema_invalid when studentUtterance is empty', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('standardized-patient', {
      sessionId: 's1',
      studentUtterance: '',
    }, ctx);
    expect(r.status).toBe('schema_invalid');
    expect(r.error?.cause).toBe('standardized-patient.input');
  });

  it('returns the SP reply via routeTask', async () => {
    mocks.routeTask.mockResolvedValue({
      output: 'It started two hours ago, right after lunch.',
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 80,
      usage: { inputTokens: 20, outputTokens: 18, totalTokens: 38 },
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('standardized-patient', {
      sessionId: 'sp-1',
      studentUtterance: 'Can you tell me when the pain started?',
      priorTurns: [
        { role: 'student', text: 'Hello, I am here to see you.' },
        { role: 'patient', text: 'Thank you doctor.' },
      ],
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.patientReply).toContain('two hours ago');
    expect(mocks.routeTask).toHaveBeenCalledOnce();
    const callArgs = mocks.routeTask.mock.calls[0];
    expect(callArgs[0]).toBe('osce-chat');
    expect(callArgs[2].userPrompt).toContain('Can you tell me');
    expect(callArgs[2].userPrompt).toContain('Hello, I am here to see you');
  });

  it('detects closure when SP reply contains [end]', async () => {
    mocks.routeTask.mockResolvedValue({
      output: '[end of encounter] Thank you doctor.',
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 50,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('standardized-patient', {
      sessionId: 'sp-2',
      studentUtterance: 'Wrap-up.',
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.closureRequested).toBe(true);
  });
});

describe('intent-router agent', () => {
  it('returns env_missing when ctx.env.GEMINI_API_KEY is absent', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('intent-router', {
      studentUtterance: 'How long has it been hurting?',
    }, { env: {} });
    expect(r.status).toBe('env_missing');
  });

  it('returns the classified intent via routeStructured', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: { intent: 'history_question' },
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 12,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('intent-router', {
      studentUtterance: 'How long has the pain been present?',
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.intent).toBe('history_question');
    expect(mocks.routeStructured).toHaveBeenCalledOnce();
    const callArgs = mocks.routeStructured.mock.calls[0];
    expect(callArgs[0]).toBe('extraction');
  });

  it('exposes the chosen intent in telemetry', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: { intent: 'assessment_present' },
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 12,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('intent-router', {
      studentUtterance: 'My diagnosis is sepsis.',
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.telemetry?.intent).toBe('assessment_present');
  });
});

describe('spbench-grader agent', () => {
  const sampleTranscript = [
    { role: 'student', text: 'How long has the pain been present?', ts: new Date().toISOString() },
    { role: 'patient', text: 'About three days, doctor.', ts: new Date().toISOString() },
    { role: 'student', text: 'My diagnosis is pericarditis.', ts: new Date().toISOString() },
  ];

  it('returns env_missing when ctx.env.GEMINI_API_KEY is absent', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('spbench-grader', {
      sessionId: 'sg-1',
      transcript: sampleTranscript,
    }, { env: {} });
    expect(r.status).toBe('env_missing');
    expect(r.error?.cause).toBe('spbench-grader.env');
  });

  it('returns schema_invalid when transcript is empty', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('spbench-grader', {
      sessionId: 'sg-2',
      transcript: [],
    }, ctx);
    expect(r.status).toBe('schema_invalid');
    expect(r.error?.cause).toBe('spbench-grader.input');
  });

  it('returns graded SPBench scores via routeStructured', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: {
        QC: 78, CC: 65, CD: 72, RC: 80, LC: 70, LN: 85, CS: 75, PD: 82,
        overallScore: 75,
        justification: 'Student covered HPI adequately but missed PMH allergies.',
      },
      model: 'gemini-2.5-pro',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 1500,
      usage: { inputTokens: 800, outputTokens: 250, totalTokens: 1050 },
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('spbench-grader', {
      sessionId: 'sg-3',
      transcript: sampleTranscript,
      intentLog: [{ intent: 'history_question', studentText: 'How long has the pain been present?' }],
      studentDiagnosis: 'pericarditis',
      correctDiagnosis: 'Acute pericarditis',
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.overallScore).toBe(75);
    expect(r.output?.QC).toBe(78);
    expect(r.output?.gradedBy).toContain('gemini');
    expect(mocks.routeStructured).toHaveBeenCalledOnce();
    const callArgs = mocks.routeStructured.mock.calls[0];
    expect(callArgs[0]).toBe('clinical-reasoning');
  });

  it('surfaces overall score in telemetry', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: {
        QC: 50, CC: 50, CD: 50, RC: 50, LC: 50, LN: 50, CS: 50, PD: 50,
        overallScore: 50,
        justification: 'Average performance across all dimensions.',
      },
      model: 'gemini-2.5-pro',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 1200,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('spbench-grader', {
      sessionId: 'sg-4',
      transcript: sampleTranscript,
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.telemetry?.overallScore).toBe(50);
    expect(r.telemetry?.sessionId).toBe('sg-4');
  });
});

describe('callgemini-auditor agent', () => {
  it('scans the current repo and finds callGemini references', { timeout: 15000 }, async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('callgemini-auditor', {
      rootDir: process.cwd(),
      maxFiles: 5000,
    }, { env: {} });

    expect(r.status).toBe('ok');
    expect(r.output?.totalFilesScanned).toBeGreaterThan(0);
    expect(r.output?.summary.totalCallSites).toBeGreaterThanOrEqual(1);
    expect(r.output?.summary.direct_callGemini).toBeGreaterThanOrEqual(1);
    const aiServiceFindings = r.output?.callSites.filter((c) => c.file.includes('ai-service.ts')) ?? [];
    expect(aiServiceFindings.length).toBeGreaterThan(0);
  });

  it('returns schema_invalid when maxFiles is zero', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('callgemini-auditor', {
      maxFiles: 0,
    }, { env: {} });
    expect(r.status).toBe('schema_invalid');
  });
});

describe('dispatcher never-throws contract', () => {
  it('returns internal_error when an agent throws synchronously', async () => {
    // Register a fake agent that throws directly.
    const { registerAgent, invokeAgent } = await import('@/lib/agents/shared/runtime');
    registerAgent({
      name: 'throwing-agent',
      description: 'test',
      tier: 'encounter',
      async invoke() { throw new Error('boom'); },
    });
    const r = await invokeAgent('throwing-agent', {}, ctx);
    expect(r.status).toBe('internal_error');
    expect(r.error?.message).toContain('boom');
    expect(r.output).toBeNull();
  });

  it('returns internal_error when an agent rejects asynchronously', async () => {
    const { registerAgent, invokeAgent } = await import('@/lib/agents/shared/runtime');
    registerAgent({
      name: 'rejecting-agent',
      description: 'test',
      tier: 'encounter',
      async invoke() { return Promise.reject(new Error('async boom')); },
    });
    const r = await invokeAgent('rejecting-agent', {}, ctx);
    expect(r.status).toBe('internal_error');
    expect(r.error?.message).toContain('async boom');
  });
});

// ─── Batch 1: Encounter Agents (4 new) ───────────────────────────────────

describe('ddx-generator agent', () => {
  it('returns env_missing without GEMINI_API_KEY', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('ddx-generator', { sessionId: 'd1', chiefComplaint: 'Chest pain', hpiFindings: 'Crushing substernal pain' }, { env: {} });
    expect(r.status).toBe('env_missing');
  });

  it('returns ranked differentials via routeStructured', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: {
        differentials: [
          { diagnosis: 'ACS', probability: 'high', supportingFindings: ['Crushing pain'], nextStep: 'ECG + troponin' },
          { diagnosis: 'GERD', probability: 'low', supportingFindings: ['Postprandial'], nextStep: 'PPI trial' },
        ],
        mustNotMiss: ['ACS', 'PE'],
        reasoningSummary: 'Crushing substernal pain in this demographic is high-risk for ACS.',
      },
      model: 'gemini-2.5-pro', provider: 'gemini', attempts: 1, latencyMs: 800,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('ddx-generator', { sessionId: 'd2', chiefComplaint: 'Chest pain', hpiFindings: 'Crushing substernal pain, diaphoresis', patientAge: 55, patientSex: 'M' }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.differentials.length).toBeGreaterThanOrEqual(1);
    expect(r.output?.mustNotMiss).toContain('ACS');
  });
});

describe('diagnostic-workup-advisor agent', () => {
  it('returns env_missing without GEMINI_API_KEY', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('diagnostic-workup-advisor', { sessionId: 'w1', chiefComplaint: 'Dyspnea', hpiFindings: 'Progressive SOB' }, { env: {} });
    expect(r.status).toBe('env_missing');
  });

  it('returns prioritized workup recommendations', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: {
        recommendations: [
          { study: 'CBC', category: 'lab', priority: 'routine', rationale: 'Check for infection', expectedFinding: 'Elevated WBC' },
          { study: 'CXR', category: 'imaging', priority: 'urgent', rationale: 'Rule out pneumonia', expectedFinding: 'Infiltrate' },
        ],
        totalEstimatedCost: 'low',
        summary: 'Focus on ruling out respiratory infection and cardiac causes.',
      },
      model: 'gemini-2.5-flash', provider: 'gemini', attempts: 1, latencyMs: 600,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('diagnostic-workup-advisor', { sessionId: 'w2', chiefComplaint: 'Dyspnea', hpiFindings: '3 days progressive SOB, fever', workingDdx: ['Pneumonia', 'CHF'] }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.recommendations.length).toBeGreaterThanOrEqual(1);
  });
});

describe('feedback-summarizer agent', () => {
  it('returns env_missing without GEMINI_API_KEY', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('feedback-summarizer', {
      sessionId: 'f1',
      scores: { QC: 60, CC: 50, CD: 55, RC: 65, LC: 50, LN: 70, CS: 60, PD: 75, overallScore: 58, justification: 'Average performance.' },
    }, { env: {} });
    expect(r.status).toBe('env_missing');
  });

  it('returns actionable coaching feedback', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: {
        overallAssessment: 'You gathered a focused history but missed key PMH elements.',
        strengths: ['Good open-ended questioning technique'],
        improvements: [{ area: 'Case Coverage', specificFeedback: 'You did not ask about allergies.', actionableStep: 'Always ask "Do you have any drug allergies?" as part of PMH.' }],
        studyRecommendation: 'Review the PMH checklist in the HPI chapter of your PANCE prep book.',
        encouragementLevel: 'developing',
      },
      model: 'gemini-2.5-flash', provider: 'gemini', attempts: 1, latencyMs: 700,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('feedback-summarizer', {
      sessionId: 'f2',
      scores: { QC: 60, CC: 50, CD: 55, RC: 65, LC: 50, LN: 70, CS: 60, PD: 75, overallScore: 58, justification: 'Missed PMH allergies.' },
      transcript: [{ role: 'student', text: 'What brings you in today?' }],
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.strengths.length).toBeGreaterThanOrEqual(1);
    expect(r.output?.encouragementLevel).toBe('developing');
  });
});

describe('soap-note-grader agent', () => {
  it('returns env_missing without GEMINI_API_KEY', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('soap-note-grader', {
      sessionId: 'so1',
      soapNote: { subjective: 'CC: chest pain', objective: 'Vitals stable', assessment: 'Likely musculoskeletal', plan: 'Rest and NSAIDs' },
    }, { env: {} });
    expect(r.status).toBe('env_missing');
  });

  it('returns graded SOAP note scores', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: {
        totalScore: 72,
        breakdown: { subjective: 18, objective: 20, assessment: 15, plan: 19 },
        feedback: { strengths: ['Good vitals documentation'], missedConcepts: ['Did not document cardiac exam'], suggestions: ['Add ROS for cardiac risk factors'] },
      },
      model: 'gemini-2.5-pro', provider: 'gemini', attempts: 1, latencyMs: 900,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    const r = await invokeAgent('soap-note-grader', {
      sessionId: 'so2',
      soapNote: { subjective: '55yo M with crushing chest pain', objective: 'BP 150/90, HR 95, unremarkable exam', assessment: 'Suspected ACS', plan: 'ECG, troponin, aspirin 325mg PO' },
      caseContext: { correctDiagnosis: 'STEMI', chiefComplaint: 'Chest pain' },
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.totalScore).toBe(72);
    expect(r.telemetry?.totalScore).toBe(72);
  });
});

// ─── Batch 2: Ops Agents (3 new) ──────────────────────────────────────────

describe('prompt-contract-validator agent', () => {
  it('returns schema_invalid when maxFiles is zero', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/ops/promptContractValidator');
    const r = await invokeAgent('prompt-contract-validator', { maxFiles: 0 }, { env: {} });
    expect(r.status).toBe('schema_invalid');
  });

  it('scans the repo and returns a report', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/ops/promptContractValidator');
    const r = await invokeAgent('prompt-contract-validator', { rootDir: process.cwd(), maxFiles: 200 }, { env: {} });
    expect(r.status).toBe('ok');
    expect(r.output?.filesScanned).toBeGreaterThan(0);
  });
});

describe('schema-drift-detector agent', () => {
  it('returns schema_invalid when maxFiles is zero', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/ops/schemaDriftDetector');
    const r = await invokeAgent('schema-drift-detector', { maxFiles: 0 }, { env: {} });
    expect(r.status).toBe('schema_invalid');
  });

  it('finds encounter agents and reports', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/ops/schemaDriftDetector');
    const r = await invokeAgent('schema-drift-detector', { rootDir: process.cwd() }, { env: {} });
    expect(r.status).toBe('ok');
    expect(r.output?.agentsFound).toBeGreaterThanOrEqual(4);
  });
});

describe('env-var-auditor agent', () => {
  it('returns schema_invalid when maxFiles is zero', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/ops/envVarAuditor');
    const r = await invokeAgent('env-var-auditor', { maxFiles: 0 }, { env: {} });
    expect(r.status).toBe('schema_invalid');
  });

  it('scans functions/api and finds declared + used env vars', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/ops/envVarAuditor');
    const r = await invokeAgent('env-var-auditor', { rootDir: process.cwd(), maxFiles: 3000 }, { env: {} });
    expect(r.status).toBe('ok');
    expect(r.output?.filesScanned).toBeGreaterThan(0);
    expect(r.output?.declaredEnvVars).toContain('DATABASE_URL');
    expect(r.output?.usedEnvVars.length).toBeGreaterThan(0);
  });
});

// ─── Batch 3: Preceptor Pimping Bot ────────────────────────────────────────

describe('preceptor-pimping agent', () => {
  it('returns env_missing without GEMINI_API_KEY', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/graphs/preceptor');
    const r = await invokeAgent('preceptor-pimping', {
      sessionId: 'pp-1',
      setting: 'ED',
      studentUtterance: 'What do we have?',
    }, { env: {} });
    expect(r.status).toBe('env_missing');
    expect(r.error?.cause).toBe('preceptor-pimping.env');
  });

  it('returns schema_invalid when studentUtterance is empty', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/graphs/preceptor');
    const r = await invokeAgent('preceptor-pimping', {
      sessionId: 'pp-2',
      setting: 'ED',
      studentUtterance: '',
    }, ctx);
    expect(r.status).toBe('schema_invalid');
    expect(r.error?.cause).toBe('preceptor-pimping.input');
  });

  it('returns schema_invalid for invalid setting', async () => {
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/graphs/preceptor');
    const r = await invokeAgent('preceptor-pimping', {
      sessionId: 'pp-3',
      setting: 'ICU',
      studentUtterance: 'Hello',
    }, ctx);
    expect(r.status).toBe('schema_invalid');
  });

  it('generates ED preceptor response via routeTask', async () => {
    mocks.routeTask.mockResolvedValue({
      output: 'Correct. What is the most life-threatening cause of chest pain you must rule out first? [PEARL: Always rule out ACS, PE, aortic dissection, and tension pneumothorax in undifferentiated chest pain.]',
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 200,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/graphs/preceptor');
    const r = await invokeAgent('preceptor-pimping', {
      sessionId: 'pp-4',
      setting: 'ED',
      studentUtterance: 'ACS — STEMI, NSTEMI, unstable angina.',
      priorTurns: [
        { role: 'preceptor', text: '55yo male, crushing chest pain, diaphoretic. What is your differential?' },
        { role: 'student', text: 'ACS — STEMI, NSTEMI, unstable angina.' },
      ],
      currentDifficulty: 3,
      correctStreak: 1,
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.preceptorReply).toContain('Correct');
    expect(r.output?.clinicalPearl).toContain('ACS');
    expect(r.output?.newDifficulty).toBeGreaterThanOrEqual(3);
    expect(mocks.routeTask).toHaveBeenCalledOnce();
    const callArgs = mocks.routeTask.mock.calls[0];
    expect(callArgs[0]).toBe('osce-chat');
    expect(callArgs[2].systemPrompt).toContain('Emergency Department');
  });

  it('detects incorrect answer and decreases difficulty', async () => {
    mocks.routeTask.mockResolvedValue({
      output: 'Incorrect. The most common cause of community-acquired pneumonia is Streptococcus pneumoniae, not H. influenzae. Remember: Strep pneumo is #1 in all age groups. What antibiotic would you start empirically?',
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 180,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/graphs/preceptor');
    const r = await invokeAgent('preceptor-pimping', {
      sessionId: 'pp-5',
      setting: 'rounds',
      studentUtterance: 'H. influenzae.',
      priorTurns: [
        { role: 'preceptor', text: 'What is the most common cause of community-acquired pneumonia?' },
      ],
      currentDifficulty: 4,
      correctStreak: 2,
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.lastAnswerCorrect).toBe(false);
    expect(r.output?.newCorrectStreak).toBe(0);
    expect(r.output?.newDifficulty).toBeLessThan(4);
  });

  it('detects session end signal', async () => {
    mocks.routeTask.mockResolvedValue({
      output: 'Strong work today. You know your cardiac emergencies. Keep reading on the latest AHA guidelines. [SESSION_END]',
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 150,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/graphs/preceptor');
    const r = await invokeAgent('preceptor-pimping', {
      sessionId: 'pp-6',
      setting: 'clinic',
      studentUtterance: 'Start a statin, check A1c, and screen for depression.',
      priorTurns: Array.from({ length: 8 }, (_, i) => ({
        role: (i % 2 === 0 ? 'preceptor' : 'student') as 'preceptor' | 'student',
        text: `Turn ${i + 1} content`,
      })),
      currentDifficulty: 4,
      correctStreak: 3,
    }, ctx);
    expect(r.status).toBe('ok');
    expect(r.output?.sessionEnding).toBe(true);
    expect(r.output?.preceptorReply).not.toContain('[SESSION_END]');
  });

  it('uses setting-specific system prompt for OR', async () => {
    mocks.routeTask.mockResolvedValue({
      output: 'Correct. Name the layers of the abdominal wall you will incise through.',
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 150,
    });
    const { invokeAgent } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/graphs/preceptor');
    const r = await invokeAgent('preceptor-pimping', {
      sessionId: 'pp-7',
      setting: 'OR',
      studentUtterance: 'Midline laparotomy.',
    }, ctx);
    expect(r.status).toBe('ok');
    const callArgs = mocks.routeTask.mock.calls[0];
    expect(callArgs[2].systemPrompt).toContain('surgical');
    expect(callArgs[2].systemPrompt).toContain('sterile');
  });

  it('registers in the agent list', async () => {
    const { listAgents } = await import('@/lib/agents/shared/runtime');
    await import('@/lib/agents/graphs/preceptor');
    const names = listAgents().map((a) => a.name);
    expect(names).toContain('preceptor-pimping');
  });
});
