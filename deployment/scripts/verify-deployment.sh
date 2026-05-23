#!/bin/bash
# PANaCEa Deployment Verification Script (LEGACY — Express/PM2 server model)
#
# ⚠️ This script validates a pre-Cloudflare Express + PM2 server deployment.
# It does NOT apply to the current Cloudflare Pages production deployment.
# For Cloudflare Pages verification, see deployment/DEPLOYMENT_CHECKLIST.md
# or run: npm run pages:serve && BASE_URL=http://localhost:8788 npm run verify:health
#
# Usage: ./deployment/scripts/verify-deployment.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}    PANaCEa Deployment Verification              ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Helper function to check command
check_command() {
  if command -v $1 &> /dev/null; then
    echo -e "${GREEN}✓${NC} $2"
    ((PASS++))
    return 0
  else
    echo -e "${RED}✗${NC} $2 (missing)"
    ((FAIL++))
    return 1
  fi
}

# Helper function to check file
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $2"
    ((PASS++))
    return 0
  else
    echo -e "${RED}✗${NC} $2 (not found)"
    ((FAIL++))
    return 1
  fi
}

# Helper function to check directory
check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $2"
    ((PASS++))
    return 0
  else
    echo -e "${YELLOW}⚠${NC} $2 (not found)"
    ((WARN++))
    return 1
  fi
}

# Check 1: Prerequisites
echo -e "${BLUE}[1] Prerequisites${NC}"
check_command "node" "Node.js installed"
check_command "npm" "npm installed"
check_command "npx" "npx available"
echo ""

# Check 2: Application Files
echo -e "${BLUE}[2] Application Files${NC}"
check_file "package.json" "package.json exists"
check_file "server.ts" "Backend server file"
check_file "prisma/schema.prisma" "Prisma schema"
check_file "ecosystem.config.js" "PM2 configuration"
check_file ".env" "Environment file (.env)"
echo ""

# Check 3: Worker Scripts
echo -e "${BLUE}[3] Worker Scripts${NC}"
check_file "scripts/backgroundWorker.ts" "Background worker script"
check_file "scripts/scheduleJobs.ts" "Job scheduler script"
check_file "scripts/contentHealthChecker.ts" "Health checker script"
check_file "scripts/cleanupJobs.ts" "Cleanup script"
echo ""

# Check 4: Deployment Configuration
echo -e "${BLUE}[4] Deployment Configuration${NC}"
check_file "deployment/systemd/panacea-server.service" "Systemd server service"
check_file "deployment/systemd/panacea-worker.service" "Systemd worker service"
check_file "deployment/cron/panacea.cron" "Cron configuration"
check_file "deployment/scripts/deploy.sh" "Deploy script"
check_file "deployment/scripts/monitor.sh" "Monitor script"
echo ""

# Check 5: Dependencies
echo -e "${BLUE}[5] Dependencies${NC}"
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✓${NC} node_modules directory exists"
  ((PASS++))
  
  # Check key dependencies
  if [ -d "node_modules/@prisma/client" ]; then
    echo -e "${GREEN}✓${NC} Prisma client installed"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} Prisma client missing (run: npx prisma generate)"
    ((FAIL++))
  fi
else
  echo -e "${RED}✗${NC} node_modules missing (run: npm install)"
  ((FAIL++))
fi
echo ""

# Check 6: Database Connection
echo -e "${BLUE}[6] Database Connectivity${NC}"
if [ -f ".env" ]; then
  source .env
  if [ -n "$DATABASE_URL" ]; then
    echo -e "${GREEN}✓${NC} DATABASE_URL configured"
    ((PASS++))
    
    # Test connection (optional, requires tsx)
    if command -v npx &> /dev/null; then
      if npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.\$connect().then(() => { console.log('success'); process.exit(0); }).catch(() => { process.exit(1); });" 2>&1 | grep -q "success"; then
        echo -e "${GREEN}✓${NC} Database connection successful"
        ((PASS++))
      else
        echo -e "${YELLOW}⚠${NC} Database connection failed"
        ((WARN++))
      fi
    fi
  else
    echo -e "${RED}✗${NC} DATABASE_URL not set in .env"
    ((FAIL++))
  fi
else
  echo -e "${RED}✗${NC} .env file not found"
  ((FAIL++))
fi
echo ""

# Check 7: Process Management
echo -e "${BLUE}[7] Process Management${NC}"
if command -v pm2 &> /dev/null; then
  echo -e "${GREEN}✓${NC} PM2 installed"
  ((PASS++))
  
  # Check if processes are running
  if pm2 list 2>/dev/null | grep -q "panacea-server"; then
    echo -e "${GREEN}✓${NC} Server process running"
    ((PASS++))
  else
    echo -e "${YELLOW}⚠${NC} Server process not running"
    ((WARN++))
  fi
  
  if pm2 list 2>/dev/null | grep -q "panacea-worker"; then
    echo -e "${GREEN}✓${NC} Worker process running"
    ((PASS++))
  else
    echo -e "${YELLOW}⚠${NC} Worker process not running"
    ((WARN++))
  fi
else
  echo -e "${YELLOW}⚠${NC} PM2 not installed (optional)"
  ((WARN++))
fi
echo ""

# Check 8: Logs Directory
echo -e "${BLUE}[8] Logging${NC}"
check_dir "logs" "Logs directory exists"

if [ -d "logs" ]; then
  # Check if logs are writable
  if [ -w "logs" ]; then
    echo -e "${GREEN}✓${NC} Logs directory is writable"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} Logs directory is not writable"
    ((FAIL++))
  fi
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}    Verification Summary                         ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Passed:  ${PASS}${NC}"
echo -e "${YELLOW}Warnings: ${WARN}${NC}"
echo -e "${RED}Failed:   ${FAIL}${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  if [ $WARN -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Deployment is ready.${NC}"
    exit 0
  else
    echo -e "${YELLOW}⚠ Some warnings detected. Review before proceeding.${NC}"
    exit 0
  fi
else
  echo -e "${RED}✗ Some checks failed. Fix errors before deploying.${NC}"
  exit 1
fi
