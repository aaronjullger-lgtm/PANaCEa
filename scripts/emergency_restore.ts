#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// CHANGE THIS string to the folder name created in Step 1 (e.g., '2025-12-18T04-00-00-000Z')
const BACKUP_FOLDER: string = process.env.BACKUP_FOLDER || '2025-12-19T04-58-03-149Z';

async function restore() {
  if (BACKUP_FOLDER === 'PASTE_YOUR_TIMESTAMP_FOLDER_HERE') {
    console.error(
      '❌ ERROR: Please edit this file and set BACKUP_FOLDER to your backup timestamp folder!'
    );
    console.error('   Look in the backups/ directory for the folder name.');
    process.exit(1);
  }

  const backupDir = path.join(__dirname, '../backups', BACKUP_FOLDER);

  if (!fs.existsSync(backupDir)) {
    console.error(`❌ ERROR: Backup folder not found: ${backupDir}`);
    process.exit(1);
  }

  console.log(`♻️  Restoring from ${backupDir}...\n`);

  const tables = [
    {
      name: 'User',
      filename: 'users.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.user.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'UserSRSConfig',
      filename: 'user_srs_config.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.userSRSConfig.upsert({
            where: { userId: item.userId },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'Condition',
      filename: 'conditions.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.condition.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'Drug',
      filename: 'drugs.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.drug.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'LabTest',
      filename: 'lab_tests.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.labTest.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'LabCase',
      filename: 'lab_cases.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.labCase.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'AnatomyStructure',
      filename: 'anatomy_structures.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.anatomyStructure.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'SpecialTest',
      filename: 'special_tests.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.specialTest.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'MediaAsset',
      filename: 'media_assets.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.mediaAsset.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'PerformanceRecord',
      filename: 'performance_records.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.performanceRecord.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'SRSItem',
      filename: 'srs_items.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.sRSItem.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'SavedQuestion',
      filename: 'saved_questions.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.savedQuestion.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'UserAchievement',
      filename: 'user_achievements.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.userAchievement.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'DailyStreak',
      filename: 'daily_streaks.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.dailyStreak.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'GrandRoundsChallenge',
      filename: 'grand_rounds_challenges.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.grandRoundsChallenge.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'GrandRoundsAttempt',
      filename: 'grand_rounds_attempts.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.grandRoundsAttempt.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'ConfusionPair',
      filename: 'confusion_pairs.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.confusionPair.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'MasteryProgress',
      filename: 'mastery_progress.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.masteryProgress.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'BaselineAssessment',
      filename: 'baseline_assessments.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.baselineAssessment.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'ExplanationReaction',
      filename: 'explanation_reactions.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.explanationReaction.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'WeaknessPattern',
      filename: 'weakness_patterns.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.weaknessPattern.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'MedicalContent',
      filename: 'medical_content.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.medicalContent.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'Buzzword',
      filename: 'buzzwords.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.buzzword.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'DailyWordle',
      filename: 'daily_wordles.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.dailyWordle.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'UserWordleState',
      filename: 'user_wordle_states.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.userWordleState.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'ContentVersion',
      filename: 'content_versions.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.contentVersion.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'ContentAuditLog',
      filename: 'content_audit_logs.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.contentAuditLog.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'ContentHealthReport',
      filename: 'content_health_reports.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.contentHealthReport.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'PreGeneratedQuestion',
      filename: 'pre_generated_questions.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.preGeneratedQuestion.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'BackgroundJob',
      filename: 'background_jobs.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.backgroundJob.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'ContentLock',
      filename: 'content_locks.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.contentLock.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'SyncQueue',
      filename: 'sync_queue.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.syncQueue.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'EducationalResource',
      filename: 'educational_resources.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.educationalResource.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'QuestionFlag',
      filename: 'question_flags.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.questionFlag.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'SemanticCache',
      filename: 'semantic_cache.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          const record = item as any;
          await prisma.semanticCache.upsert({
            where: { id: record.id ?? record.key },
            update: record,
            create: record,
          } as any);
        }
      },
    },
    {
      name: 'QuestionHistory',
      filename: 'question_history.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.questionHistory.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'ContentBranch',
      filename: 'content_branches.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.contentBranch.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'BranchChange',
      filename: 'branch_changes.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.branchChange.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'Question',
      filename: 'questions.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.question.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'StagingQuestion',
      filename: 'staging_questions.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.stagingQuestion.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'UserQuestionSeen',
      filename: 'user_question_seen.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.userQuestionSeen.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'QuestionAttempt',
      filename: 'question_attempts.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.questionAttempt.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'ClinicalPearl',
      filename: 'clinical_pearls.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.clinicalPearl.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'EncounterResult',
      filename: 'encounter_results.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.encounterResult.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'StudyGroup',
      filename: 'study_groups.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.studyGroup.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'StudyGroupMember',
      filename: 'study_group_members.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.studyGroupMember.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'PatientEncounterSession',
      filename: 'patient_encounter_sessions.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.patientEncounterSession.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'PatientEncounterCase',
      filename: 'patient_encounter_cases.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.patientEncounterCase.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'ClinicalGuideline',
      filename: 'clinical_guidelines.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.clinicalGuideline.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'ImagingStudy',
      filename: 'imaging_studies.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.imagingStudy.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'PhysicalExamFinding',
      filename: 'physical_exam_findings.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.physicalExamFinding.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'PracticeGuideline',
      filename: 'practice_guidelines.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.practiceGuideline.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'PhysiologyConcept',
      filename: 'physiology_concepts.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.physiologyConcept.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'Treatment',
      filename: 'treatments.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.treatment.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'DifferentialDiagnosis',
      filename: 'differential_diagnoses.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.differentialDiagnosis.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'FirstLineTreatment',
      filename: 'first_line_treatments.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.firstLineTreatment.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
        }
      },
    },
    {
      name: 'QuestionSeed',
      filename: 'question_seeds.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.questionSeed.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
    {
      name: 'UserPearl',
      filename: 'user_pearls.json',
      accessor: async (data: any[]) => {
        for (const item of data) {
          await prisma.userPearl.upsert({ where: { id: item.id }, update: item, create: item });
        }
      },
    },
  ];

  for (const table of tables) {
    const filePath = path.join(backupDir, table.filename);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${table.name} backup file not found, skipping...`);
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      await table.accessor(data);
      console.log(`✅ Restored ${data.length} ${table.name} records`);
    } catch (error: any) {
      console.log(`⚠️  Error restoring ${table.name}, skipping...`, error.message);
    }
  }

  console.log('\n🎉 Restoration Complete! Your data has been restored.');
}

restore()
  .catch((error) => {
    console.error('❌ Restoration failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
