/**
 * Step 1: Condition-to-MedicalContent Data Unification
 *
 * This script:
 * 1. Audits orphaned records in both Condition and MedicalContent tables
 * 2. Creates missing MedicalContent records for conditions without them
 * 3. Reports on data integrity issues
 * 4. Prepares for adding foreign key constraint
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';
import { v4 as uuidv4 } from 'uuid';

interface AuditReport {
  conditionsWithoutContent: string[];
  contentWithoutCondition: string[];
  conditionsWithContentMismatch: Array<{
    conditionId: string;
    conditionName: string;
    contentCondition: string;
  }>;
  totalConditions: number;
  totalMedicalContent: number;
  orphanedConditions: number;
  orphanedContent: number;
}

async function auditConditionContentSync(): Promise<AuditReport> {
  try {
    console.log('🔍 Starting Condition ↔ MedicalContent audit...\n');

    // Get all conditions
    const allConditions = await prisma.condition.findMany({
      select: { id: true, name: true, system: true, subcategory: true },
    });

    // Get all medical content
    const allContent = await prisma.medicalContent.findMany({
      select: { id: true, conditionId: true, condition: true },
    });

    // Create lookup maps
    const conditionMap = new Map(allConditions.map((c) => [c.id, c]));
    const contentMap = new Map(allContent.map((c) => [c.conditionId, c]));

    // Find orphaned records
    const conditionsWithoutContent: string[] = [];
    const contentWithoutCondition: string[] = [];
    const conditionsWithContentMismatch: AuditReport['conditionsWithContentMismatch'] = [];

    // Check conditions without content
    for (const condition of allConditions) {
      if (!contentMap.has(condition.id)) {
        conditionsWithoutContent.push(condition.id);
      }
    }

    // Check content without condition
    for (const content of allContent) {
      if (!conditionMap.has(content.conditionId)) {
        contentWithoutCondition.push(content.conditionId);
      } else {
        // Check for name mismatches
        const condition = conditionMap.get(content.conditionId)!;
        if (condition.name !== content.condition) {
          conditionsWithContentMismatch.push({
            conditionId: content.conditionId,
            conditionName: condition.name,
            contentCondition: content.condition,
          });
        }
      }
    }

    const report: AuditReport = {
      conditionsWithoutContent,
      contentWithoutCondition,
      conditionsWithContentMismatch,
      totalConditions: allConditions.length,
      totalMedicalContent: allContent.length,
      orphanedConditions: conditionsWithoutContent.length,
      orphanedContent: contentWithoutCondition.length,
    };

    return report;
  } catch (error) {
    console.error('Error in audit:', error);
    throw error;
  }
}

async function createMissingMedicalContent(conditionIds: string[]): Promise<number> {
  let created = 0;

  try {
    console.log(`\n📝 Creating MedicalContent records for ${conditionIds.length} conditions...\n`);

    for (const conditionId of conditionIds) {
      const condition = await prisma.condition.findUnique({
        where: { id: conditionId },
        select: {
          id: true,
          name: true,
          system: true,
          subcategory: true,
          parent_category: true,
          relatedSystems: true,
        },
      });

      if (!condition) {
        console.log(`⚠️  Condition ${conditionId} not found, skipping...`);
        continue;
      }

      // Create MedicalContent record
      await prisma.medicalContent.create({
        data: {
          id: condition.id,
          conditionId: condition.id,
          condition: condition.name,
          system: condition.system,
          subcategory: condition.subcategory || '',
          parent_category: condition.parent_category,
          relatedSystems: condition.relatedSystems,
          status: 'draft',
          version: 1,
          createdBy: 'system',
          updatedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      created++;
      console.log(`✅ Created MedicalContent for: ${condition.name}`);
    }

    return created;
  } catch (error) {
    console.error('Error creating MedicalContent:', error);
    throw error;
  }
}

async function fixNameMismatches(
  mismatches: AuditReport['conditionsWithContentMismatch']
): Promise<number> {
  let fixed = 0;

  try {
    console.log(`\n🔧 Fixing ${mismatches.length} name mismatches...\n`);

    for (const mismatch of mismatches) {
      await prisma.medicalContent.update({
        where: { conditionId: mismatch.conditionId },
        data: {

          id: uuidv4(),

          condition: mismatch.conditionName,
          updatedAt: new Date(),
          updatedBy: 'system',
        },
      });

      fixed++;
      console.log(`✅ Fixed: "${mismatch.contentCondition}" → "${mismatch.conditionName}"`);
    }

    return fixed;
  } catch (error) {
    console.error('Error fixing name mismatches:', error);
    throw error;
  }
}

async function deleteOrphanedContent(contentIds: string[]): Promise<number> {
  try {
    if (contentIds.length === 0) return 0;

    console.log(`\n🗑️  Deleting ${contentIds.length} orphaned MedicalContent records...\n`);

    const result = await prisma.medicalContent.deleteMany({
      where: { conditionId: { in: contentIds } },
    });

    console.log(`✅ Deleted ${result.count} orphaned MedicalContent records`);
    return result.count;
  } catch (error) {
    console.error('Error deleting orphaned content:', error);
    throw error;
  }
}

async function printReport(report: AuditReport): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📊 CONDITION ↔ MEDICALCONTENT AUDIT REPORT');
  console.log('='.repeat(60));
  console.log(`\nTotal Conditions:      ${report.totalConditions}`);
  console.log(`Total MedicalContent:  ${report.totalMedicalContent}`);
  console.log(`\n🔴 Issues Found:`);
  console.log(`  • Conditions without MedicalContent: ${report.orphanedConditions}`);
  console.log(`  • MedicalContent without Condition:  ${report.orphanedContent}`);
  console.log(
    `  • Name mismatches:                   ${report.conditionsWithContentMismatch.length}`
  );

  if (report.orphanedConditions > 0) {
    console.log(`\n⚠️  Conditions without MedicalContent (showing first 10):`);
    report.conditionsWithoutContent.slice(0, 10).forEach((id) => {
      console.log(`    - ${id}`);
    });
    if (report.orphanedConditions > 10) {
      console.log(`    ... and ${report.orphanedConditions - 10} more`);
    }
  }

  if (report.orphanedContent > 0) {
    console.log(`\n⚠️  MedicalContent without Condition (showing first 10):`);
    report.contentWithoutCondition.slice(0, 10).forEach((id) => {
      console.log(`    - ${id}`);
    });
    if (report.orphanedContent > 10) {
      console.log(`    ... and ${report.orphanedContent - 10} more`);
    }
  }

  if (report.conditionsWithContentMismatch.length > 0) {
    console.log(`\n⚠️  Name mismatches (showing first 5):`);
    report.conditionsWithContentMismatch.slice(0, 5).forEach((m) => {
      console.log(`    - ${m.conditionId}:`);
      console.log(`      Condition: "${m.conditionName}"`);
      console.log(`      Content:   "${m.contentCondition}"`);
    });
    if (report.conditionsWithContentMismatch.length > 5) {
      console.log(`    ... and ${report.conditionsWithContentMismatch.length - 5} more`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const auditOnly = args.includes('--audit-only');
  const fix = args.includes('--fix');
  const deleteOrphaned = args.includes('--delete-orphaned');

  console.log('🏥 PANaCEa Database: Condition ↔ MedicalContent Unification\n');

  // Step 1: Run audit
  const report = await auditConditionContentSync();
  await printReport(report);

  if (auditOnly) {
    console.log('ℹ️  Audit-only mode. Use --fix to create missing records.\n');
    return;
  }

  // Step 2: Fix issues
  if (fix) {
    let totalFixed = 0;

    // Fix name mismatches first
    if (report.conditionsWithContentMismatch.length > 0) {
      const fixed = await fixNameMismatches(report.conditionsWithContentMismatch);
      totalFixed += fixed;
    }

    // Create missing MedicalContent records
    if (report.orphanedConditions > 0) {
      const created = await createMissingMedicalContent(report.conditionsWithoutContent);
      totalFixed += created;
    }

    // Delete orphaned content if requested
    if (deleteOrphaned && report.orphanedContent > 0) {
      const deleted = await deleteOrphanedContent(report.contentWithoutCondition);
      totalFixed += deleted;
    } else if (report.orphanedContent > 0) {
      console.log(`\nℹ️  ${report.orphanedContent} orphaned MedicalContent records found.`);
      console.log('   Use --delete-orphaned flag to remove them.\n');
    }

    console.log(`\n✅ Total changes: ${totalFixed}`);

    // Run audit again to verify
    console.log('\n🔄 Running verification audit...');
    const verifyReport = await auditConditionContentSync();
    await printReport(verifyReport);

    if (
      verifyReport.orphanedConditions === 0 &&
      verifyReport.conditionsWithContentMismatch.length === 0 &&
      (deleteOrphaned ? verifyReport.orphanedContent === 0 : true)
    ) {
      console.log('✅ SUCCESS: All issues resolved!\n');
      console.log('📝 Next steps:');
      console.log('   1. Add foreign key constraint to schema.prisma:');
      console.log('      MedicalContent.conditionId → Condition.id');
      console.log('   2. Run: npx prisma migrate dev --name add-medicalcontent-fk');
      console.log('   3. Deprecate Condition.content JSONB field\n');
    } else {
      console.log('⚠️  Some issues remain. Review the report above.\n');
    }
  } else {
    console.log('ℹ️  Use --fix to automatically resolve issues.');
    console.log('   Options:');
    console.log('     --audit-only         : Only show the report, no changes');
    console.log('     --fix                : Create missing MedicalContent records');
    console.log('     --delete-orphaned    : Delete orphaned MedicalContent (use with --fix)');
    console.log('\n   Example: npm run db:unify -- --fix --delete-orphaned\n');
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
