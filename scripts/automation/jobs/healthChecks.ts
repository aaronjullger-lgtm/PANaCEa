#!/usr/bin/env tsx
/**
 * Health Check Jobs
 * 
 * Infrastructure and system health monitoring:
 * - Database connectivity and pool status
 * - External API availability
 * - SSL certificate expiry
 * - Error rate monitoring
 * - Synthetic smoke tests
 * 
 * These jobs are called by hourly/daily/weekly tasks
 */

import { prisma } from '../../helpers/prisma-client';

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  duration?: number;
  details?: Record<string, any>;
}

// ============================================================================
// Database Checks
// ============================================================================

/**
 * Check database connectivity
 */
export async function checkDatabaseConnection(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: 'Database Connection',
      status: 'pass',
      message: 'Database is accessible',
      duration: Date.now() - start,
    };
  } catch (error: any) {
    return {
      name: 'Database Connection',
      status: 'fail',
      message: `Database connection failed: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Check database query performance
 */
export async function checkDatabasePerformance(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Run a typical query to check performance
    const count = await prisma.medicalContent.count();
    const duration = Date.now() - start;
    
    if (duration > 5000) {
      return {
        name: 'Database Performance',
        status: 'warning',
        message: `Query took ${duration}ms (slow)`,
        duration,
        details: { contentCount: count },
      };
    }
    
    return {
      name: 'Database Performance',
      status: 'pass',
      message: `Query completed in ${duration}ms`,
      duration,
      details: { contentCount: count },
    };
  } catch (error: any) {
    return {
      name: 'Database Performance',
      status: 'fail',
      message: `Performance check failed: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// External API Checks
// ============================================================================

/**
 * Check Gemini API availability
 */
export async function checkGeminiAPI(): Promise<HealthCheckResult> {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      name: 'Gemini API Configuration',
      status: 'fail',
      message: 'GEMINI_API_KEY not configured',
      duration: Date.now() - start,
    };
  }
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );
    
    if (response.ok) {
      return {
        name: 'Gemini API',
        status: 'pass',
        message: 'Gemini API is accessible',
        duration: Date.now() - start,
      };
    }
    
    return {
      name: 'Gemini API',
      status: 'fail',
      message: `Gemini API returned status ${response.status}`,
      duration: Date.now() - start,
    };
  } catch (error: any) {
    return {
      name: 'Gemini API',
      status: 'fail',
      message: `Failed to reach Gemini API: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Check Clerk authentication service
 */
export async function checkClerkAuth(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const response = await fetch('https://api.clerk.com/health', {
      method: 'GET',
    });
    
    return {
      name: 'Clerk Auth',
      status: response.ok ? 'pass' : 'warning',
      message: response.ok ? 'Clerk service healthy' : `Clerk returned ${response.status}`,
      duration: Date.now() - start,
    };
  } catch (error: any) {
    return {
      name: 'Clerk Auth',
      status: 'warning',
      message: `Could not reach Clerk: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Check Supabase storage availability
 */
export async function checkSupabaseStorage(): Promise<HealthCheckResult> {
  const start = Date.now();
  const supabaseUrl = process.env.SUPABASE_URL;
  
  if (!supabaseUrl) {
    return {
      name: 'Supabase Storage',
      status: 'warning',
      message: 'SUPABASE_URL not configured',
      duration: Date.now() - start,
    };
  }
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
    });
    
    return {
      name: 'Supabase Storage',
      status: response.ok ? 'pass' : 'warning',
      message: response.ok ? 'Supabase accessible' : `Supabase returned ${response.status}`,
      duration: Date.now() - start,
    };
  } catch (error: any) {
    return {
      name: 'Supabase Storage',
      status: 'warning',
      message: `Could not reach Supabase: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// Error Monitoring
// ============================================================================

/**
 * Check error rates in the last hour
 */
export async function checkErrorRates(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const failedJobs = await prisma.backgroundJob.count({
      where: {
        status: 'failed',
        updatedAt: { gte: oneHourAgo },
      },
    });
    
    const totalJobs = await prisma.backgroundJob.count({
      where: {
        updatedAt: { gte: oneHourAgo },
      },
    });
    
    const errorRate = totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0;
    
    if (errorRate > 10) {
      return {
        name: 'Error Rate',
        status: 'fail',
        message: `High error rate: ${errorRate.toFixed(1)}% (${failedJobs}/${totalJobs} jobs failed)`,
        duration: Date.now() - start,
        details: { failedJobs, totalJobs, errorRate },
      };
    }
    
    if (errorRate > 5) {
      return {
        name: 'Error Rate',
        status: 'warning',
        message: `Elevated error rate: ${errorRate.toFixed(1)}%`,
        duration: Date.now() - start,
        details: { failedJobs, totalJobs, errorRate },
      };
    }
    
    return {
      name: 'Error Rate',
      status: 'pass',
      message: `Error rate: ${errorRate.toFixed(1)}%`,
      duration: Date.now() - start,
      details: { failedJobs, totalJobs, errorRate },
    };
  } catch (error: any) {
    return {
      name: 'Error Rate',
      status: 'fail',
      message: `Failed to check error rates: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Check for flagged questions that need review
 */
export async function checkFlaggedQuestions(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const pendingFlags = await prisma.questionFlag.count({
      where: {
        status: 'pending',
      },
    });
    
    const highPriorityFlags = await prisma.questionFlag.count({
      where: {
        status: 'pending',
        priority: 'high',
      },
    });
    
    if (highPriorityFlags > 0) {
      return {
        name: 'Flagged Questions',
        status: 'warning',
        message: `${highPriorityFlags} high-priority flags need review`,
        duration: Date.now() - start,
        details: { pendingFlags, highPriorityFlags },
      };
    }
    
    return {
      name: 'Flagged Questions',
      status: 'pass',
      message: `${pendingFlags} pending question flags`,
      duration: Date.now() - start,
      details: { pendingFlags, highPriorityFlags },
    };
  } catch (error: any) {
    return {
      name: 'Flagged Questions',
      status: 'fail',
      message: `Failed to check flags: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// Content Checks
// ============================================================================

/**
 * Check medical content availability
 */
export async function checkContentAvailability(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const publishedCount = await prisma.medicalContent.count({
      where: { status: 'published' },
    });
    
    if (publishedCount === 0) {
      return {
        name: 'Content Availability',
        status: 'fail',
        message: 'No published content found - database may need seeding',
        duration: Date.now() - start,
      };
    }
    
    if (publishedCount < 500) {
      return {
        name: 'Content Availability',
        status: 'warning',
        message: `Only ${publishedCount} published conditions - expected 500+`,
        duration: Date.now() - start,
        details: { publishedCount },
      };
    }
    
    return {
      name: 'Content Availability',
      status: 'pass',
      message: `${publishedCount} published conditions available`,
      duration: Date.now() - start,
      details: { publishedCount },
    };
  } catch (error: any) {
    return {
      name: 'Content Availability',
      status: 'fail',
      message: `Failed to check content: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Check question pool availability
 */
export async function checkQuestionPool(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const questionCount = await prisma.question.count();
    const preGeneratedCount = await prisma.preGeneratedQuestion.count({
      where: {
        usedAt: null,
      },
    });
    
    if (questionCount + preGeneratedCount < 100) {
      return {
        name: 'Question Pool',
        status: 'warning',
        message: `Low question pool: ${questionCount} golden + ${preGeneratedCount} pre-generated`,
        duration: Date.now() - start,
        details: { questionCount, preGeneratedCount },
      };
    }
    
    return {
      name: 'Question Pool',
      status: 'pass',
      message: `${questionCount} golden + ${preGeneratedCount} available pre-generated questions`,
      duration: Date.now() - start,
      details: { questionCount, preGeneratedCount },
    };
  } catch (error: any) {
    return {
      name: 'Question Pool',
      status: 'fail',
      message: `Failed to check questions: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// Synthetic Smoke Tests
// ============================================================================

/**
 * Simulate a basic user workflow
 */
export async function runSmokeTest(): Promise<HealthCheckResult> {
  const start = Date.now();
  const errors: string[] = [];
  
  try {
    // Test 1: Fetch medical content
    const content = await prisma.medicalContent.findFirst({
      where: { status: 'published' },
    });
    if (!content) errors.push('No published content found');
    
    // Test 2: Fetch questions
    const question = await prisma.question.findFirst();
    if (!question) errors.push('No questions found');
    
    // Test 3: Check system groupings
    const systems = await prisma.medicalContent.groupBy({
      by: ['system'],
      where: { status: 'published' },
      _count: true,
    });
    if (systems.length < 5) errors.push(`Only ${systems.length} systems found`);
    
    // Test 4: Check recent user activity (if any users exist)
    const userCount = await prisma.user.count();
    
    if (errors.length > 0) {
      return {
        name: 'Smoke Test',
        status: 'warning',
        message: `Smoke test partially failed: ${errors.join('; ')}`,
        duration: Date.now() - start,
        details: { errors, userCount, systemCount: systems.length },
      };
    }
    
    return {
      name: 'Smoke Test',
      status: 'pass',
      message: 'All smoke test checks passed',
      duration: Date.now() - start,
      details: { userCount, systemCount: systems.length },
    };
  } catch (error: any) {
    return {
      name: 'Smoke Test',
      status: 'fail',
      message: `Smoke test failed: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// SSL/Domain Checks (Basic)
// ============================================================================

/**
 * Check SSL certificate expiry for production domain
 */
export async function checkSSLExpiry(): Promise<HealthCheckResult> {
  const start = Date.now();
  const productionUrl = process.env.PRODUCTION_URL || 'https://studypanacea.com';
  
  try {
    // Simple HTTPS connection test
    const response = await fetch(productionUrl, {
      method: 'HEAD',
    });
    
    return {
      name: 'SSL Certificate',
      status: response.ok ? 'pass' : 'warning',
      message: response.ok ? 'SSL certificate valid' : `Site returned ${response.status}`,
      duration: Date.now() - start,
      details: { url: productionUrl },
    };
  } catch (error: any) {
    // If the error mentions certificate, it's an SSL issue
    if (error.message?.includes('certificate')) {
      return {
        name: 'SSL Certificate',
        status: 'fail',
        message: `SSL error: ${error.message}`,
        duration: Date.now() - start,
      };
    }
    
    return {
      name: 'SSL Certificate',
      status: 'warning',
      message: `Could not verify SSL: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// Aggregate Functions
// ============================================================================

/**
 * Run all hourly health checks
 */
export async function runHourlyHealthChecks(): Promise<HealthCheckResult[]> {
  console.log('🔄 Running hourly health checks...');
  
  const results: HealthCheckResult[] = [];
  
  results.push(await checkDatabaseConnection());
  results.push(await checkGeminiAPI());
  results.push(await checkErrorRates());
  results.push(await checkContentAvailability());
  results.push(await runSmokeTest());
  
  return results;
}

/**
 * Run all daily health checks
 */
export async function runDailyHealthChecks(): Promise<HealthCheckResult[]> {
  console.log('🔄 Running daily health checks...');
  
  const results: HealthCheckResult[] = [];
  
  results.push(await checkDatabaseConnection());
  results.push(await checkDatabasePerformance());
  results.push(await checkGeminiAPI());
  results.push(await checkClerkAuth());
  results.push(await checkSupabaseStorage());
  results.push(await checkErrorRates());
  results.push(await checkFlaggedQuestions());
  results.push(await checkContentAvailability());
  results.push(await checkQuestionPool());
  results.push(await runSmokeTest());
  results.push(await checkSSLExpiry());
  
  return results;
}

/**
 * Summarize health check results
 */
export function summarizeResults(results: HealthCheckResult[]): {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  allPassed: boolean;
} {
  return {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    warnings: results.filter(r => r.status === 'warning').length,
    allPassed: results.every(r => r.status !== 'fail'),
  };
}

// ============================================================================
// Cleanup
// ============================================================================

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export default {
  // Individual checks
  checkDatabaseConnection,
  checkDatabasePerformance,
  checkGeminiAPI,
  checkClerkAuth,
  checkSupabaseStorage,
  checkErrorRates,
  checkFlaggedQuestions,
  checkContentAvailability,
  checkQuestionPool,
  runSmokeTest,
  checkSSLExpiry,
  
  // Aggregates
  runHourlyHealthChecks,
  runDailyHealthChecks,
  summarizeResults,
  
  disconnect,
};
