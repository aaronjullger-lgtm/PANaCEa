#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../backups', timestamp);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`📦 Starting Backup to ${backupDir}...`);

  const tables = [
    { name: 'User', filename: 'users.json', accessor: () => prisma.user.findMany() },
    { name: 'UserSRSConfig', filename: 'user_srs_config.json', accessor: () => prisma.userSRSConfig.findMany() },
    { name: 'Condition', filename: 'conditions.json', accessor: () => prisma.condition.findMany() },
    { name: 'Drug', filename: 'drugs.json', accessor: () => prisma.drug.findMany() },
    { name: 'LabTest', filename: 'lab_tests.json', accessor: () => prisma.labTest.findMany() },
    { name: 'LabCase', filename: 'lab_cases.json', accessor: () => prisma.labCase.findMany() },
    { name: 'AnatomyStructure', filename: 'anatomy_structures.json', accessor: () => prisma.anatomyStructure.findMany() },
    { name: 'SpecialTest', filename: 'special_tests.json', accessor: () => prisma.specialTest.findMany() },
    { name: 'MediaAsset', filename: 'media_assets.json', accessor: () => prisma.mediaAsset.findMany() },
    { name: 'PerformanceRecord', filename: 'performance_records.json', accessor: () => prisma.performanceRecord.findMany() },
    { name: 'SRSItem', filename: 'srs_items.json', accessor: () => prisma.sRSItem.findMany() },
    { name: 'SavedQuestion', filename: 'saved_questions.json', accessor: () => prisma.savedQuestion.findMany() },
    { name: 'UserAchievement', filename: 'user_achievements.json', accessor: () => prisma.userAchievement.findMany() },
    { name: 'DailyStreak', filename: 'daily_streaks.json', accessor: () => prisma.dailyStreak.findMany() },
    { name: 'GrandRoundsChallenge', filename: 'grand_rounds_challenges.json', accessor: () => prisma.grandRoundsChallenge.findMany() },
    { name: 'GrandRoundsAttempt', filename: 'grand_rounds_attempts.json', accessor: () => prisma.grandRoundsAttempt.findMany() },
    { name: 'ConfusionPair', filename: 'confusion_pairs.json', accessor: () => prisma.confusionPair.findMany() },
    { name: 'MasteryProgress', filename: 'mastery_progress.json', accessor: () => prisma.masteryProgress.findMany() },
    { name: 'BaselineAssessment', filename: 'baseline_assessments.json', accessor: () => prisma.baselineAssessment.findMany() },
    { name: 'ExplanationReaction', filename: 'explanation_reactions.json', accessor: () => prisma.explanationReaction.findMany() },
    { name: 'WeaknessPattern', filename: 'weakness_patterns.json', accessor: () => prisma.weaknessPattern.findMany() },
    { name: 'MedicalContent', filename: 'medical_content.json', accessor: () => prisma.medicalContent.findMany() },
    { name: 'Buzzword', filename: 'buzzwords.json', accessor: () => prisma.buzzword.findMany() },
    { name: 'DailyWordle', filename: 'daily_wordles.json', accessor: () => prisma.dailyWordle.findMany() },
    { name: 'UserWordleState', filename: 'user_wordle_states.json', accessor: () => prisma.userWordleState.findMany() },
    { name: 'ContentVersion', filename: 'content_versions.json', accessor: () => prisma.contentVersion.findMany() },
    { name: 'ContentAuditLog', filename: 'content_audit_logs.json', accessor: () => prisma.contentAuditLog.findMany() },
    { name: 'ContentHealthReport', filename: 'content_health_reports.json', accessor: () => prisma.contentHealthReport.findMany() },
    { name: 'PreGeneratedQuestion', filename: 'pre_generated_questions.json', accessor: () => prisma.preGeneratedQuestion.findMany() },
    { name: 'BackgroundJob', filename: 'background_jobs.json', accessor: () => prisma.backgroundJob.findMany() },
    { name: 'ContentLock', filename: 'content_locks.json', accessor: () => prisma.contentLock.findMany() },
    { name: 'SyncQueue', filename: 'sync_queue.json', accessor: () => prisma.syncQueue.findMany() },
    { name: 'EducationalResource', filename: 'educational_resources.json', accessor: () => prisma.educationalResource.findMany() },
    { name: 'QuestionFlag', filename: 'question_flags.json', accessor: () => prisma.questionFlag.findMany() },
    { name: 'SemanticCache', filename: 'semantic_cache.json', accessor: () => prisma.semanticCache.findMany() },
    { name: 'QuestionHistory', filename: 'question_history.json', accessor: () => prisma.questionHistory.findMany() },
    { name: 'ContentBranch', filename: 'content_branches.json', accessor: () => prisma.contentBranch.findMany() },
    { name: 'BranchChange', filename: 'branch_changes.json', accessor: () => prisma.branchChange.findMany() },
    { name: 'Question', filename: 'questions.json', accessor: () => prisma.question.findMany() },
    { name: 'StagingQuestion', filename: 'staging_questions.json', accessor: () => prisma.stagingQuestion.findMany() },
    { name: 'UserQuestionHistory', filename: 'user_question_history.json', accessor: () => prisma.userQuestionHistory.findMany() },
    { name: 'QuestionAttempt', filename: 'question_attempts.json', accessor: () => prisma.questionAttempt.findMany() },
    { name: 'ClinicalPearl', filename: 'clinical_pearls.json', accessor: () => prisma.clinicalPearl.findMany() },
    { name: 'EncounterResult', filename: 'encounter_results.json', accessor: () => prisma.encounterResult.findMany() },
    { name: 'StudyGroup', filename: 'study_groups.json', accessor: () => prisma.studyGroup.findMany() },
    { name: 'StudyGroupMember', filename: 'study_group_members.json', accessor: () => prisma.studyGroupMember.findMany() },
    { name: 'PatientEncounterSession', filename: 'patient_encounter_sessions.json', accessor: () => prisma.patientEncounterSession.findMany() },
    { name: 'PatientEncounterCase', filename: 'patient_encounter_cases.json', accessor: () => prisma.patientEncounterCase.findMany() },
    { name: 'ClinicalGuideline', filename: 'clinical_guidelines.json', accessor: () => prisma.clinicalGuideline.findMany() },
    { name: 'ImagingStudy', filename: 'imaging_studies.json', accessor: () => prisma.imagingStudy.findMany() },
    { name: 'PhysicalExamFinding', filename: 'physical_exam_findings.json', accessor: () => prisma.physicalExamFinding.findMany() },
    { name: 'PracticeGuideline', filename: 'practice_guidelines.json', accessor: () => prisma.practiceGuideline.findMany() },
    { name: 'PhysiologyConcept', filename: 'physiology_concepts.json', accessor: () => prisma.physiologyConcept.findMany() },
    { name: 'Treatment', filename: 'treatments.json', accessor: () => prisma.treatment.findMany() },
    { name: 'DifferentialDiagnosis', filename: 'differential_diagnoses.json', accessor: () => prisma.differentialDiagnosis.findMany() },
    { name: 'FirstLineTreatment', filename: 'first_line_treatments.json', accessor: () => prisma.firstLineTreatment.findMany() },
    { name: 'QuestionSeed', filename: 'question_seeds.json', accessor: () => prisma.questionSeed.findMany() },
    { name: 'UserPearl', filename: 'user_pearls.json', accessor: () => prisma.userPearl.findMany() },
  ];

  for (const table of tables) {
    try {
      const data = await table.accessor();
      fs.writeFileSync(
        path.join(backupDir, table.filename),
        JSON.stringify(data, null, 2)
      );
      console.log(`✅ Saved ${data.length} ${table.name} records`);
    } catch (error) {
      console.log(`⚠️  ${table.name} table not found or error, skipping...`);
    }
  }

  console.log('\n🎉 Backup Complete! Your data is safe locally.');
  console.log(`📁 Backup location: ${backupDir}`);
  console.log(`\n⚠️  IMPORTANT: Save this folder name for restoration:`);
  console.log(`   ${timestamp}`);
}

backup()
  .catch((error) => {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
