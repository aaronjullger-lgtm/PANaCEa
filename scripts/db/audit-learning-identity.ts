import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'url';

export type LearningIdentityProbeId =
  | 'study_session_question_table_missing'
  | 'question_attempt_missing_question'
  | 'review_log_missing_question_fk'
  | 'review_log_source_without_question_or_pregen'
  | 'card_missing_question'
  | 'user_progress_missing_medical_content'
  | 'study_session_question_ids_unresolved';

export type LearningIdentityProbe = {
  id: LearningIdentityProbeId;
  description: string;
  countSql: string;
  sampleSql: string;
};

export type LearningIdentityProbeResult = {
  id: LearningIdentityProbeId;
  description: string;
  count: number;
  samples: Array<Record<string, unknown>>;
};

export type LearningIdentityAuditReport = {
  generatedAt: string;
  readOnly: true;
  totalIssues: number;
  probes: LearningIdentityProbeResult[];
  recommendations: string[];
};

type QueryablePrisma = {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>;
};

export const LEARNING_IDENTITY_PROBES: LearningIdentityProbe[] = [
  {
    id: 'study_session_question_table_missing',
    description: 'Normalized study_session_questions table required for ordered source identity links.',
    countSql: `
      SELECT CASE
        WHEN EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'study_session_questions'
        )
        THEN '0'
        ELSE '1'
      END AS count
    `,
    sampleSql: `
      SELECT 'study_session_questions' AS table_name,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'study_session_questions'
          )
          THEN 'present'
          ELSE 'missing'
        END AS status
    `,
  },
  {
    id: 'question_attempt_missing_question',
    description: 'QuestionAttempt.questionId values without a canonical Question row.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "QuestionAttempt" qa
      LEFT JOIN "Question" q ON q.id = qa."questionId"
      WHERE q.id IS NULL
    `,
    sampleSql: `
      SELECT qa.id, qa."userId", qa."questionId", qa."createdAt"
      FROM "QuestionAttempt" qa
      LEFT JOIN "Question" q ON q.id = qa."questionId"
      WHERE q.id IS NULL
      ORDER BY qa."createdAt" DESC
      LIMIT 20
    `,
  },
  {
    id: 'review_log_missing_question_fk',
    description: 'ReviewLog.questionFkId values without a canonical Question row.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "ReviewLog" rl
      LEFT JOIN "Question" q ON q.id = rl."questionFkId"
      WHERE rl."questionFkId" IS NOT NULL
        AND q.id IS NULL
    `,
    sampleSql: `
      SELECT rl.id, rl."userId", rl."questionId", rl."questionFkId", rl."reviewedAt"
      FROM "ReviewLog" rl
      LEFT JOIN "Question" q ON q.id = rl."questionFkId"
      WHERE rl."questionFkId" IS NOT NULL
        AND q.id IS NULL
      ORDER BY rl."reviewedAt" DESC
      LIMIT 20
    `,
  },
  {
    id: 'review_log_source_without_question_or_pregen',
    description: 'ReviewLog.questionId source values that do not resolve to Question or PreGeneratedQuestion.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "ReviewLog" rl
      LEFT JOIN "Question" q ON q.id = rl."questionId"
      LEFT JOIN "PreGeneratedQuestion" pgq ON pgq.id = rl."questionId"
      WHERE rl."questionId" IS NOT NULL
        AND q.id IS NULL
        AND pgq.id IS NULL
    `,
    sampleSql: `
      SELECT rl.id, rl."userId", rl."questionId", rl."questionFkId", rl."sessionId", rl."reviewedAt"
      FROM "ReviewLog" rl
      LEFT JOIN "Question" q ON q.id = rl."questionId"
      LEFT JOIN "PreGeneratedQuestion" pgq ON pgq.id = rl."questionId"
      WHERE rl."questionId" IS NOT NULL
        AND q.id IS NULL
        AND pgq.id IS NULL
      ORDER BY rl."reviewedAt" DESC
      LIMIT 20
    `,
  },
  {
    id: 'card_missing_question',
    description: 'Card.questionId values without a canonical Question row.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "Card" c
      LEFT JOIN "Question" q ON q.id = c."questionId"
      WHERE q.id IS NULL
    `,
    sampleSql: `
      SELECT c.id, c."userId", c."questionId", c."progressContext", c.due
      FROM "Card" c
      LEFT JOIN "Question" q ON q.id = c."questionId"
      WHERE q.id IS NULL
      ORDER BY c.due ASC
      LIMIT 20
    `,
  },
  {
    id: 'user_progress_missing_medical_content',
    description: 'UserProgress.conditionId values that do not satisfy the MedicalContent FK domain.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "UserProgress" up
      LEFT JOIN "MedicalContent" mc ON mc.id = up."conditionId"
      WHERE mc.id IS NULL
    `,
    sampleSql: `
      SELECT up.id, up."userId", up."conditionId", up."progressContext", up."lastReviewAt", up."nextReviewAt"
      FROM "UserProgress" up
      LEFT JOIN "MedicalContent" mc ON mc.id = up."conditionId"
      WHERE mc.id IS NULL
      ORDER BY up."updatedAt" DESC
      LIMIT 20
    `,
  },
  {
    id: 'study_session_question_ids_unresolved',
    description: 'StudySession.questionIds entries that do not resolve to Question or PreGeneratedQuestion.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "StudySession" ss
      CROSS JOIN LATERAL unnest(ss."questionIds") AS qid
      LEFT JOIN "Question" q ON q.id = qid
      LEFT JOIN "PreGeneratedQuestion" pgq ON pgq.id = qid
      WHERE qid IS NOT NULL
        AND q.id IS NULL
        AND pgq.id IS NULL
    `,
    sampleSql: `
      SELECT ss.id AS "sessionId", ss."userId", qid AS "questionId", ss."startedAt"
      FROM "StudySession" ss
      CROSS JOIN LATERAL unnest(ss."questionIds") AS qid
      LEFT JOIN "Question" q ON q.id = qid
      LEFT JOIN "PreGeneratedQuestion" pgq ON pgq.id = qid
      WHERE qid IS NOT NULL
        AND q.id IS NULL
        AND pgq.id IS NULL
      ORDER BY ss."startedAt" DESC
      LIMIT 20
    `,
  },
];

function normalizeCount(rows: unknown): number {
  const first = Array.isArray(rows) ? rows[0] : rows;
  if (!first || typeof first !== 'object') return 0;
  const raw = (first as { count?: unknown }).count;
  if (typeof raw === 'bigint') return Number(raw);
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeSamples(rows: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return { value: row };
    return Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : typeof value === 'bigint' ? value.toString() : value,
      ])
    );
  });
}

export function buildLearningIdentityRecommendations(
  probes: LearningIdentityProbeResult[]
): string[] {
  const byId = new Map(probes.map((probe) => [probe.id, probe.count]));
  const recommendations: string[] = [
    'Persist typed source identity on served session questions before applying a canonical identity migration.',
    'Backfill canonical Question rows for PreGeneratedQuestion-backed attempts before enforcing stricter FKs.',
  ];

  if ((byId.get('study_session_question_table_missing') ?? 0) > 0) {
    recommendations.push(
      'Deploy the normalized study schema so StudySessionQuestion links can be persisted instead of relying on StudySession.questionIds fallback.'
    );
  }
  if ((byId.get('user_progress_missing_medical_content') ?? 0) > 0) {
    recommendations.push(
      'Resolve UserProgress.conditionId to the MedicalContent.id domain before trusting due queues or dashboard review coverage.'
    );
  }
  if ((byId.get('study_session_question_ids_unresolved') ?? 0) > 0) {
    recommendations.push(
      'Store question source alongside StudySession.questionIds so resume can hydrate mixed Question and PreGeneratedQuestion sessions.'
    );
  }
  if ((byId.get('review_log_source_without_question_or_pregen') ?? 0) > 0) {
    recommendations.push(
      'Add queryable ReviewLog source identity fields or a compatibility view for generated/staging source IDs.'
    );
  }

  return recommendations;
}

export async function runLearningIdentityAudit(
  prisma: QueryablePrisma,
  probes: LearningIdentityProbe[] = LEARNING_IDENTITY_PROBES
): Promise<LearningIdentityAuditReport> {
  const results: LearningIdentityProbeResult[] = [];

  for (const probe of probes) {
    const [countRows, sampleRows] = await Promise.all([
      prisma.$queryRawUnsafe(probe.countSql),
      prisma.$queryRawUnsafe(probe.sampleSql),
    ]);
    results.push({
      id: probe.id,
      description: probe.description,
      count: normalizeCount(countRows),
      samples: normalizeSamples(sampleRows),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    totalIssues: results.reduce((sum, probe) => sum + probe.count, 0),
    probes: results,
    recommendations: buildLearningIdentityRecommendations(results),
  };
}

function isDirectRun(): boolean {
  const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
  return import.meta.url === entry;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required for the read-only learning identity audit.');
  }
  process.env.DATABASE_URL = databaseUrl;

  const prisma = new PrismaClient();
  try {
    const report = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return runLearningIdentityAudit(tx);
    });
    console.log(JSON.stringify(report, null, 2));
    if (process.argv.includes('--fail-on-issues') && report.totalIssues > 0) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
