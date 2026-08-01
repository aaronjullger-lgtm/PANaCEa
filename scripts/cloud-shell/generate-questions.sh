#!/bin/bash
# PANaCEa Batch Question Generation (Cloud Shell)
# Generates questions for under-represented blueprint areas.
#
# Usage:
#   bash scripts/cloud-shell/generate-questions.sh           # CV + PULM
#   bash scripts/cloud-shell/generate-questions.sh --system CV    # CV only
#   bash scripts/cloud-shell/generate-questions.sh --system NEURO # NEURO only

set -euo pipefail

cd "$(dirname "$0")/../.."

if [ -z "${GEMINI_API_KEY:-}" ] && [ -z "${VERTEX_AI_API_KEY:-}" ]; then
  echo "ERROR: Set GEMINI_API_KEY or VERTEX_AI_API_KEY"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: Set DATABASE_URL"
  exit 1
fi

echo "=== PANaCEa Question Generation ==="
echo "Started: $(date)"
echo ""

ARGS=""
if [ -n "${1:-}" ]; then
  ARGS="$@"
fi

npx tsx scripts/generate-cv-pulm-gap.ts $ARGS

echo ""
echo "=== Generation Complete ==="
echo "Finished: $(date)"
