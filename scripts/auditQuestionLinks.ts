import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

interface AuditIssue<T> {
  description: string;
  items: T[];
}

interface AuditReport {
  missingConditionId: AuditIssue<{ id: string; text: string }>;
  invalidConditionReferences: AuditIssue<{ id: string; conditionId: string }>;
  duplicateQuestionProgress: AuditIssue<{ questionId: string; userId: string; count: number }>;
  conditionsWithoutQuestions: AuditIssue<{ conditionId: string; name: string }>;
  generatedAt: string;
}

async function runAudit(): Promise<AuditReport> {
  const prisma = new PrismaClient();

  const questionsWithConditions = await prisma.question.findMany({
    include: { condition: true },
  });

  const missingConditionId = questionsWithConditions
    .filter((question) => !question.conditionId)
    .map((question) => ({ id: question.id, text: question.text }));

  const invalidConditionReferences = questionsWithConditions
    .filter((question) => !question.condition)
    .map((question) => ({ id: question.id, conditionId: question.conditionId }));

  const duplicateQuestionProgress = await prisma.questionProgress.groupBy({
    by: ['questionId', 'userId'],
    _count: { _all: true },
    having: {
      _count: {
        _all: {
          gt: 1,
        },
      },
    },
  });

  const conditionsWithoutQuestions = await prisma.condition.findMany({
    where: {
      questions: { none: {} },
    },
    select: {
      id: true,
      name: true,
    },
  });

  await prisma.$disconnect();

  return {
    missingConditionId: {
      description: 'Questions missing a conditionId value.',
      items: missingConditionId,
    },
    invalidConditionReferences: {
      description: 'Questions referencing a condition that does not exist.',
      items: invalidConditionReferences,
    },
    duplicateQuestionProgress: {
      description: 'Duplicate question progress entries detected for a user.',
      items: duplicateQuestionProgress.map((entry) => ({
        questionId: entry.questionId,
        userId: entry.userId,
        count: entry._count._all,
      })),
    },
    conditionsWithoutQuestions: {
      description: 'Conditions that are not linked to any question.',
      items: conditionsWithoutQuestions,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function writeReport(report: AuditReport): Promise<void> {
  const outputDir = join(process.cwd(), 'output');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'question_audit_report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Audit report written to ${outputPath}`);
}

runAudit()
  .then(writeReport)
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Audit failed', error);
    process.exitCode = 1;
  });
