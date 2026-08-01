#!/bin/bash
# PANaCEa System Health Check (Cloud Shell)
# Runs comprehensive health checks on the system.
#
# Usage:
#   bash scripts/cloud-shell/health-check.sh

set -euo pipefail

cd "$(dirname "$0")/../.."

echo "=== PANaCEa System Health Check ==="
echo "Started: $(date)"
echo ""

# Type check (critical paths only)
echo "--- Type Check (critical paths) ---"
npm run typecheck:ci 2>&1 | tail -5 || echo "⚠ Type check had issues"

echo ""

# Critical tests
echo "--- Critical Tests ---"
npm run test:critical 2>&1 | tail -10 || echo "⚠ Critical tests had issues"

echo ""

# Security scan
echo "--- Security Scan ---"
node scripts/security-scan.js --all 2>&1 | tail -10 || echo "⚠ Security scan found issues"

echo ""

# Build check (optional — can be slow)
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "--- Build Check ---"
  npm run build 2>&1 | tail -5 || echo "⚠ Build had issues"
fi

echo ""
echo "=== Health Check Complete ==="
echo "Finished: $(date)"
