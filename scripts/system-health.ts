#!/usr/bin/env tsx
/**
 * System Health & Monitoring Check Script
 *
 * Run locally to verify system health before deployment.
 * Checks: build, database, environment, and optionally remote health endpoint.
 *
 * Usage:
 *   npm run system:health              # Local checks only
 *   npm run system:health -- --remote  # Include remote API check
 *   npm run system:health -- --verbose # Detailed output
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  latency?: number;
  details?: any;
}

interface HealthReport {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: CheckResult[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
}

const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');
const checkRemote = process.argv.includes('--remote') || process.argv.includes('-r');

function log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
  const colors = {
    info: '\x1b[36m', // cyan
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
    success: '\x1b[32m', // green
    reset: '\x1b[0m',
  };

  const prefix = {
    info: 'ℹ',
    warn: '⚠',
    error: '✗',
    success: '✓',
  };

  console.log(`${colors[level]}${prefix[level]} ${message}${colors.reset}`);
}

function logVerbose(message: string): void {
  if (isVerbose) {
    console.log(`  ${message}`);
  }
}

/**
 * Check if required environment variables are set
 */
async function checkEnvironment(): Promise<CheckResult> {
  const startTime = Date.now();

  const required = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'GEMINI_API_KEY',
    'VITE_CLERK_PUBLISHABLE_KEY',
  ];

  const recommended = ['VITE_SENTRY_DSN', 'CLERK_WEBHOOK_SECRET'];

  // Check for .env file
  const envPath = path.join(process.cwd(), '.env');
  const envExists = fs.existsSync(envPath);

  if (!envExists) {
    return {
      name: 'Environment Variables',
      status: 'fail',
      message: '.env file not found - copy from .env.example',
      latency: Date.now() - startTime,
    };
  }

  // Read and parse .env file
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars: Record<string, string> = {};

  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  });

  const missing = required.filter((key) => !envVars[key] || envVars[key].includes('xxxxx'));
  const missingRecommended = recommended.filter(
    (key) => !envVars[key] || envVars[key].includes('xxxxx')
  );

  const latency = Date.now() - startTime;

  if (missing.length > 0) {
    return {
      name: 'Environment Variables',
      status: 'fail',
      message: `Missing required: ${missing.join(', ')}`,
      latency,
      details: { missing, missingRecommended },
    };
  }

  if (missingRecommended.length > 0) {
    return {
      name: 'Environment Variables',
      status: 'warn',
      message: `Optional not configured: ${missingRecommended.join(', ')}`,
      latency,
      details: { missingRecommended },
    };
  }

  return {
    name: 'Environment Variables',
    status: 'pass',
    message: 'All environment variables configured',
    latency,
  };
}

/**
 * Check TypeScript build
 */
async function checkBuild(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    logVerbose('Running TypeScript check...');
    await execAsync('npx tsc --noEmit', { timeout: 60000 });

    return {
      name: 'TypeScript Build',
      status: 'pass',
      message: 'No TypeScript errors',
      latency: Date.now() - startTime,
    };
  } catch (error: any) {
    const errorOutput = error.stdout || error.stderr || error.message;
    const errorCount = (errorOutput.match(/error TS/g) || []).length;

    return {
      name: 'TypeScript Build',
      status: errorCount > 5 ? 'fail' : 'warn',
      message: `${errorCount} TypeScript error(s)`,
      latency: Date.now() - startTime,
      details: isVerbose ? errorOutput.substring(0, 1000) : undefined,
    };
  }
}

/**
 * Check Prisma client generation
 */
async function checkPrisma(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    logVerbose('Checking Prisma client...');

    // Check if Prisma client exists
    const prismaPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client');
    if (!fs.existsSync(prismaPath)) {
      return {
        name: 'Prisma Client',
        status: 'warn',
        message: 'Prisma client not generated - run npm run db:generate',
        latency: Date.now() - startTime,
      };
    }

    // Verify Prisma can validate schema
    await execAsync('npx prisma validate', { timeout: 30000 });

    return {
      name: 'Prisma Client',
      status: 'pass',
      message: 'Prisma schema valid and client generated',
      latency: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      name: 'Prisma Client',
      status: 'fail',
      message: `Prisma error: ${error.message}`,
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Check package dependencies
 */
async function checkDependencies(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    logVerbose('Checking dependencies...');

    const { stdout } = await execAsync('npm audit --json 2>/dev/null || echo "{}"', {
      timeout: 30000,
    });
    const audit = JSON.parse(stdout || '{}');

    const vulns = audit.metadata?.vulnerabilities || {};
    const high = (vulns.high || 0) + (vulns.critical || 0);
    const moderate = vulns.moderate || 0;

    if (high > 0) {
      return {
        name: 'Dependencies',
        status: 'fail',
        message: `${high} high/critical vulnerabilities`,
        latency: Date.now() - startTime,
        details: { vulnerabilities: vulns },
      };
    }

    if (moderate > 0) {
      return {
        name: 'Dependencies',
        status: 'warn',
        message: `${moderate} moderate vulnerabilities`,
        latency: Date.now() - startTime,
        details: { vulnerabilities: vulns },
      };
    }

    return {
      name: 'Dependencies',
      status: 'pass',
      message: 'No known vulnerabilities',
      latency: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      name: 'Dependencies',
      status: 'warn',
      message: 'Could not check vulnerabilities',
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Check Sentry configuration
 */
async function checkSentry(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    // Check for Sentry package
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const hasSentryReact = packageJson.dependencies?.['@sentry/react'];
    const hasSentryPlugin =
      packageJson.dependencies?.['@sentry/vite-plugin'] ||
      packageJson.devDependencies?.['@sentry/vite-plugin'];

    if (!hasSentryReact) {
      return {
        name: 'Sentry SDK',
        status: 'fail',
        message: '@sentry/react not installed',
        latency: Date.now() - startTime,
      };
    }

    // Check for Sentry configuration file
    const sentryConfigPath = path.join(process.cwd(), 'lib', 'monitoring', 'sentry.ts');
    if (!fs.existsSync(sentryConfigPath)) {
      return {
        name: 'Sentry SDK',
        status: 'warn',
        message: 'Sentry config file not found',
        latency: Date.now() - startTime,
      };
    }

    // Check for DSN in environment
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    const hasDsn =
      envContent.includes('VITE_SENTRY_DSN=') &&
      !envContent.includes('VITE_SENTRY_DSN=https://[key]');

    if (!hasDsn) {
      return {
        name: 'Sentry SDK',
        status: 'warn',
        message: 'Sentry DSN not configured (error tracking disabled)',
        latency: Date.now() - startTime,
      };
    }

    return {
      name: 'Sentry SDK',
      status: 'pass',
      message: `Sentry configured (v${hasSentryReact})`,
      latency: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      name: 'Sentry SDK',
      status: 'warn',
      message: `Could not verify Sentry: ${error.message}`,
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Check remote health endpoint (optional)
 */
async function checkRemoteHealth(): Promise<CheckResult | null> {
  if (!checkRemote) return null;

  const startTime = Date.now();

  // Get URL from environment or use default
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

  let appUrl = 'http://localhost:3000';
  const match = envContent.match(/VITE_APP_URL=(.+)/);
  if (match) {
    appUrl = match[1].trim();
  }

  const healthUrl = `${appUrl}/api/health?ping=true`;

  try {
    logVerbose(`Checking remote health: ${healthUrl}`);

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        name: 'Remote Health',
        status: 'fail',
        message: `Health check returned ${response.status}`,
        latency,
      };
    }

    const data = await response.json();

    if (data.status === 'ok' || data.status === 'healthy') {
      return {
        name: 'Remote Health',
        status: 'pass',
        message: `API healthy (${latency}ms)`,
        latency,
      };
    }

    return {
      name: 'Remote Health',
      status: data.status === 'degraded' ? 'warn' : 'fail',
      message: `API ${data.status}`,
      latency,
      details: data,
    };
  } catch (error: any) {
    return {
      name: 'Remote Health',
      status: 'warn',
      message: `Could not reach ${healthUrl}: ${error.message}`,
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Run all health checks
 */
async function runHealthChecks(): Promise<HealthReport> {
  console.log('\n🔍 Running System Health Checks...\n');

  const checks: CheckResult[] = [];

  // Run checks in parallel where possible
  const [envResult, prismaResult, sentryResult, depsResult] = await Promise.all([
    checkEnvironment(),
    checkPrisma(),
    checkSentry(),
    checkDependencies(),
  ]);

  checks.push(envResult);
  checks.push(prismaResult);
  checks.push(sentryResult);
  checks.push(depsResult);

  // TypeScript check is slower, run separately
  const buildResult = await checkBuild();
  checks.push(buildResult);

  // Remote health check (optional)
  const remoteResult = await checkRemoteHealth();
  if (remoteResult) {
    checks.push(remoteResult);
  }

  // Calculate summary
  const summary = {
    passed: checks.filter((c) => c.status === 'pass').length,
    warnings: checks.filter((c) => c.status === 'warn').length,
    failed: checks.filter((c) => c.status === 'fail').length,
  };

  const status = summary.failed > 0 ? 'unhealthy' : summary.warnings > 0 ? 'degraded' : 'healthy';

  return {
    timestamp: new Date().toISOString(),
    status,
    checks,
    summary,
  };
}

/**
 * Print health report
 */
function printReport(report: HealthReport): void {
  console.log('─'.repeat(60));

  for (const check of report.checks) {
    const statusIcon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    const statusColor =
      check.status === 'pass' ? '\x1b[32m' : check.status === 'warn' ? '\x1b[33m' : '\x1b[31m';
    const latencyStr = check.latency ? ` (${check.latency}ms)` : '';

    console.log(`${statusColor}${statusIcon}\x1b[0m ${check.name}: ${check.message}${latencyStr}`);

    if (isVerbose && check.details) {
      console.log(`  Details: ${JSON.stringify(check.details, null, 2).substring(0, 500)}`);
    }
  }

  console.log('─'.repeat(60));

  const statusIcon =
    report.status === 'healthy' ? '✅' : report.status === 'degraded' ? '⚠️' : '❌';
  console.log(`\n${statusIcon} Overall Status: ${report.status.toUpperCase()}`);
  console.log(
    `   Passed: ${report.summary.passed} | Warnings: ${report.summary.warnings} | Failed: ${report.summary.failed}`
  );
  console.log(`   Timestamp: ${report.timestamp}\n`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const report = await runHealthChecks();
    printReport(report);

    // Exit with error code if unhealthy
    if (report.status === 'unhealthy') {
      process.exit(1);
    }
  } catch (error) {
    console.error('\x1b[31m✗ Health check failed:\x1b[0m', error);
    process.exit(1);
  }
}

main();
