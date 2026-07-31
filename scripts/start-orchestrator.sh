#!/bin/bash
# PANaCEa Agent Orchestrator + Dashboard startup script
# Usage: bash scripts/start-orchestrator.sh
set -euo pipefail

REPO="/Users/aaronullger/GitHub/StudyPANaCEa"
ORCH="$REPO/packages/agent-orchestrator"
DASH="$REPO/packages/agents-dashboard"

echo "=== Sourcing secrets from 1Password ==="
export LANGFUSE_SECRET_KEY="$(op read 'op://Code/LANGFUSE_SECRET_KEY/credential' 2>/dev/null)"
export LANGFUSE_PUBLIC_KEY="$(op read 'op://Code/LANGFUSE_PUBLIC_KEY/credential' 2>/dev/null)"
export LANGFUSE_HOST="$(op read 'op://Code/LANGFUSE_HOST/credential' 2>/dev/null)"
export GEMINI_API_KEY="$(op read 'op://Code/GEMINI_API_KEY/credential' 2>/dev/null)"
export OPENAI_API_KEY="$(op read 'op://Code/OPENAI_API_KEY/credential' 2>/dev/null)"
export QDRANT_URL="$(op read 'op://Code/QDRANT_URL/credential' 2>/dev/null)"
export QDRANT_API_KEY="$(op read 'op://Code/QDRANT_API_KEY/credential' 2>/dev/null)"
export LINEAR_API_KEY="$(op read 'op://Code/LINEAR_API_KEY/credential' 2>/dev/null)"
export LINEAR_TEAM_ID="$(op read 'op://Code/LINEAR_TEAM_ID/credential' 2>/dev/null)"
export COMPOSIO_API_KEY="$(op read 'op://Code/COMPOSIO_API_KEY/credential' 2>/dev/null)"
export GITHUB_PAT="$(op read 'op://Code/GITHUB_PAT/credential' 2>/dev/null)"
export GITHUB_REPO="aaronjullger-lgtm/PANaCEa"
export SENTRY_AUTH_TOKEN="$(op read 'op://Code/SENTRY_AUTH_TOKEN/credential' 2>/dev/null)"
export SENTRY_ORG="aaron-ullger"
export VERCEL_TOKEN="$(op read 'op://Code/VERCEL_API_KEY/credential' 2>/dev/null)"
export ORCHESTRATOR_CHECKPOINT="${ORCHESTRATOR_CHECKPOINT:-off}"

echo "=== Starting orchestrator on :4100 ==="
cd "$ORCH"
npx tsx src/server/api.ts &
ORCH_PID=$!
sleep 3

echo "=== Starting dashboard on :4300 ==="
cd "$DASH"
npx next dev -p 4300 &
DASH_PID=$!

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  PANaCEa Agent Fleet is running              ║"
echo "║  Dashboard:   http://localhost:4300          ║"
echo "║  API:         http://localhost:4100/health    ║"
echo "║  Orchestrator PID: $ORCH_PID                    ║"
echo "║  Dashboard PID:    $DASH_PID                    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""
echo "Start the autonomous fleet:"
echo "  curl -X POST http://localhost:4100/fleet/start"
echo ""
echo "Launch a pipeline:"
echo "  curl -X POST http://localhost:4100/pipelines/feature-dev/launch \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"context\":\"your feature description\"}'"
echo ""

wait $ORCH_PID $DASH_PID