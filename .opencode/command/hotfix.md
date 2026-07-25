---
description: Rapid production hotfix — reproduce, fix, test, commit, push. Use when something is broken in production.
agent: orchestrator
---

Execute a rapid hotfix for:

$ARGUMENTS

## Step 1: Reproduce
- Identify the exact error, user flow, or failing test
- Read the relevant code with codegraph_explore
- Confirm you understand the root cause before writing any code

## Step 2: Fix (minimal diff)
- Change the LEAST code possible to fix the issue
- Do not refactor, rename, or "improve" anything else
- Do not touch unrelated files
- If the fix requires a migration or schema change — STOP and ask Aaron

## Step 3: Test
- Run the specific test file for the changed code
- If no test exists, write ONE regression test that would have caught this bug
- Run `npm run lint` on changed files

## Step 4: Commit and Push
- `git add <specific-files>` — never `git add .`
- Commit: `fix: <what was broken>` 
- Push to current branch
- If on main: create a branch first, push, create PR

## Step 5: Report
- What was the root cause?
- What was the fix? (one sentence)
- What files changed?
- What tests pass?
- Does this need a deploy? If so, say so — do NOT deploy without Aaron's approval
