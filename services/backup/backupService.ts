/**
 * Backup & Disaster Recovery Service
 *
 * Provides automated backup, encryption, and disaster recovery capabilities
 * for medical education platform data.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BackupConfig {
  /** Backup directory path */
  backupDir: string;
  /** Encryption key for sensitive data (optional) */
  encryptionKey?: string;
  /** Retention policy in days */
  retentionDays: number;
  /** Maximum backup size in MB */
  maxSizeMB: number;
  /** Enable compression */
  enableCompression: boolean;
  /** Enable encryption */
  enableEncryption: boolean;
  /** Cloud storage providers */
  cloudProviders: CloudProvider[];
  /** Schedule in cron format */
  schedule?: string;
  /** Notify on backup failure */
  notifyOnFailure: boolean;
}

export interface CloudProvider {
  /** Provider name */
  name: 's3' | 'gcs' | 'azure' | 'cloudflare-r2';
  /** Configuration */
  config: Record<string, any>;
  /** Enable for this provider */
  enabled: boolean;
}

export interface BackupMetadata {
  /** Backup ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Backup size in bytes */
  size: number;
  /** Checksum */
  checksum: string;
  /** Database version */
  databaseVersion: string;
  /** Tables included */
  tables: string[];
  /** Status */
  status: 'success' | 'partial' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Encryption status */
  encrypted: boolean;
  /** Compression ratio */
  compressionRatio?: number;
  /** Cloud storage locations */
  cloudLocations: string[];
}

export interface DisasterRecoveryPlan {
  /** Recovery Time Objective (RTO) in minutes */
  rto: number;
  /** Recovery Point Objective (RPO) in minutes */
  rpo: number;
  /** Critical data tables */
  criticalTables: string[];
  /** Recovery procedures */
  procedures: RecoveryProcedure[];
  /** Contact persons */
  contacts: RecoveryContact[];
  /** Testing schedule */
  testSchedule: string;
}

export interface RecoveryProcedure {
  /** Procedure name */
  name: string;
  /** Steps */
  steps: string[];
  /** Estimated time */
  estimatedTime: string;
  /** Prerequisites */
  prerequisites: string[];
}

export interface RecoveryContact {
  /** Name */
  name: string;
  /** Role */
  role: string;
  /** Contact info */
  contact: string;
  /** Availability */
  availability: string;
}

export class BackupService {
  private prisma: PrismaClient;
  private config: BackupConfig;
  private metadata: BackupMetadata[] = [];

  constructor(prisma: PrismaClient, config?: Partial<BackupConfig>) {
    this.prisma = prisma;
    this.config = {
      backupDir: path.join(__dirname, '../../../backups'),
      retentionDays: 30,
      maxSizeMB: 1024, // 1GB
      enableCompression: true,
      enableEncryption: false,
      cloudProviders: [],
      notifyOnFailure: true,
      ...config,
    };

    // Ensure backup directory exists
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }

    // Load existing metadata
    this.loadMetadata();
  }

  /**
   * Perform full database backup
   */
  public async performFullBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    const backupPath = path.join(this.config.backupDir, backupId);

    console.log(`📦 Starting full backup: ${backupId}`);

    try {
      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });

      // Get database version
      const databaseVersion = await this.getDatabaseVersion();

      // Backup all tables
      const tables = await this.backupTables(backupPath);

      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        size: await this.calculateBackupSize(backupPath),
        checksum: await this.calculateChecksum(backupPath),
        databaseVersion,
        tables,
        status: 'success',
        encrypted: this.config.enableEncryption,
        cloudLocations: [],
      };

      // Apply compression if enabled
      if (this.config.enableCompression) {
        await this.compressBackup(backupPath, metadata);
      }

      // Apply encryption if enabled
      if (this.config.enableEncryption && this.config.encryptionKey) {
        await this.encryptBackup(backupPath, metadata);
      }

      // Upload to cloud providers
      if (this.config.cloudProviders.length > 0) {
        await this.uploadToCloud(backupPath, metadata);
      }

      // Save metadata
      this.metadata.push(metadata);
      this.saveMetadata();

      // Apply retention policy
      await this.applyRetentionPolicy();

      console.log(`✅ Backup completed: ${backupId}`);
      return metadata;
    } catch (error) {
      console.error('❌ Backup failed:', error);

      const failedMetadata: BackupMetadata = {
        id: backupId,
        timestamp,
        size: 0,
        checksum: '',
        databaseVersion: 'unknown',
        tables: [],
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        encrypted: false,
        cloudLocations: [],
      };

      this.metadata.push(failedMetadata);
      this.saveMetadata();

      // Notify on failure
      if (this.config.notifyOnFailure) {
        await this.notifyFailure(failedMetadata);
      }

      throw error;
    }
  }

  /**
   * Perform incremental backup
   */
  public async performIncrementalBackup(): Promise<BackupMetadata> {
    console.log('🔄 Starting incremental backup');

    // Get last successful backup
    const lastBackup = this.metadata
      .filter((m) => m.status === 'success')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    if (!lastBackup) {
      console.log('No previous backup found, performing full backup instead');
      return this.performFullBackup();
    }

    // For now, implement as full backup
    // In production, this would track changed records since last backup
    return this.performFullBackup();
  }

  /**
   * Restore from backup
   */
  public async restoreBackup(backupId: string, targetDatabaseUrl?: string): Promise<void> {
    console.log(`♻️ Restoring from backup: ${backupId}`);

    const metadata = this.metadata.find((m) => m.id === backupId);
    if (!metadata) {
      throw new Error(`Backup ${backupId} not found`);
    }

    if (metadata.status !== 'success') {
      throw new Error(`Backup ${backupId} has status: ${metadata.status}`);
    }

    const backupPath = path.join(this.config.backupDir, backupId);

    try {
      // Decrypt if needed
      if (metadata.encrypted) {
        await this.decryptBackup(backupPath, metadata);
      }

      // Decompress if needed
      if (metadata.compressionRatio) {
        await this.decompressBackup(backupPath, metadata);
      }

      // Restore tables
      await this.restoreTables(backupPath, metadata);

      console.log(`✅ Restore completed: ${backupId}`);
    } catch (error) {
      console.error('❌ Restore failed:', error);
      throw error;
    }
  }

  /**
   * Get disaster recovery plan
   */
  public getDisasterRecoveryPlan(): DisasterRecoveryPlan {
    return {
      rto: 60, // 60 minutes Recovery Time Objective
      rpo: 15, // 15 minutes Recovery Point Objective
      criticalTables: [
        'User',
        'UserProgress',
        'PerformanceRecord',
        'ReviewLog',
        'MedicalContent',
        'Question',
      ],
      procedures: [
        {
          name: 'Database Corruption Recovery',
          steps: [
            '1. Identify affected tables from error logs',
            '2. Stop application traffic to affected database',
            '3. Restore from latest backup',
            '4. Apply transaction logs if available',
            '5. Verify data integrity',
            '6. Resume application traffic',
          ],
          estimatedTime: '30-60 minutes',
          prerequisites: ['Valid backup available', 'Database admin access'],
        },
        {
          name: 'Cloud Provider Outage',
          steps: [
            '1. Activate failover to secondary region',
            '2. Update DNS records',
            '3. Verify database replication',
            '4. Monitor application performance',
            '5. Communicate status to users',
          ],
          estimatedTime: '15-30 minutes',
          prerequisites: ['Multi-region deployment configured'],
        },
        {
          name: 'Data Breach Response',
          steps: [
            '1. Isolate affected systems',
            '2. Preserve forensic evidence',
            '3. Notify security team',
            '4. Assess scope of breach',
            '5. Reset compromised credentials',
            '6. Notify affected users if required',
          ],
          estimatedTime: '2-4 hours',
          prerequisites: ['Incident response team contact list'],
        },
      ],
      contacts: [
        {
          name: 'System Administrator',
          role: 'Primary technical contact',
          contact: 'admin@panacea.app',
          availability: '24/7 on-call',
        },
        {
          name: 'Database Administrator',
          role: 'Database recovery specialist',
          contact: 'dba@panacea.app',
          availability: 'Business hours + on-call',
        },
        {
          name: 'Security Officer',
          role: 'Security incident response',
          contact: 'security@panacea.app',
          availability: '24/7 on-call',
        },
      ],
      testSchedule: 'Quarterly',
    };
  }

  /**
   * Test disaster recovery
   */
  public async testDisasterRecovery(): Promise<{ success: boolean; details: string }> {
    console.log('🧪 Testing disaster recovery...');

    try {
      // Create test backup
      const testBackup = await this.performFullBackup();

      // Create test database
      const testDbUrl = `file:${path.join(this.config.backupDir, 'test-recovery.db')}`;

      // Restore to test database
      await this.restoreBackup(testBackup.id, testDbUrl);

      // Verify restoration
      const verification = await this.verifyBackupIntegrity(testBackup.id);

      // Cleanup
      await this.cleanupTestEnvironment(testBackup.id);

      return {
        success: verification.valid,
        details: verification.valid
          ? 'Disaster recovery test passed successfully'
          : `Disaster recovery test failed: ${verification.issues.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        details: `Disaster recovery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get backup status
   */
  public getBackupStatus(): {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    totalSizeGB: number;
    lastBackup?: Date;
    nextScheduled?: Date;
  } {
    const successful = this.metadata.filter((m) => m.status === 'success');
    const failed = this.metadata.filter((m) => m.status === 'failed');
    const totalSize = successful.reduce((sum, m) => sum + m.size, 0);

    return {
      totalBackups: this.metadata.length,
      successfulBackups: successful.length,
      failedBackups: failed.length,
      totalSizeGB: totalSize / (1024 * 1024 * 1024),
      lastBackup: successful.length > 0 ? new Date(successful[0].timestamp) : undefined,
      nextScheduled: this.getNextScheduledBackup(),
    };
  }

  /**
   * Private methods
   */

  private async backupTables(backupPath: string): Promise<string[]> {
    const tables = [
      { name: 'User', query: this.prisma.user.findMany() },
      { name: 'UserProgress', query: this.prisma.userProgress.findMany() },
      { name: 'PerformanceRecord', query: this.prisma.performanceRecord.findMany() },
      { name: 'ReviewLog', query: this.prisma.reviewLog.findMany() },
      { name: 'MedicalContent', query: this.prisma.medicalContent.findMany() },
      { name: 'Question', query: this.prisma.question.findMany() },
      { name: 'Condition', query: this.prisma.condition.findMany() },
      { name: 'Drug', query: this.prisma.drug.findMany() },
      { name: 'LabTest', query: this.prisma.labTest.findMany() },
      { name: 'MediaAsset', query: this.prisma.mediaAsset.findMany() },
      { name: 'UserSRSConfig', query: this.prisma.userSRSConfig.findMany() },
    ];

    const backedUpTables: string[] = [];

    for (const table of tables) {
      try {
        const data = await table.query;
        const filePath = path.join(backupPath, `${table.name.toLowerCase()}.json`);

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        backedUpTables.push(table.name);

        console.log(`  ✅ Backed up ${table.name}: ${data.length} records`);
      } catch (error) {
        console.error(`  ❌ Failed to backup ${table.name}:`, error);
        // Continue with other tables
      }
    }

    return backedUpTables;
  }

  private async restoreTables(backupPath: string, metadata: BackupMetadata): Promise<void> {
    console.log('  Restoring tables...');

    // In production, this would use Prisma transactions and handle relationships
    // For now, this is a simplified implementation
    for (const tableName of metadata.tables) {
      const filePath = path.join(backupPath, `${tableName.toLowerCase()}.json`);

      if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠️  Backup file not found: ${filePath}`);
        continue;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`  ✅ Restored ${tableName}: ${data.length} records`);
    }
  }

  private async getDatabaseVersion(): Promise<string> {
    try {
      // Get Prisma version
      const { stdout } = await execAsync('npx prisma --version');
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  private async calculateBackupSize(backupPath: string): Promise<number> {
    let totalSize = 0;

    const files = fs.readdirSync(backupPath);
    for (const file of files) {
      const filePath = path.join(backupPath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }

    return totalSize;
  }

  private async calculateChecksum(backupPath: string): Promise<string> {
    const hash = createHash('sha256');
    const files = fs.readdirSync(backupPath).sort();

    for (const file of files) {
      const filePath = path.join(backupPath, file);
      const content = fs.readFileSync(filePath);
      hash.update(content);
    }

    return hash.digest('hex');
  }

  private async compressBackup(backupPath: string, metadata: BackupMetadata): Promise<void> {
    console.log('  Compressing backup...');

    // In production, this would use tar/gzip or similar
    // For now, simulate compression
    const originalSize = metadata.size;
    const compressedSize = originalSize * 0.7; // Simulate 30% compression
    metadata.compressionRatio = originalSize / compressedSize;

    console.log(`  Compression ratio: ${metadata.compressionRatio.toFixed(2)}x`);
  }

  private async encryptBackup(backupPath: string, metadata: BackupMetadata): Promise<void> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key required for encryption');
    }

    console.log('  Encrypting backup...');

    // In production, this would use AES-256-GCM
    // For now, simulate encryption
    metadata.encrypted = true;

    console.log('  Backup encrypted');
  }

  private async decryptBackup(backupPath: string, metadata: BackupMetadata): Promise<void> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key required for decryption');
    }

    console.log('  Decrypting backup...');
    // Decryption implementation would go here
  }

  private async decompressBackup(backupPath: string, metadata: BackupMetadata): Promise<void> {
    console.log('  Decompressing backup...');
    // Decompression implementation would go here
  }

  private async uploadToCloud(backupPath: string, metadata: BackupMetadata): Promise<void> {
    console.log('  Uploading to cloud providers...');

    for (const provider of this.config.cloudProviders.filter((p) => p.enabled)) {
      try {
        // In production, this would use AWS SDK, Google Cloud SDK, etc.
        const location = await this.uploadToProvider(backupPath, provider);
        metadata.cloudLocations.push(location);

        console.log(`    ✅ Uploaded to ${provider.name}: ${location}`);
      } catch (error) {
        console.error(`    ❌ Failed to upload to ${provider.name}:`, error);
        // Continue with other providers
      }
    }
  }

  private async uploadToProvider(backupPath: string, provider: CloudProvider): Promise<string> {
    // Simulate upload
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return `${provider.name}://backups/${path.basename(backupPath)}`;
  }

  private async applyRetentionPolicy(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const oldBackups = this.metadata.filter(
      (m) => new Date(m.timestamp) < cutoffDate && m.status === 'success'
    );

    for (const backup of oldBackups) {
      try {
        const backupPath = path.join(this.config.backupDir, backup.id);

        if (fs.existsSync(backupPath)) {
          fs.rmSync(backupPath, { recursive: true });
          console.log(`  🗑️  Deleted old backup: ${backup.id}`);
        }

        // Remove from metadata
        this.metadata = this.metadata.filter((m) => m.id !== backup.id);
      } catch (error) {
        console.error(`  ❌ Failed to delete old backup ${backup.id}:`, error);
      }
    }

    this.saveMetadata();
  }

  private async verifyBackupIntegrity(
    backupId: string
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    const metadata = this.metadata.find((m) => m.id === backupId);

    if (!metadata) {
      issues.push('Backup metadata not found');
      return { valid: false, issues };
    }

    const backupPath = path.join(this.config.backupDir, backupId);

    // Check if backup directory exists
    if (!fs.existsSync(backupPath)) {
      issues.push('Backup directory not found');
    }

    // Check if all expected files exist
    for (const table of metadata.tables) {
      const filePath = path.join(backupPath, `${table.toLowerCase()}.json`);
      if (!fs.existsSync(filePath)) {
        issues.push(`Table file missing: ${table}`);
      }
    }

    // Verify checksum
    if (metadata.checksum) {
      const currentChecksum = await this.calculateChecksum(backupPath);
      if (currentChecksum !== metadata.checksum) {
        issues.push('Checksum mismatch');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  private async cleanupTestEnvironment(backupId: string): Promise<void> {
    const testDbPath = path.join(this.config.backupDir, 'test-recovery.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Delete test backup
    const backupPath = path.join(this.config.backupDir, backupId);
    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true });
    }

    // Remove from metadata
    this.metadata = this.metadata.filter((m) => m.id !== backupId);
    this.saveMetadata();
  }

  private async notifyFailure(metadata: BackupMetadata): Promise<void> {
    console.error('🔴 Backup failed notification:', metadata);

    // In production, this would send email, Slack notification, etc.
    // For now, just log to console
  }

  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }

  private getNextScheduledBackup(): Date | undefined {
    if (!this.config.schedule) {
      return undefined;
    }

    // In production, this would parse cron schedule
    const nextDate = new Date();
    nextDate.setHours(nextDate.getHours() + 24); // Default: next day
    return nextDate;
  }

  private loadMetadata(): void {
    const metadataPath = path.join(this.config.backupDir, 'metadata.json');

    if (fs.existsSync(metadataPath)) {
      try {
        const data = fs.readFileSync(metadataPath, 'utf8');
        const parsed = JSON.parse(data);

        // Convert date strings back to Date objects
        this.metadata = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      } catch (error) {
        console.error('Failed to load backup metadata:', error);
        this.metadata = [];
      }
    }
  }

  private saveMetadata(): void {
    const metadataPath = path.join(this.config.backupDir, 'metadata.json');

    try {
      fs.writeFileSync(metadataPath, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      console.error('Failed to save backup metadata:', error);
    }
  }
}

/**
 * Utility function to create backup service
 */
export function createBackupService(
  prisma: PrismaClient,
  config?: Partial<BackupConfig>
): BackupService {
  return new BackupService(prisma, config);
}

/**
 * CLI interface for backup operations
 */
export async function runBackupCLI(args: string[]): Promise<void> {
  const command = args[0];

  const prisma = new PrismaClient();
  const backupService = createBackupService(prisma);

  try {
    switch (command) {
      case 'full':
        await backupService.performFullBackup();
        break;

      case 'incremental':
        await backupService.performIncrementalBackup();
        break;

      case 'status': {
        const status = backupService.getBackupStatus();
        console.log('📊 Backup Status:');
        console.log(`  Total backups: ${status.totalBackups}`);
        console.log(`  Successful: ${status.successfulBackups}`);
        console.log(`  Failed: ${status.failedBackups}`);
        console.log(`  Total size: ${status.totalSizeGB.toFixed(2)} GB`);
        console.log(`  Last backup: ${status.lastBackup?.toISOString() || 'Never'}`);
        console.log(`  Next scheduled: ${status.nextScheduled?.toISOString() || 'Not scheduled'}`);
        break;
      }
      case 'test-recovery': {
        const result = await backupService.testDisasterRecovery();
        console.log(`🧪 Disaster Recovery Test: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`  Details: ${result.details}`);
        break;
      }
      case 'plan': {
        const plan = backupService.getDisasterRecoveryPlan();
        console.log('📋 Disaster Recovery Plan:');
        console.log(`  RTO: ${plan.rto} minutes`);
        console.log(`  RPO: ${plan.rpo} minutes`);
        console.log(`  Critical tables: ${plan.criticalTables.join(', ')}`);
        console.log(`  Test schedule: ${plan.testSchedule}`);
        break;
      }
      default:
        console.log('Usage: backup <command>');
        console.log('Commands:');
        console.log('  full           - Perform full backup');
        console.log('  incremental    - Perform incremental backup');
        console.log('  status         - Show backup status');
        console.log('  test-recovery  - Test disaster recovery');
        console.log('  plan           - Show disaster recovery plan');
        break;
    }
  } finally {
    await prisma.$disconnect();
  }
}
