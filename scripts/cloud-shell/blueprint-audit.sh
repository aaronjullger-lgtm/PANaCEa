#!/bin/bash
# PANaCEa Blueprint Coverage Audit (Cloud Shell)
# Audits question bank coverage against NCCPA blueprint.
#
# Usage:
#   bash scripts/cloud-shell/blueprint-audit.sh

set -euo pipefail

cd "$(dirname "$0")/../.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: Set DATABASE_URL"
  exit 1
fi

echo "=== Blueprint Coverage Audit ==="
echo "Started: $(date)"
echo ""

npx tsx scripts/blueprint-coverage-audit.ts 2>&1 | tee "blueprint-audit-$(date +%Y%m%d).txt"

echo ""
echo "Report saved to: blueprint-audit-$(date +%Y%m%d).txt"
echo "Finished: $(date)"
