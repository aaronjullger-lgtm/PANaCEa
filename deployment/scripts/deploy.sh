#!/bin/bash
# PANaCEa Deployment Script
# 
# This script automates the deployment process according to DEPLOYMENT_GUIDE_PHASE_3_5.md
#
# Usage: ./deployment/scripts/deploy.sh [--skip-backup] [--skip-migration] [--skip-workers]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SKIP_BACKUP=false
SKIP_MIGRATION=false
SKIP_WORKERS=false
APP_DIR="/opt/PANaCEa"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --skip-migration)
      SKIP_MIGRATION=true
      shift
      ;;
    --skip-workers)
      SKIP_WORKERS=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}       PANaCEa Deployment Script - Phase 3-5      ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${YELLOW}Warning: Not running as root. Some operations may require sudo.${NC}"
  echo ""
fi

# Step 1: Backup Database
if [ "$SKIP_BACKUP" = false ]; then
  echo -e "${BLUE}[1/6] Backing up database...${NC}"
  BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
  
  if command -v pg_dump &> /dev/null; then
    # Extract database info from DATABASE_URL
    if [ -f .env ]; then
      source .env
      pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
      echo -e "${GREEN}✓ Database backup created: $BACKUP_FILE${NC}"
    else
      echo -e "${RED}✗ .env file not found. Skipping backup.${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ pg_dump not found. Skipping database backup.${NC}"
  fi
  echo ""
else
  echo -e "${YELLOW}[1/6] Skipping database backup (--skip-backup)${NC}"
  echo ""
fi

# Step 2: Install Dependencies
echo -e "${BLUE}[2/6] Installing dependencies...${NC}"
npm ci
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Generate Prisma Client
echo -e "${BLUE}[3/6] Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"
echo ""

# Step 4: Run Database Migration
if [ "$SKIP_MIGRATION" = false ]; then
  echo -e "${BLUE}[4/6] Running database migration...${NC}"
  echo -e "${YELLOW}⚠ This will modify your database schema!${NC}"
  read -p "Continue? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma migrate deploy
    echo -e "${GREEN}✓ Database migration completed${NC}"
  else
    echo -e "${YELLOW}⚠ Migration skipped by user${NC}"
  fi
  echo ""
else
  echo -e "${YELLOW}[4/6] Skipping database migration (--skip-migration)${NC}"
  echo ""
fi

# Step 5: Build Application
echo -e "${BLUE}[5/6] Building application...${NC}"
npm run build
echo -e "${GREEN}✓ Application built${NC}"
echo ""

# Step 6: Start Workers
if [ "$SKIP_WORKERS" = false ]; then
  echo -e "${BLUE}[6/6] Starting workers...${NC}"
  
  # Check if PM2 is installed
  if command -v pm2 &> /dev/null; then
    echo "Starting with PM2..."
    pm2 start ecosystem.config.js --env production
    pm2 save
    echo -e "${GREEN}✓ Workers started with PM2${NC}"
    echo ""
    echo "View logs with: pm2 logs"
    echo "View status with: pm2 status"
  else
    echo -e "${YELLOW}⚠ PM2 not found. Install with: npm install -g pm2${NC}"
    echo "Starting workers manually..."
    
    # Start background worker in detached mode
    nohup npx tsx scripts/backgroundWorker.ts > logs/worker.log 2>&1 &
    echo $! > logs/worker.pid
    
    echo -e "${GREEN}✓ Background worker started (PID: $(cat logs/worker.pid))${NC}"
  fi
  echo ""
else
  echo -e "${YELLOW}[6/6] Skipping worker startup (--skip-workers)${NC}"
  echo ""
fi

# Final summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}     Deployment Complete! 🎉${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "  1. Schedule recurring jobs: crontab -e"
echo "  2. Monitor logs: pm2 logs (or tail -f logs/*.log)"
echo "  3. Run health check: npm run health-check"
echo ""
echo "For rollback instructions, see DEPLOYMENT_GUIDE_PHASE_3_5.md"
