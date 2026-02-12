#!/usr/bin/env npx tsx
/**
 * Launch Cloud Agents across multiple repositories with the same instruction.
 * Usage:
 *   npx tsx scripts/cloud-agents/bulk-repos.ts --instruction "Bump lodash to 4.18 and fix breaking changes" --repos "org/repo1" "org/repo2"
 *   npx tsx scripts/cloud-agents/bulk-repos.ts -i "Update .cursorrules for new lint rule" -r org/lib-a org/app-b
 *
 * Requires CURSOR_AGENTS_API_KEY. Repos can be "owner/name" or full GitHub URLs.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { launchAgent } from "./client.js";

async function main() {
  const args = process.argv.slice(2);
  let instruction = "";
  const repos: string[] = [];
  const branch = "main";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--instruction" || args[i] === "-i") {
      instruction = args[++i] ?? "";
    } else if (args[i] === "--repos" || args[i] === "-r") {
      i++;
      while (args[i] && !args[i].startsWith("-")) {
        repos.push(args[i++]);
      }
      i--;
    }
  }

  if (!instruction.trim() || repos.length === 0) {
    console.error("Usage: npx tsx scripts/cloud-agents/bulk-repos.ts --instruction \"<task>\" --repos org/repo1 org/repo2");
    process.exit(1);
  }

  for (const repo of repos) {
    const repository = repo.startsWith("http") ? repo : `https://github.com/${repo}`;
    try {
      const result = await launchAgent({
        instruction,
        repository,
        ref: branch,
        autoCreatePr: true,
      });
      console.log(`${repo}: agent launched ${result.id}`);
    } catch (err) {
      console.error(`${repo}: failed`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
