-- PANaCEa Database Initialization Script
-- This runs when PostgreSQL container starts for the first time

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search

-- Create a read-only user for analytics (optional security layer)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'panacea_readonly') THEN
--     CREATE ROLE panacea_readonly WITH LOGIN PASSWORD 'readonly_dev';
--   END IF;
-- END
-- $$;

-- Grant connect permission
-- GRANT CONNECT ON DATABASE panacea_dev TO panacea_readonly;

-- Note: Actual table schemas are managed by Prisma migrations
-- Run `npm run db:migrate:dev` after the container is up

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'PANaCEa database initialized successfully!';
  RAISE NOTICE 'Next step: Run npm run db:migrate:dev to apply Prisma migrations';
END
$$;
