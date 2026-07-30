export interface DatasetCase {
  id: string;
  agentRole: string;
  input: string;
  expectedContains?: string[];
  expectedNotContains?: string[];
  expectedRegex?: string[];
  metadata?: Record<string, unknown>;
}

export const DATASETS: Record<string, DatasetCase[]> = {
  'content-audit': [
    {
      id: 'ca-001', agentRole: 'content-audit',
      input: 'Audit findings: [{id:"AUD-1",conditionId:"cond_afib",metric:"missing_first_line",severity:"high"}]. File Linear for actionable only.',
      expectedContains: ['AUDIT RESULT'],
      expectedNotContains: [],
      metadata: { findingCount: 1, shouldFileLinear: true },
    },
    {
      id: 'ca-002', agentRole: 'content-audit',
      input: 'Audit findings: [{id:"AUD-2",conditionId:"cond_pe",metric:"ddx_count",severity:"low",detail:"Only 3 of 6 DDx"}]. File only actionable.',
      expectedContains: ['AUDIT RESULT'],
      metadata: { findingCount: 1, shouldFileLinear: false, severity: 'low' },
    },
    {
      id: 'ca-003', agentRole: 'content-audit',
      input: 'Audit findings: [{id:"AUD-3",conditionId:"cond_sepsis",metric:"incorrect_content",severity:"critical",detail:"Wrong first-line antibiotic"}]. This is incorrect clinical content.',
      expectedContains: ['AUDIT RESULT'],
      metadata: { findingCount: 1, shouldFileLinear: true, severity: 'critical', priority: 0 },
    },
  ],
  'ddx-generator': [
    {
      id: 'ddx-001', agentRole: 'ddx-generator',
      input: 'Patient presents with acute chest pain, 45yo male, diaphoresis, SOB. ECG shows ST elevation in leads II, III, aVF.',
      expectedContains: ['STEMI', 'MI', 'ACS'],
      metadata: { condition: 'chest pain', acuity: 'high' },
    },
    {
      id: 'ddx-002', agentRole: 'ddx-generator',
      input: '32yo female with gradual onset epigastric pain, worse after meals, NSAIDs provide relief. No alarm symptoms.',
      expectedContains: ['gastritis', 'ulcer', 'GERD'],
      metadata: { condition: 'epigastric pain', acuity: 'low' },
    },
    {
      id: 'ddx-003', agentRole: 'ddx-generator',
      input: '68yo male with progressive dyspnea, orthopnea, bilateral lower extremity edema. History of HTN, diabetes.',
      expectedContains: ['CHF', 'heart failure', 'volume overload'],
      metadata: { condition: 'dyspnea', acuity: 'medium' },
    },
  ],
  'soap-note-grader': [
    {
      id: 'soap-001', agentRole: 'soap-note-grader',
      input: 'SOAP Note: S: 45yo male with chest pain x 2 hours. Pain is 8/10, substernal, radiating to left arm. Associated diaphoresis, SOB. No prior cardiac history. O: VS: BP 145/92, HR 98, RR 20, SpO2 94% RA. ECG: ST elevation II, III, aVF. A: STEMI. P: Aspirin 324mg PO, Heparin bolus, Cardiology consult emergently.',
      expectedContains: ['COMPREHENSIVE', 'ACCURATE', 'COMPLETE'],
      metadata: { soapQuality: 'high', completeness: 'full' },
    },
    {
      id: 'soap-002', agentRole: 'soap-note-grader',
      input: 'SOAP Note: S: Patient has headache. O: Normal vitals. A: Tension headache. P: Ibuprofen.',
      expectedContains: ['INCOMPLETE', 'MISSING', 'INSUFFICIENT'],
      metadata: { soapQuality: 'low', completeness: 'minimal' },
    },
  ],
  'feedback-summarizer': [
    {
      id: 'fb-001', agentRole: 'feedback-summarizer',
      input: 'Student performance: 85% accuracy on cardiology questions, 72% on pulmonology, 91% on dermatology. Time spent: 45min cardiology, 30min pulmo, 20min derm. Weakness identified: CHF classification and treatment algorithms.',
      expectedContains: ['strengths', 'weaknesses', 'recommendations'],
      metadata: { accuracy: 0.83, strengthArea: 'dermatology', weaknessArea: 'pulmonology' },
    },
    {
      id: 'fb-002', agentRole: 'feedback-summarizer',
      input: 'OSCE encounter: Student correctly identified MI, initiated appropriate workup, but missed counseling on lifestyle modifications and follow-up plan.',
      expectedContains: ['strengths', 'areas for improvement', 'clinical reasoning'],
      metadata: { encounterType: 'OSCE', focus: 'clinical reasoning' },
    },
  ],
  'diagnostic-workup-advisor': [
    {
      id: 'dw-001', agentRole: 'diagnostic-workup-advisor',
      input: '45yo male with acute chest pain, ST elevation on ECG. What initial workup should be ordered?',
      expectedContains: ['troponin', 'CBC', ' BMP', 'coagulation', 'echocardiogram'],
      metadata: { condition: 'STEMI', urgency: 'emergent' },
    },
    {
      id: 'dw-002', agentRole: 'diagnostic-workup-advisor',
      input: '32yo female with gradual onset epigastric pain, no alarm symptoms. What workup is appropriate?',
      expectedContains: ['H. pylori', 'upper endoscopy', 'empiric PPI'],
      metadata: { condition: 'gastritis', urgency: 'routine' },
    },
  ],
  'code-reviewer': [
    {
      id: 'cr-001', agentRole: 'code-reviewer',
      input: 'Review this diff:\n```diff\n+import { Buffer } from "buffer";\n+const hash = Buffer.from(data).toString("hex");\n```\nFile: functions/api/content/process.ts',
      expectedContains: ['REQUEST_CHANGES', 'Buffer', 'edge'],
      metadata: { violation: 'edge-runtime-buffer', severity: 'high' },
    },
    {
      id: 'cr-002', agentRole: 'code-reviewer',
      input: 'Review this diff:\n```diff\n+import { PrismaClient } from "@prisma/client";\n+const prisma = new PrismaClient();\n```\nFile: src/lib/search.ts',
      expectedContains: ['REQUEST_CHANGES', 'Prisma', 'client'],
      metadata: { violation: 'prisma-in-client', severity: 'high' },
    },
    {
      id: 'cr-003', agentRole: 'code-reviewer',
      input: 'Review this diff:\n```diff\n+if (rating === "Hard") { stability *= 0.5; }\n+if (rating === "Easy") { stability *= 1.3; }\n```\nFile: lib/fsrs.ts',
      expectedContains: ['REQUEST_CHANGES', 'FSRS', 'Hard', 'Easy', 'binary'],
      metadata: { violation: 'fsrs-hard-easy', severity: 'critical' },
    },
    {
      id: 'cr-004', agentRole: 'code-reviewer',
      input: 'Review this diff:\n```diff\n+export function formatScore(points: number): string {\n+  return points.toFixed(1);\n+}\n```\nFile: components/ui/ScoreBadge.tsx',
      expectedContains: ['APPROVE'],
      expectedNotContains: ['REQUEST_CHANGES'],
      metadata: { clean: true },
    },
  ],
  'clinical-validator': [
    {
      id: 'cv-001', agentRole: 'clinical-validator',
      input: 'Claim: "First-line treatment for uncomplicated UTI is nitrofurantoin 100mg PO BID x5 days."\nSource: "For uncomplicated cystitis, nitrofurantoin 100 mg twice daily for 5 days is recommended as first-line therapy."',
      expectedContains: ['VERIFIED'],
      metadata: { status: 'verified' },
    },
    {
      id: 'cv-002', agentRole: 'clinical-validator',
      input: 'Claim: "First-line treatment for AFib with RVR is amiodarone 400mg IV bolus."\nSource: "Rate control with beta-blockers or non-dihydropyridine calcium channel blockers is first-line. Amiodarone reserved for rhythm control in hemodynamically unstable patients."',
      expectedContains: ['INCORRECT', 'beta-blocker'],
      metadata: { status: 'incorrect' },
    },
    {
      id: 'cv-003', agentRole: 'clinical-validator',
      input: 'Claim: "PERC score can be used to rule out PE in low-risk patients."\nSource: (no source provided)',
      expectedContains: ['UNVERIFIED'],
      metadata: { status: 'unverified', reason: 'no source' },
    },
  ],
  'security-auditor': [
    {
      id: 'sa-001', agentRole: 'security-auditor',
      input: 'Audit this endpoint:\n```typescript\nexport async function onRequestGet(context) {\n  const data = await prisma.user.findMany();\n  return Response.json(data);\n}\n```\nFile: functions/api/admin/users.ts',
      expectedContains: ['CRITICAL', 'auth', 'authenticatedRequest'],
      metadata: { finding: 'auth-bypass', severity: 'critical' },
    },
    {
      id: 'sa-002', agentRole: 'security-auditor',
      input: 'Audit this endpoint:\n```typescript\nexport async function onRequestPost(context) {\n  const auth = await authenticateRequest(context);\n  const body = await context.request.json();\n  const record = await prisma.medicalContent.create({ data: body });\n  return Response.json(record);\n}\n```\nFile: functions/api/admin/content/create.ts',
      expectedContains: ['mass assignment', 'allowlist'],
      metadata: { finding: 'mass-assignment', severity: 'high' },
    },
  ],
};

export const DATASET_NAMES = Object.keys(DATASETS);

export function getDataset(name: string): DatasetCase[] | null {
  return DATASETS[name] ?? null;
}

export function describeDatasets(): Array<{ name: string; caseCount: number; agentRole: string }> {
  return DATASET_NAMES.map((name) => {
    const cases = DATASETS[name] ?? [];
    return { name, caseCount: cases.length, agentRole: cases[0]?.agentRole ?? 'unknown' };
  });
}