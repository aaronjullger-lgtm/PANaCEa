# Database Migration Guide

This guide explains how to set up and run database migrations for PANaCEa.

## Prerequisites

Before running migrations:

1. **PostgreSQL 12+ installed and running**
2. **Database created**
3. **DATABASE_URL configured in .env**

## Initial Setup

### 1. Create Database

```bash
# Using psql
createdb panacea_production

# Or connect and create
psql -U postgres
CREATE DATABASE panacea_production;
\q
```

### 2. Configure Environment

Create `.env` file from template:

```bash
cp .env.example .env
```

Edit `.env` and set your DATABASE_URL:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/panacea_production?schema=public"
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

## Running Migrations

### Development Environment

Use `migrate dev` to create and apply migrations:

```bash
# Create migration with auto-generated name
npx prisma migrate dev

# Create migration with custom name
npx prisma migrate dev --name phase_3_5_features
```

This will:
1. Create a new migration file in `prisma/migrations/`
2. Apply the migration to your development database
3. Regenerate Prisma Client

### Production Environment

Use `migrate deploy` to apply existing migrations:

```bash
# Apply all pending migrations
npx prisma migrate deploy
```

**Important:** Never use `migrate dev` in production! It can:
- Reset your database
- Cause data loss
- Create destructive migrations

### Migration Status

Check which migrations have been applied:

```bash
npx prisma migrate status
```

Output example:
```
Database schema is up to date!

The following migrations are applied:

20241205000000_phase_3_5_features
```

## Migration Files

Migrations are stored in `prisma/migrations/`:

```
prisma/
└── migrations/
    ├── 20241205000000_phase_3_5_features/
    │   └── migration.sql
    ├── 20241206000000_add_indexes/
    │   └── migration.sql
    └── migration_lock.toml
```

Each migration folder contains:
- `migration.sql` - The SQL commands to run
- Timestamp and descriptive name

## Creating Your First Migration

If this is a fresh setup without existing migrations:

```bash
# 1. Ensure DATABASE_URL is set
echo $DATABASE_URL

# 2. Create initial migration
npx prisma migrate dev --name init

# 3. Verify schema matches
npx prisma db pull  # Check what's in database
npx prisma migrate status  # Check migration status
```

## Common Migration Scenarios

### Adding New Models

1. Update `prisma/schema.prisma`
2. Create and apply migration:
   ```bash
   npx prisma migrate dev --name add_new_model
   ```

### Modifying Existing Models

1. Update schema
2. Create migration:
   ```bash
   npx prisma migrate dev --name modify_user_model
   ```
3. Review generated SQL before applying

### Data Migration

For migrations that require data transformation:

1. Create empty migration:
   ```bash
   npx prisma migrate dev --create-only --name custom_data_migration
   ```

2. Edit `migration.sql` to add data transformation logic:
   ```sql
   -- Auto-generated schema changes
   ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
   
   -- Custom data migration
   UPDATE "User" SET "role" = 'admin' WHERE "email" LIKE '%@admin.com';
   ```

3. Apply the migration:
   ```bash
   npx prisma migrate deploy
   ```

## Rollback Procedure

Prisma doesn't have built-in rollback. To rollback:

### Method 1: Database Restore

```bash
# Restore from backup
psql -U username -d panacea_production < backup_20241205.sql
```

### Method 2: Manual Rollback

1. Identify migration to rollback in `prisma/migrations/`
2. Create reverse migration manually
3. Apply reverse migration

### Method 3: Reset (Development Only)

```bash
# WARNING: This deletes all data!
npx prisma migrate reset
```

## Migration Best Practices

### Before Migration

- [ ] **Backup database** (production)
- [ ] **Test migration** in staging environment
- [ ] **Review generated SQL** for correctness
- [ ] **Plan rollback strategy**
- [ ] **Schedule maintenance window** (if needed)

### During Migration

- [ ] **Monitor progress** and logs
- [ ] **Have rollback ready**
- [ ] **Keep team informed**

### After Migration

- [ ] **Verify data integrity**
- [ ] **Test application** thoroughly
- [ ] **Monitor for errors**
- [ ] **Update documentation**

## Troubleshooting

### Error: "DATABASE_URL not found"

```bash
# Check if .env exists
ls -la .env

# Verify DATABASE_URL is set
cat .env | grep DATABASE_URL

# Source .env (if needed)
export $(cat .env | xargs)
```

### Error: "Migration failed"

```bash
# Check migration status
npx prisma migrate status

# View detailed error
npx prisma migrate resolve --rolled-back 20241205000000_migration_name

# Mark as applied (if manually fixed)
npx prisma migrate resolve --applied 20241205000000_migration_name
```

### Error: "Schema drift detected"

This means your database schema differs from your Prisma schema.

```bash
# See differences
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma

# Reset to match Prisma schema (dev only!)
npx prisma migrate reset

# Or create migration to fix drift
npx prisma migrate dev --name fix_schema_drift
```

### Error: "Connection timeout"

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection manually
psql "$DATABASE_URL"

# Check firewall/network
telnet your-db-host 5432
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      
      - name: Deploy application
        run: npm run deploy
```

## Multiple Environments

### Development
```env
DATABASE_URL="postgresql://dev:dev@localhost:5432/panacea_dev"
```

### Staging
```env
DATABASE_URL="postgresql://stage:stage@staging.example.com:5432/panacea_staging"
```

### Production
```env
DATABASE_URL="postgresql://prod:prod@prod.example.com:5432/panacea_prod"
```

Use separate databases for each environment and test migrations in order: dev → staging → production.

## Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Database Schema](../prisma/schema.prisma)

## Support

For migration issues:

1. Check Prisma logs: `npx prisma migrate status`
2. Review migration SQL files
3. Consult this guide's troubleshooting section
4. Check GitHub issues
5. Contact development team
