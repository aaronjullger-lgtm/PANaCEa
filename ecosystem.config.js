/**
 * PM2 Ecosystem Configuration for PANaCEa
 * 
 * This file configures PM2 to manage the application processes:
 * - Backend API server
 * - Background job worker
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 * 
 * For production:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'panacea-server',
      script: 'tsx',
      args: 'server.ts',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: 'logs/panacea-server-error.log',
      out_file: 'logs/panacea-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
    },
    {
      name: 'panacea-worker',
      script: 'tsx',
      args: 'scripts/backgroundWorker.ts',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        BACKGROUND_WORKER_ENABLED: 'true',
        JOB_QUEUE_POLL_INTERVAL: '5000',
        MAX_JOB_ATTEMPTS: '3',
      },
      env_production: {
        NODE_ENV: 'production',
        BACKGROUND_WORKER_ENABLED: 'true',
        JOB_QUEUE_POLL_INTERVAL: '5000',
        MAX_JOB_ATTEMPTS: '3',
      },
      error_file: 'logs/panacea-worker-error.log',
      out_file: 'logs/panacea-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
    },
  ],
};
