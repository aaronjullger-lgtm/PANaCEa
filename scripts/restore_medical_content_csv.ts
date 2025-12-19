#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Backup folder with the CSV
const BACKUP_FOLDER = '2025-12-19T04-58-03-149Z';

async function restoreMedicalContentFromCSV() {
  const backupDir = path.join(__dirname, '../backups', BACKUP_FOLDER);
  const csvPath = path.join(backupDir, 'MedicalContent_rows.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ ERROR: CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading CSV from ${csvPath}...`);

  try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV with headers
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        // Handle null values
        if (value === '' || value === 'NULL') {
          return null;
        }
        
        // Parse JSON fields (including arrays)
        if (context.column === 'content' || 
            context.column === 'metadata' || 
            context.column === 'references' || 
            context.column === 'tags' ||
            context.column === 'relatedSystems' ||
            context.column === 'buzzwords' ||
            context.column === 'complications' ||
            context.column === 'riskFactors' ||
            context.column === 'symptoms' ||
            context.column === 'physicalExam' ||
            context.column === 'differentialDiagnosis') {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        
        // Parse boolean fields
        if (context.column === 'isPublished') {
          return value === 'true' || value === '1' || value === 't';
        }
        
        // Parse integer fields
        if (context.column === 'version') {
          return parseInt(value, 10);
        }
        
        // Parse date fields
        if (context.column === 'createdAt' || 
            context.column === 'updatedAt' || 
            context.column === 'publishedAt' ||
            context.column === 'approvedAt') {
          return value ? new Date(value) : null;
        }
        
        return value;
      }
    }) as any[];

    console.log(`📊 Found ${records.length} MedicalContent records in CSV`);

    // Check for existing records to avoid duplicates
    const existingRecords = await prisma.medicalContent.findMany({
      select: { id: true, conditionId: true }
    });
    const existingIds = new Set(existingRecords.map(r => r.id));
    const existingConditionIds = new Set(existingRecords.map(r => r.conditionId));

    console.log(`📋 Found ${existingIds.size} existing records in database`);

    // Restore each record
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const record of records as any[]) {
      const rec = record as any;
      try {
        // Check for duplicates by both id and conditionId
        if (existingIds.has(rec.id)) {
          console.log(`⏭️  Skipping duplicate ID: ${rec.id} (${rec.condition})`);
          skippedCount++;
          continue;
        }

        if (rec.conditionId && existingConditionIds.has(rec.conditionId)) {
          console.log(`⏭️  Skipping duplicate conditionId: ${rec.conditionId} (${rec.condition})`);
          skippedCount++;
          continue;
        }

        // Use create instead of upsert since we've already checked for existence
        await prisma.medicalContent.create({
          data: rec as any,
        });
        successCount++;
        
        // Add to tracking sets
        existingIds.add(rec.id);
        if (rec.conditionId) {
          existingConditionIds.add(rec.conditionId);
        }
      } catch (error: any) {
        console.error(`⚠️  Error restoring record ${rec.id} (${rec.condition}):`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ Successfully restored ${successCount} MedicalContent records`);
    if (skippedCount > 0) {
      console.log(`⏭️  Skipped ${skippedCount} duplicate records`);
    }
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} records failed to restore`);
    }
    console.log('\n🎉 MedicalContent restoration complete!');

  } catch (error: any) {
    console.error('❌ Error reading or parsing CSV:', error.message);
    process.exit(1);
  }
}

restoreMedicalContentFromCSV()
  .catch((error) => {
    console.error('❌ Restoration failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
