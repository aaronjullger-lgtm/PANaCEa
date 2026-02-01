#!/usr/bin/env bash
# Save as: scripts/architecture-integrity-fixes.sh
# Usage: ./scripts/architecture-integrity-fixes.sh
# Run from repo root. Review all changes before committing.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== 1. Checking for Node.js APIs in Edge surface ==="
for dir in functions lib; do
  if grep -rE "from ['\"]fs['\"]|from ['\"]path['\"]|from ['\"]crypto['\"]|from ['\"]os['\"]" "$dir" --include="*.ts" 2>/dev/null; then
    echo "FAIL: Found Node API usage in $dir"
  else
    echo "OK: No fs/path/crypto/os in $dir"
  fi
done

echo ""
echo "=== 2. Listing files that instantiate PrismaClient (excluding scripts and lib/prisma.ts) ==="
grep -rln "new PrismaClient(" --include="*.ts" . 2>/dev/null \
  | grep -v "^./scripts/" \
  | grep -v "^./lib/prisma.ts" \
  | grep -v "^./prisma/" \
  || true

echo ""
echo "=== 3. Suggested Prisma singleton replacements (manual) ==="
echo "Run these replacements only after verifying each file is Node-only (not Edge):"
echo "  lib/services/sync/registrySync.ts       -> import { prisma } from '../../prisma';"
echo "  lib/services/autoAuthor/databaseService.ts -> import { prisma } from '@/lib/prisma';"
echo "  lib/services/referenceService.ts         -> import { prisma } from '../prisma';"
echo "  services/core/enhancedQuestionPool.ts    -> import { prisma } from '@/lib/prisma';"
echo "  services/core/poolMonitorService.ts      -> import { prisma } from '@/lib/prisma';"
echo ""
echo "Done. Fix service isolation (submit-review) and Zod/Prisma drift manually."
