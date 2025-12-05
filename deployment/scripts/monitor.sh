#!/bin/bash
# PANaCEa Monitoring Script
# 
# This script monitors the health and status of PANaCEa services
#
# Usage: ./deployment/scripts/monitor.sh [--watch]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

WATCH_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --watch)
      WATCH_MODE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Function to display status
show_status() {
  clear
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}          PANaCEa System Monitor                 ${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

  # Check PM2 status
  echo -e "${BLUE}[1] PM2 Process Status${NC}"
  if command -v pm2 &> /dev/null; then
    pm2 list
  else
    echo -e "${YELLOW}⚠ PM2 not installed${NC}"
    
    # Check for manual processes
    if [ -f logs/worker.pid ]; then
      PID=$(cat logs/worker.pid)
      if ps -p $PID > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Background worker running (PID: $PID)${NC}"
      else
        echo -e "${RED}✗ Background worker not running${NC}"
      fi
    fi
  fi
  echo ""

  # Database connectivity
  echo -e "${BLUE}[2] Database Connectivity${NC}"
  if [ -f .env ]; then
    if npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.\$connect().then(() => { console.log('✓ Database connected'); process.exit(0); }).catch(e => { console.log('✗ Database connection failed:', e.message); process.exit(1); });" 2>&1 | grep -q "✓"; then
      echo -e "${GREEN}✓ Database connection successful${NC}"
    else
      echo -e "${RED}✗ Database connection failed${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ .env file not found${NC}"
  fi
  echo ""

  # Job Queue Statistics
  echo -e "${BLUE}[3] Job Queue Statistics${NC}"
  if command -v npx &> /dev/null; then
    npx tsx deployment/scripts/job-stats.ts 2>/dev/null || echo -e "${YELLOW}⚠ Unable to fetch job statistics${NC}"
  else
    echo -e "${YELLOW}⚠ tsx not available${NC}"
  fi
  echo ""

  # Recent Logs
  echo -e "${BLUE}[4] Recent Error Logs (Last 5)${NC}"
  if [ -d logs ]; then
    for logfile in logs/*-error.log; do
      if [ -f "$logfile" ]; then
        echo -e "${YELLOW}$(basename $logfile):${NC}"
        tail -5 "$logfile" 2>/dev/null | sed 's/^/  /'
      fi
    done
  else
    echo -e "${YELLOW}⚠ No log directory found${NC}"
  fi
  echo ""

  # System Resources
  echo -e "${BLUE}[5] System Resources${NC}"
  echo -e "Memory Usage:"
  free -h | grep -E "Mem:|Swap:" | sed 's/^/  /'
  echo ""
  echo -e "Disk Usage (Current Directory):"
  df -h . | tail -1 | sed 's/^/  /'
  echo ""

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  if [ "$WATCH_MODE" = true ]; then
    echo -e "${YELLOW}Refreshing in 5 seconds... (Ctrl+C to exit)${NC}"
  fi
}

# Main execution
if [ "$WATCH_MODE" = true ]; then
  while true; do
    show_status
    sleep 5
  done
else
  show_status
  echo ""
  echo "Tip: Use --watch flag for continuous monitoring"
fi
