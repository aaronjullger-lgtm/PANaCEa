/**
 * Database Configuration for StudyPANaCEa
 *
 * Centralized configuration for database connections, connection pooling,
 * and performance optimization across different environments.
 */

import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

/**
 * Database Configuration Interface
 */
export interface DatabaseConfig {
  connectionString: string;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  ssl: boolean;
  logQueries: boolean;
  useAccelerate: boolean;
}

/**
 * Environment-specific configurations
 */
export const DATABASE_CONFIGS: Record<string, DatabaseConfig> = {
  development: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/panceai_dev',
    maxConnections: 10,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 5000,
    ssl: false,
    logQueries: true,
    useAccelerate: false,
  },
  staging: {
    connectionString: process.env.DATABASE_URL || '',
    maxConnections: 20,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 5000,
    ssl: true,
    logQueries: true,
    useAccelerate: true,
  },
  production: {
    connectionString: process.env.DATABASE_URL || '',
    maxConnections: 50,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 5000,
    ssl: true,
    logQueries: false,
    useAccelerate: true,
  },
};

/**
 * Get current environment configuration
 */
export function getDatabaseConfig(): DatabaseConfig {
  const env = process.env.NODE_ENV || 'development';
  const config = DATABASE_CONFIGS[env] || DATABASE_CONFIGS.development;

  if (!config.connectionString) {
    throw new Error(`Database connection string not configured for ${env} environment`);
  }

  return config;
}

/**
 * Create connection pool for direct PostgreSQL access
 * Used for complex queries, migrations, and batch operations
 */
export function createConnectionPool(): Pool {
  const config = getDatabaseConfig();

  return new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections,
    idleTimeoutMillis: config.idleTimeoutMs,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  });
}

/**
 * Create Prisma Client with optimized configuration
 */
export function createPrismaClient(): PrismaClient {
  const config = getDatabaseConfig();

  // For Cloudflare Edge environments, use Accelerate
  if (config.useAccelerate) {
    const client = new PrismaClient({
      accelerateUrl: config.connectionString,
    });
    return client.$extends(withAccelerate());
  }

  // For Node.js environments, use direct connection with connection pooling
  const client = new PrismaClient({
    datasources: {
      db: {
        url: config.connectionString,
      },
    },
    log: config.logQueries ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  });

  // Add connection pool monitoring
  client.$on('beforeExit', async () => {
    await client.$disconnect();
  });

  return client;
}

/**
 * Execute query with connection pool
 * Use for complex queries that benefit from direct SQL
 */
export async function executeQuery<T>(query: string, params: any[] = []): Promise<T[]> {
  const pool = createConnectionPool();
  const client = await pool.connect();

  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Database health check
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTimeMs: number;
  connectionCount: number;
}> {
  const startTime = Date.now();
  const config = getDatabaseConfig();

  try {
    const pool = createConnectionPool();
    const client = await pool.connect();

    try {
      // Simple query to test connection
      await client.query('SELECT 1');

      // Get connection stats
      const stats = await client.query(`
        SELECT
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database();
      `);

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTimeMs: responseTime,
        connectionCount: stats.rows[0].total_connections,
      };
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTimeMs: responseTime,
      connectionCount: 0,
    };
  }
}

/**
 * Database migration helper
 * Ensures proper connection handling during migrations
 */
export async function runMigration(migrationFn: (client: PrismaClient) => Promise<void>) {
  const client = createPrismaClient();

  try {
    await migrationFn(client);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.$disconnect();
  }
}
