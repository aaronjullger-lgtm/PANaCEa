/**
 * Grading contracts — Ghost Grader, SOAP grading, elaboration, OSCE grading,
 * spatial/vision grading, teachback grading.
 *
 * All grading outputs MUST include a bounded numeric score, feedback text,
 * and a list of missing concepts. Safety fields (clinical red flags,
 * contraindications, dangerous-answer detection) must be explicit — never
 * hidden in free-text feedback.
 */

import { z } from 'zod';

// ─── Generic rubric-based grader ──────────────────────────────────────────

export const RubricGradeSchema = z.object({
  score: z.number().min(0).max(100),
  maxScore: z.number().min(1),
  feedback: z.string().min(10).max(2000),
  missingConcepts: z.array(z.string()).max(20).default([]),
  modelExplanation: z.string().max(4000).default(''),
  safetyFlags: z
    .object({
      containsDangerousGuidance: z.boolean().default(false),
      clinicalRedFlags: z.array(z.string()).max(10).default([]),
      contraindications: z.array(z.string()).max(10).default([]),
    })
    .default({
      containsDangerousGuidance: false,
      clinicalRedFlags: [],
      contraindications: [],
    }),
});
export type RubricGrade = z.infer<typeof RubricGradeSchema>;

export const RUBRIC_GRADE_DESCRIPTION = `{
  "score": number (0-100, inclusive),
  "maxScore": number (e.g. 3 for elaboration drill, 100 for OSCE station),
  "feedback": string (2-3 sentences to the student),
  "missingConcepts": string[] (rubric items not addressed),
  "modelExplanation": string (complete correct answer),
  "safetyFlags": {
    "containsDangerousGuidance": boolean,
    "clinicalRedFlags": string[],
    "contraindications": string[]
  }
}`;

// ─── Elaboration drill (0-3 mini-rubric) ──────────────────────────────────

export const ElaborationGradeSchema = z.object({
  score: z.number().int().min(0).max(3),
  feedback: z.string().min(5).max(1000),
  missingConcepts: z.array(z.string()).max(10).default([]),
  modelExplanation: z.string().max(2000).default(''),
});
export type ElaborationGrade = z.infer<typeof ElaborationGradeSchema>;

export const ELABORATION_GRADE_DESCRIPTION = `{
  "score": integer 0-3 (0=no relevant content, 1=partial, 2=correct but missing detail, 3=complete),
  "feedback": string (2-3 sentences for the student),
  "missingConcepts": string[] (rubric items not addressed),
  "modelExplanation": string (complete 3-5 sentence correct explanation)
}`;

// ─── Teach-back drill (4-category clinical rubric, each 0-3) ─────────────

/**
 * Teach-back grades a PA student's free-text "explain it to a classmate"
 * response across four clinical dimensions. Categories MUST be exactly 4
 * and scores bounded 0-3. Total score (0-12) maps to FSRS:
 * ≤6 → Again, ≥7 → Good.
 */
export const TeachBackGradeSchema = z.object({
  categories: z
    .array(
      z.object({
        category: z.string().min(3).max(80),
        score: z.number().int().min(0).max(3),
        feedback: z.string().min(3).max(400),
      }),
    )
    .length(4),
  overallFeedback: z.string().min(10).max(1500),
  missingConcepts: z.array(z.string()).max(20).default([]),
  strengths: z.array(z.string()).max(20).default([]),
  modelExplanation: z.string().max(2000).default(''),
});
export type TeachBackGrade = z.infer<typeof TeachBackGradeSchema>;

export const TEACHBACK_GRADE_DESCRIPTION = `{
  "categories": [
    { "category": "Definition/Pathophysiology", "score": integer 0-3, "feedback": "<1 sentence>" },
    { "category": "Presentation/Recognition",   "score": integer 0-3, "feedback": "<1 sentence>" },
    { "category": "Diagnosis/Workup",           "score": integer 0-3, "feedback": "<1 sentence>" },
    { "category": "Treatment/Management",       "score": integer 0-3, "feedback": "<1 sentence>" }
  ],
  "overallFeedback": "<2-3 sentences, encouraging but honest>",
  "missingConcepts": ["<concept the student didn't cover>"],
  "strengths":       ["<what the student got right>"],
  "modelExplanation": "<ideal 3-4 sentence explanation>"
}
Rules:
- categories MUST contain exactly 4 entries in the order shown above.
- Each score is an integer 0, 1, 2, or 3.
- Do NOT add extra keys. Do NOT return a different JSON shape.`;

// ─── SOAP note grading ─────────────────────────────────────────────────────

export const SoapGradeSchema = z.object({
  subjective: z.object({
    score: z.number().min(0).max(25),
    feedback: z.string(),
  }),
  objective: z.object({
    score: z.number().min(0).max(25),
    feedback: z.string(),
  }),
  assessment: z.object({
    score: z.number().min(0).max(25),
    feedback: z.string(),
  }),
  plan: z.object({
    score: z.number().min(0).max(25),
    feedback: z.string(),
  }),
  totalScore: z.number().min(0).max(100),
  overallFeedback: z.string().min(10).max(2000),
  safetyFlags: z
    .object({
      missedRedFlags: z.array(z.string()).default([]),
      dangerousPlanComponents: z.array(z.string()).default([]),
    })
    .default({ missedRedFlags: [], dangerousPlanComponents: [] }),
});
export type SoapGrade = z.infer<typeof SoapGradeSchema>;

// ─── SOAP note grading (client-facing brief shape) ────────────────────────

/**
 * SOAP Note grading — the wire shape consumed by components/osce/SOAPNoteTrainer.
 * Distinct from SoapGradeSchema: this one returns a flat 4-section breakdown
 * (0-25 each) plus coaching feedback grouped into strengths / missedConcepts /
 * suggestions — matching the long-standing client contract so the UI doesn't
 * have to change.
 *
 * Bullet lists are capped at 5 entries each by the schema (not only by prompt
 * instruction) — defense in depth when the model ignores the instruction.
 */
export const SoapBriefGradeSchema = z.object({
  totalScore: z.number().min(0).max(100),
  breakdown: z.object({
    subjective: z.number().min(0).max(25),
    objective: z.number().min(0).max(25),
    assessment: z.number().min(0).max(25),
    plan: z.number().min(0).max(25),
  }),
  feedback: z.object({
    strengths: z.array(z.string().min(1).max(400)).max(5).default([]),
    missedConcepts: z.array(z.string().min(1).max(400)).max(5).default([]),
    suggestions: z.array(z.string().min(1).max(400)).max(5).default([]),
  }),
});
export type SoapBriefGrade = z.infer<typeof SoapBriefGradeSchema>;

export const SOAP_BRIEF_GRADE_DESCRIPTION = `{
  "totalScore": number (0-100, MUST equal sum of breakdown.{subjective,objective,assessment,plan}),
  "breakdown": {
    "subjective": number (0-25),
    "objective":  number (0-25),
    "assessment": number (0-25),
    "plan":       number (0-25)
  },
  "feedback": {
    "strengths":      string[] (≤5 bullets, one coaching sentence each),
    "missedConcepts": string[] (≤5 bullets, truly important missed findings),
    "suggestions":    string[] (≤5 bullets, style/phrasing/organization)
  }
}
Return ONLY this JSON — no markdown, no prose, no code fence.`;

// ─── OSCE station grading ──────────────────────────────────────────────────

export const OsceGradeSchema = z.object({
  dataGathering: z.number().min(0).max(25),
  clinicalReasoning: z.number().min(0).max(25),
  patientCommunication: z.number().min(0).max(25),
  managementPlan: z.number().min(0).max(25),
  totalScore: z.number().min(0).max(100),
  passed: z.boolean(),
  strengths: z.array(z.string()).max(10),
  improvements: z.array(z.string()).max(10),
  criticalFailures: z
    .array(
      z.object({
        category: z.enum([
          'missed_red_flag',
          'dangerous_management',
          'critical_history_gap',
          'communication_harm',
        ]),
        description: z.string(),
      }),
    )
    .default([]),
  narrativeFeedback: z.string().min(50).max(4000),
});
export type OsceGrade = z.infer<typeof OsceGradeSchema>;

// ─── OSCE post-encounter analysis (transcript → structured grade) ────────

/**
 * Used by /api/osce/analysis/grade — grades a completed patient encounter
 * transcript against a rubric. Separate from OsceGradeSchema (which is a
 * generic OSCE station rubric) because this endpoint has its own legacy
 * payload shape that the client depends on.
 */
export const OsceAnalysisChecklistItemSchema = z.object({
  item: z.string().min(1),
  status: z.enum(['PASS', 'FAIL']),
  feedback: z.string().max(1000),
});
export type OsceAnalysisChecklistItem = z.infer<typeof OsceAnalysisChecklistItemSchema>;

export const OsceAnalysisGradeSchema = z.object({
  score: z.number().min(0).max(100),
  checklist: z.array(OsceAnalysisChecklistItemSchema).default([]),
  redFlagsMissed: z.array(z.string()).default([]),
  clinicalReasoningScore: z.number().min(0).max(100),
  billingCodeSuggestion: z.string().default('N/A'),
  communicationScore: z.number().min(0).max(100).optional(),
  differentialScore: z.number().min(0).max(100).optional(),
});
export type OsceAnalysisGrade = z.infer<typeof OsceAnalysisGradeSchema>;

export const OSCE_ANALYSIS_GRADE_DESCRIPTION = `{
  "score": number 0-100 (sum of History, Physical Exam, Diagnostic Reasoning, Treatment, Communication, Efficiency),
  "checklist": [{"item": "<exact rubric item text>", "status": "PASS" | "FAIL", "feedback": "<brief feedback>"}],
  "redFlagsMissed": ["<red flag item the student missed>"],
  "clinicalReasoningScore": number 0-100,
  "billingCodeSuggestion": "<ICD-10 code>" | "N/A",
  "communicationScore": number 0-100 (communication section scaled),
  "differentialScore": number 0-100 (OMIT this key entirely if no differentials were provided by the student)
}
Return ONLY this JSON object — no markdown, no code fence, no prose.`;

export const OsceSoftSkillsSchema = z.object({
  empathy: z.object({
    score: z.number().min(1).max(5),
    feedback: z.string().min(1).max(1000),
  }),
  professionalism: z.object({
    score: z.number().min(1).max(5),
    feedback: z.string().min(1).max(1000),
  }),
  pacing: z.object({
    score: z.number().min(1).max(5),
    feedback: z.string().min(1).max(1000),
  }),
});
export type OsceSoftSkills = z.infer<typeof OsceSoftSkillsSchema>;

export const OSCE_SOFT_SKILLS_DESCRIPTION = `{
  "empathy":         {"score": integer 1-5, "feedback": "<brief, specific>"},
  "professionalism": {"score": integer 1-5, "feedback": "<brief, specific>"},
  "pacing":          {"score": integer 1-5, "feedback": "<brief, specific>"}
}
Scale: 1=poor, 2=below average, 3=average, 4=good, 5=excellent.
Return ONLY this JSON object.`;

// ─── Ghost Grader / behavioral confidence grading ─────────────────────────

/**
 * Behavioral telemetry → implicit confidence + FSRS rating.
 * Used by analyzeBehaviorGemini (Ghost Grader) and /api/srs/analyze-behavior.
 *
 * Safety invariant: impliedRating MUST be an integer 1–4 and confidence MUST
 * be 0–1. The schema bounds enforce this so callers can never pass a stale
 * Hard/Easy value or a confidence above 1.0 to the FSRS engine.
 */
export const BehaviorGradeSchema = z.object({
  confidence: z.number().min(0).max(1),
  impliedRating: z.number().int().min(1).max(4),
});
export type BehaviorGrade = z.infer<typeof BehaviorGradeSchema>;

export const BEHAVIOR_GRADE_DESCRIPTION = `{
  "confidence": number 0-1 (1=certain recall, 0=complete confusion),
  "impliedRating": integer 1-4 (FSRS: 1=Again, 2=Hard, 3=Good, 4=Easy)
}
Return ONLY this JSON object — no markdown, no code fence, no prose.`;

// ─── Vision / spatial grading (e.g. anatomy identification) ───────────────

export const VisionGradeSchema = z.object({
  score: z.number().min(0).max(100),
  correctIdentifications: z.array(z.string()).default([]),
  incorrectIdentifications: z.array(z.string()).default([]),
  missedStructures: z.array(z.string()).default([]),
  feedback: z.string().min(10).max(2000),
});
export type VisionGrade = z.infer<typeof VisionGradeSchema>;
