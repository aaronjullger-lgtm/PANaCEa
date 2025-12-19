#!/bin/bash

# Cleanup Console.log Statements Script
# This script removes debug console.log statements from production code
# while preserving error logging (console.error, console.warn)

echo "🧹 Cleaning up console.log statements..."
echo ""

# Find all TypeScript/JavaScript files (excluding node_modules, dist, and scripts)
FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/dist-server/*" \
  -not -path "*/scripts/*" \
  -not -path "*/tests/*" \
  -not -path "*/.next/*" \
  -not -path "*/.cache/*")

# Count console.log statements
TOTAL=$(echo "$FILES" | xargs grep -c "console\.log" 2>/dev/null | grep -v ":0$" | wc -l)

echo "Found files with console.log: $TOTAL"
echo ""

# List top offenders
echo "📊 Top files with console.log statements:"
echo "$FILES" | xargs grep -c "console\.log" 2>/dev/null | grep -v ":0$" | sort -t: -k2 -rn | head -10

echo ""
echo "⚠️  MANUAL REVIEW REQUIRED"
echo ""
echo "Please review each file and:"
echo "  1. Remove debug console.log statements"
echo "  2. Keep console.error for error logging"
echo "  3. Keep console.warn for warnings"
echo "  4. Replace informational logs with proper logging service"
echo ""
echo "To find all console.log statements:"
echo "  grep -rn \"console\\.log\" --include=\"*.ts\" --include=\"*.tsx\" --exclude-dir=\"node_modules\" --exclude-dir=\"dist\" --exclude-dir=\"scripts\" ."
