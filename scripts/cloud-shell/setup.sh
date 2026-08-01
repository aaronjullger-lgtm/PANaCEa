#!/bin/bash
# PANaCEa Cloud Shell Setup
# Run this once in Google Cloud Shell to set up the dev environment.
#
# Usage:
#   curl -sL https://raw.githubusercontent.com/aaronjullger-lgtm/PANaCEa/main/scripts/cloud-shell/setup.sh | bash
#   # OR clone first, then:
#   bash scripts/cloud-shell/setup.sh

set -euo pipefail

echo "=== PANaCEa Cloud Shell Setup ==="

# Clone if not already in the repo
if [ ! -f "package.json" ]; then
  echo "Cloning PANaCEa..."
  git clone https://github.com/aaronjullger-lgtm/PANaCEa.git ~/StudyPANaCEa
  cd ~/StudyPANaCEa
fi

# Check Node version
NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d v)
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Installing Node 22..."
  nvm install 22
  nvm use 22
fi

echo "Installing dependencies..."
npm ci

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Set environment variables:"
echo "     export DATABASE_URL='...'"
echo "     export DIRECT_DATABASE_URL='...'"
echo "     export GEMINI_API_KEY='...'"
echo "     export VERTEX_AI_PROJECT='...'"
echo "     export VERTEX_AI_LOCATION='us-central1'"
echo "     export VERTEX_AI_API_KEY='...'"
echo ""
echo "  2. Run question generation:"
echo "     npx tsx scripts/generate-cv-pulm-gap.ts"
echo ""
echo "  3. Run blueprint audit:"
echo "     npx tsx scripts/blueprint-coverage-audit.ts"
echo ""
echo "  4. Run system health check:"
echo "     npm run system-health"
