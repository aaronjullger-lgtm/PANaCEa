#!/bin/bash
# Initialize Prisma Migrations
# 
# This script helps set up the initial migration for the PANaCEa database
#
# Usage: ./deployment/scripts/init-migrations.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}    PANaCEa Migration Initialization            ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
  echo -e "${RED}✗ .env file not found${NC}"
  echo ""
  echo "Please create .env file from .env.example:"
  echo "  cp .env.example .env"
  echo ""
  echo "Then configure your DATABASE_URL in .env"
  exit 1
fi

# Source .env
source .env

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}✗ DATABASE_URL not set in .env${NC}"
  echo ""
  echo "Please set DATABASE_URL in your .env file:"
  echo '  DATABASE_URL="postgresql://user:pass@host:5432/dbname"'
  exit 1
fi

echo -e "${GREEN}✓${NC} .env file found"
echo -e "${GREEN}✓${NC} DATABASE_URL configured"
echo ""

# Check if migrations directory exists
if [ -d "prisma/migrations" ]; then
  echo -e "${YELLOW}⚠ Migrations directory already exists${NC}"
  echo ""
  echo "Existing migrations found. Options:"
  echo "  1. Apply existing migrations: npx prisma migrate deploy"
  echo "  2. Create new migration: npx prisma migrate dev --name description"
  echo "  3. Reset (DEV ONLY): npx prisma migrate reset"
  echo ""
  read -p "Do you want to apply existing migrations? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Applying existing migrations...${NC}"
    npx prisma migrate deploy
    echo -e "${GREEN}✓ Migrations applied${NC}"
  fi
  exit 0
fi

# Generate Prisma Client first
echo -e "${BLUE}[1/3] Generating Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma Client generated${NC}"
echo ""

# Check if database exists and is accessible
echo -e "${BLUE}[2/3] Testing database connection...${NC}"
if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Database connection successful${NC}"
else
  echo -e "${RED}✗ Cannot connect to database${NC}"
  echo ""
  echo "Please ensure:"
  echo "  1. PostgreSQL is running"
  echo "  2. Database exists"
  echo "  3. Credentials in DATABASE_URL are correct"
  exit 1
fi
echo ""

# Create initial migration
echo -e "${BLUE}[3/3] Creating initial migration...${NC}"
echo ""
echo -e "${YELLOW}This will create the initial database schema based on prisma/schema.prisma${NC}"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Create migration
npx prisma migrate dev --name phase_3_5_features

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}    Migration Initialization Complete! 🎉       ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Migration created in: prisma/migrations/"
echo ""
echo "Next steps:"
echo "  1. Review migration: cat prisma/migrations/*/migration.sql"
echo "  2. For production: npx prisma migrate deploy"
echo "  3. Check status: npx prisma migrate status"
echo ""
echo "See deployment/MIGRATION_GUIDE.md for more information"
