import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'url';

export type LearningIdentityProbeId =
  | 'study_session_question_table_missing'
  | 'question_identity_table_missing'
  | 'question_identity_link_columns_missing'
  | 'question_attempt_missing_question'
  | 'review_log_missing_question_fk'
  | 'review_log_source_without_question_or_pregen'
  | 'card_missing_question'
  | 'user_progress_missing_medical_content'
  | 'study_session_question_ids_unresolved'
  | 'question_identity_source_target_unresolved'
  | 'study_session_question_missing_identity'
  | 'question_attempt_missing_identity'
  | 'review_log_missing_identity'
  | 'saved_question_missing_identity'
  | 'card_missing_identity';

export type LearningIdentityProbePrerequisite = {
  tables?: string[];
  columns?: Array<{ table: string; column: string }>;
};

export type LearningIdentityProbe = {
  id: LearningIdentityProbeId;
  description: string;
  countSql: string;
  sampleSql: string;
  requires?: LearningIdentityProbePrerequisite;
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

type MissingPrerequisites = {
  tables: string[];
  columns: Array<{ table: string; column: string }>;
};

export const LEARNING_IDENTITY_PROBES: LearningIdentityProbe[] = [
  {
    id: 'study_session_question_table_missing',
    description:
      'Normalized study_session_questions table required for ordered source identity links.',
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
    id: 'question_identity_table_missing',
    description: 'question_identities table required for normalized question source identity.',
    countSql: `
      SELECT CASE
        WHEN EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'question_identities'
        )
        THEN '0'
        ELSE '1'
      END AS count
    `,
    sampleSql: `
      SELECT 'question_identities' AS table_name,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'question_identities'
          )
          THEN 'present'
          ELSE 'missing'
        END AS status
    `,
  },
  {
    id: 'question_identity_link_columns_missing',
    description: 'Nullable questionIdentityId rollout columns required on learner-event tables.',
    countSql: `
      WITH expected(table_name, column_name) AS (
        VALUES
          ('study_session_questions', 'questionIdentityId'),
          ('QuestionAttempt', 'questionIdentityId'),
          ('ReviewLog', 'questionIdentityId'),
          ('SavedQuestion', 'questionIdentityId'),
          ('Card', 'questionIdentityId')
      )
      SELECT COUNT(*)::text AS count
      FROM expected e
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = e.table_name
       AND c.column_name = e.column_name
      WHERE c.column_name IS NULL
    `,
    sampleSql: `
      WITH expected(table_name, column_name) AS (
        VALUES
          ('study_session_questions', 'questionIdentityId'),
          ('QuestionAttempt', 'questionIdentityId'),
          ('ReviewLog', 'questionIdentityId'),
          ('SavedQuestion', 'questionIdentityId'),
          ('Card', 'questionIdentityId')
      )
      SELECT e.table_name, e.column_name, 'missing' AS status
      FROM expected e
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = e.table_name
       AND c.column_name = e.column_name
      WHERE c.column_name IS NULL
      ORDER BY e.table_name
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
    description:
      'ReviewLog.questionId source values that do not resolve to Question or PreGeneratedQuestion.',
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
    description:
      'UserProgress.conditionId values that do not satisfy the MedicalContent FK domain.',
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
    description:
      'StudySession.questionIds entries that do not resolve to Question or PreGeneratedQuestion.',
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
  {
    id: 'question_identity_source_target_unresolved',
    description: 'QuestionIdentity rows whose source-specific target row is missing.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM question_identities qi
      LEFT JOIN "Question" q
        ON qi."questionSource" IN ('question', 'generated')
       AND q.id = qi."sourceQuestionId"
      LEFT JOIN "PreGeneratedQuestion" pgq
        ON qi."questionSource" = 'pre_generated'
       AND pgq.id = qi."sourceQuestionId"
      LEFT JOIN "StagingQuestion" sq
        ON qi."questionSource" = 'staging'
       AND sq.id = qi."sourceQuestionId"
      LEFT JOIN "QuestionSeed" qs
        ON qi."questionSource" = 'seed'
       AND qs.id = qi."sourceQuestionId"
      WHERE qi."questionSource" IN ('question', 'generated', 'pre_generated', 'staging', 'seed')
        AND q.id IS NULL
        AND pgq.id IS NULL
        AND sq.id IS NULL
        AND qs.id IS NULL
    `,
    sampleSql: `
      SELECT qi.id, qi."questionSource", qi."sourceQuestionId", qi."canonicalQuestionId", qi."createdAt"
      FROM question_identities qi
      LEFT JOIN "Question" q
        ON qi."questionSource" IN ('question', 'generated')
       AND q.id = qi."sourceQuestionId"
      LEFT JOIN "PreGeneratedQuestion" pgq
        ON qi."questionSource" = 'pre_generated'
       AND pgq.id = qi."sourceQuestionId"
      LEFT JOIN "StagingQuestion" sq
        ON qi."questionSource" = 'staging'
       AND sq.id = qi."sourceQuestionId"
      LEFT JOIN "QuestionSeed" qs
        ON qi."questionSource" = 'seed'
       AND qs.id = qi."sourceQuestionId"
      WHERE qi."questionSource" IN ('question', 'generated', 'pre_generated', 'staging', 'seed')
        AND q.id IS NULL
        AND pgq.id IS NULL
        AND sq.id IS NULL
        AND qs.id IS NULL
      ORDER BY qi."createdAt" DESC
      LIMIT 20
    `,
    requires: { tables: ['question_identities'] },
  },
  {
    id: 'study_session_question_missing_identity',
    description:
      'StudySessionQuestion rows that have a source question but no normalized QuestionIdentity link.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM study_session_questions ssq
      WHERE ssq."questionIdentityId" IS NULL
        AND (ssq."questionId" IS NOT NULL OR ssq."preGeneratedQuestionId" IS NOT NULL)
    `,
    sampleSql: `
      SELECT ssq.id, ssq."sessionId", ssq."questionId", ssq."preGeneratedQuestionId", ssq.source, ssq."servedAt"
      FROM study_session_questions ssq
      WHERE ssq."questionIdentityId" IS NULL
        AND (ssq."questionId" IS NOT NULL OR ssq."preGeneratedQuestionId" IS NOT NULL)
      ORDER BY ssq."servedAt" DESC
      LIMIT 20
    `,
    requires: {
      tables: ['study_session_questions'],
      columns: [{ table: 'study_session_questions', column: 'questionIdentityId' }],
    },
  },
  {
    id: 'question_attempt_missing_identity',
    description: 'QuestionAttempt rows with a questionId but no normalized QuestionIdentity link.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "QuestionAttempt" qa
      WHERE qa."questionIdentityId" IS NULL
        AND qa."questionId" IS NOT NULL
    `,
    sampleSql: `
      SELECT qa.id, qa."userId", qa."questionId", qa.mode, qa."createdAt"
      FROM "QuestionAttempt" qa
      WHERE qa."questionIdentityId" IS NULL
        AND qa."questionId" IS NOT NULL
      ORDER BY qa."createdAt" DESC
      LIMIT 20
    `,
    requires: {
      columns: [{ table: 'QuestionAttempt', column: 'questionIdentityId' }],
    },
  },
  {
    id: 'review_log_missing_identity',
    description:
      'ReviewLog rows with question identity source fields but no normalized QuestionIdentity link.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "ReviewLog" rl
      WHERE rl."questionIdentityId" IS NULL
        AND (rl."questionId" IS NOT NULL OR rl."questionFkId" IS NOT NULL)
    `,
    sampleSql: `
      SELECT rl.id, rl."userId", rl."questionId", rl."questionFkId", rl."reviewedAt"
      FROM "ReviewLog" rl
      WHERE rl."questionIdentityId" IS NULL
        AND (rl."questionId" IS NOT NULL OR rl."questionFkId" IS NOT NULL)
      ORDER BY rl."reviewedAt" DESC
      LIMIT 20
    `,
    requires: {
      columns: [{ table: 'ReviewLog', column: 'questionIdentityId' }],
    },
  },
  {
    id: 'saved_question_missing_identity',
    description: 'SavedQuestion rows with a questionId but no normalized QuestionIdentity link.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "SavedQuestion" sq
      WHERE sq."questionIdentityId" IS NULL
        AND sq."questionId" IS NOT NULL
    `,
    sampleSql: `
      SELECT sq.id, sq."userId", sq."questionId", sq.type, sq."createdAt"
      FROM "SavedQuestion" sq
      WHERE sq."questionIdentityId" IS NULL
        AND sq."questionId" IS NOT NULL
      ORDER BY sq."createdAt" DESC
      LIMIT 20
    `,
    requires: {
      columns: [{ table: 'SavedQuestion', column: 'questionIdentityId' }],
    },
  },
  {
    id: 'card_missing_identity',
    description:
      'Card rows with a questionId but no normalized QuestionIdentity link for FSRS scheduling joins.',
    countSql: `
      SELECT COUNT(*)::text AS count
      FROM "Card" c
      WHERE c."questionIdentityId" IS NULL
        AND c."questionId" IS NOT NULL
    `,
    sampleSql: `
      SELECT c.id, c."userId", c."questionId", c."progressContext", c.due
      FROM "Card" c
      WHERE c."questionIdentityId" IS NULL
        AND c."questionId" IS NOT NULL
      ORDER BY c.due ASC
      LIMIT 20
    `,
    requires: {
      columns: [{ table: 'Card', column: 'questionIdentityId' }],
    },
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
        value instanceof Date
          ? value.toISOString()
          : typeof value === 'bigint'
            ? value.toString()
            : value,
      ])
    );
  });
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function findMissingPrerequisites(
  prisma: QueryablePrisma,
  prerequisites?: LearningIdentityProbePrerequisite
): Promise<MissingPrerequisites> {
  const missing: MissingPrerequisites = { tables: [], columns: [] };
  if (!prerequisites) return missing;

  if (prerequisites.tables?.length) {
    const tableValues = prerequisites.tables.map((table) => `(${sqlLiteral(table)})`).join(', ');
    const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
      WITH expected(table_name) AS (VALUES ${tableValues})
      SELECT e.table_name
      FROM expected e
      LEFT JOIN information_schema.tables t
        ON t.table_schema = 'public'
       AND t.table_name = e.table_name
      WHERE t.table_name IS NULL
      ORDER BY e.table_name
    `);
    missing.tables = rows.map((row) => row.table_name);
  }

  if (prerequisites.columns?.length) {
    const columnValues = prerequisites.columns
      .map(({ table, column }) => `(${sqlLiteral(table)}, ${sqlLiteral(column)})`)
      .join(', ');
    const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(`
      WITH expected(table_name, column_name) AS (VALUES ${columnValues})
      SELECT e.table_name, e.column_name
      FROM expected e
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = e.table_name
       AND c.column_name = e.column_name
      WHERE c.column_name IS NULL
      ORDER BY e.table_name, e.column_name
    `);
    missing.columns = rows.map((row) => ({
      table: row.table_name,
      column: row.column_name,
    }));
  }

  return missing;
}

function hasMissingPrerequisites(missing: MissingPrerequisites): boolean {
  return missing.tables.length > 0 || missing.columns.length > 0;
}

function formatSkippedProbeSamples(missing: MissingPrerequisites): Array<Record<string, unknown>> {
  return [
    {
      status: 'skipped',
      reason: 'required table or column is missing',
      missingTables: missing.tables,
      missingColumns: missing.columns,
    },
  ];
}

export function buildLearningIdentityRecommendations(
  probes: LearningIdentityProbeResult[]
): string[] {
  const byId = new Map(probes.map((probe) => [probe.id, probe.count]));
  const recommendations: string[] = [
    'Run this read-only audit before and after deploying the QuestionIdentity migration; do not enforce non-null identity links until missing-identity probes are clean.',
    'Keep legacy questionId/questionFkId compatibility fields until historical attempts, review logs, saved questions, cards, and session rows have acceptable QuestionIdentity coverage.',
  ];

  if ((byId.get('study_session_question_table_missing') ?? 0) > 0) {
    recommendations.push(
      'Deploy the normalized study schema so StudySessionQuestion links can be persisted instead of relying on StudySession.questionIds fallback.'
    );
  }
  if ((byId.get('question_identity_table_missing') ?? 0) > 0) {
    recommendations.push(
      'Deploy the additive QuestionIdentity migration before relying on identity-based scheduler or analytics joins.'
    );
  }
  if ((byId.get('question_identity_link_columns_missing') ?? 0) > 0) {
    recommendations.push(
      'Deploy the nullable questionIdentityId columns on learner-event tables before enabling runtime identity coverage checks.'
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
  if ((byId.get('question_identity_source_target_unresolved') ?? 0) > 0) {
    recommendations.push(
      'Repair or quarantine QuestionIdentity rows whose sourceQuestionId no longer resolves to the source table before trusting source-specific analytics.'
    );
  }

  const missingIdentityTotal =
    (byId.get('study_session_question_missing_identity') ?? 0) +
    (byId.get('question_attempt_missing_identity') ?? 0) +
    (byId.get('review_log_missing_identity') ?? 0) +
    (byId.get('saved_question_missing_identity') ?? 0) +
    (byId.get('card_missing_identity') ?? 0);
  if (missingIdentityTotal > 0) {
    recommendations.push(
      'Sample missing questionIdentityId rows by table, then rerun the migration backfill or a targeted idempotent repair before tightening scheduler joins.'
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
    const missingPrerequisites = await findMissingPrerequisites(prisma, probe.requires);
    if (hasMissingPrerequisites(missingPrerequisites)) {
      results.push({
        id: probe.id,
        description: probe.description,
        count: 0,
        samples: formatSkippedProbeSamples(missingPrerequisites),
      });
      continue;
    }

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
    throw new Error(
      'DATABASE_URL or DIRECT_DATABASE_URL is required for the read-only learning identity audit.'
    );
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
