/**
 * LangSmith Dashboard Export Script
 *
 * Exports PANaCEa's agent monitoring dashboard configurations as JSON
 * for one-click import into LangSmith. Run with:
 *
 *   npx tsx scripts/export-langsmith-dashboards.ts
 *
 * Outputs dashboard JSON files to scripts/output/langsmith-dashboards/
 * that can be imported via the LangSmith UI or API.
 */

import {
  getAllDashboards,
  getQualityGates,
  getAlertRules,
} from '../lib/agents/monitoring';

const outputDir = 'scripts/output/langsmith-dashboards';

async function main(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const dashboards = getAllDashboards();
  const qualityGates = getQualityGates();
  const alertRules = getAlertRules();

  for (const dashboard of dashboards) {
    const filename = path.join(
      outputDir,
      `${dashboard.name.toLowerCase().replace(/\s+/g, '-')}.json`,
    );

    fs.writeFileSync(
      filename,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          source: 'PANaCEa Agent Monitoring',
          dashboard,
        },
        null,
        2,
      ),
    );

    console.log(`  ✓ ${filename}`);
  }

  const gatesFile = path.join(outputDir, 'quality-gates.json');
  fs.writeFileSync(
    gatesFile,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        source: 'PANaCEa Agent Monitoring',
        qualityGates,
      },
      null,
      2,
    ),
  );
  console.log(`  ✓ ${gatesFile}`);

  const alertsFile = path.join(outputDir, 'alert-rules.json');
  fs.writeFileSync(
    alertsFile,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        source: 'PANaCEa Agent Monitoring',
        alertRules,
      },
      null,
      2,
    ),
  );
  console.log(`  ✓ ${alertsFile}`);

  console.log(`\nExported ${dashboards.length} dashboards, ${qualityGates.length} quality gates, ${alertRules.length} alert rules.`);
  console.log('Import these into LangSmith at: https://smith.langchain.com/settings');
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
