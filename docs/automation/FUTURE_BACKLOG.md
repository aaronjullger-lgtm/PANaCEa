# Future Automation Backlog

This backlog is intentionally realistic. It focuses on the next credible improvements to the current PANaCEa automation system.

## 1. Near-term

### Dead-man-switch alerting for missed scheduled runs

- Why it matters: GitHub cron can silently stop being useful if a workflow is disabled, repeatedly skipped, or failing without human review.
- Impact: high
- Difficulty: medium
- Risk: low
- Recommended trigger for doing it: the first time a scheduled lane misses an expected run window without immediate operator notice.

### Backup restore verification

- Why it matters: weekly backups are only trustworthy if restore validation exists.
- Impact: high
- Difficulty: medium
- Risk: medium
- Recommended trigger for doing it: before expanding weekly maintenance scope or relying on backup artifacts as a recovery story.

### Move reservoir supply out of GitHub cron

- Why it matters: `sched-reservoir-supply.yml` is still the intentional mutative exception and should become runtime-owned queue work.
- Impact: high
- Difficulty: high
- Risk: medium
- Recommended trigger for doing it: repeated manual reruns, repeated reservoir failures, or any sign that supply pressure depends on near-real-time control.

### Daily-ops endpoint health alerting

- Why it matters: daily ops currently writes good artifacts, but failed endpoint fanout still depends on operators checking GitHub runs.
- Impact: medium
- Difficulty: medium
- Risk: low
- Recommended trigger for doing it: two or more daily ops failures in a 30-day window.

### Activate real CODEOWNERS handles

- Why it matters: governance is still role-based in docs, not enforced in GitHub review routing.
- Impact: medium
- Difficulty: low
- Risk: low
- Recommended trigger for doing it: once stable GitHub usernames or teams are agreed for Platform / DevOps, Platform / DevEx, and the lane owners.

## 2. Medium-term

### App-native scheduling for reminders and user-critical timing

- Why it matters: user-visible reminder delivery should not depend on GitHub cron.
- Impact: high
- Difficulty: high
- Risk: medium
- Recommended trigger for doing it: when reminder reliability or user-local timing becomes an operational concern again.

### Incremental learning-model refresh beyond user-profile enrichment

- Why it matters: daily learner-model work currently centers on bounded profile enrichment and still leaves calibration-style jobs unscheduled.
- Impact: medium
- Difficulty: high
- Risk: medium
- Recommended trigger for doing it: once `calibrate-items` or `generate-daily-plans` is genuinely safe, incremental, and rerunnable.

### Better content freshness scoring

- Why it matters: current content audit surfaces stale and incomplete content, but the scoring is still mostly heuristic and snapshot-based.
- Impact: medium
- Difficulty: medium
- Risk: low
- Recommended trigger for doing it: when monthly deep-audit findings stay noisy or hard to prioritize.

### Queue observability beyond background-job counts

- Why it matters: runtime sanity currently surfaces queue health only at a high level.
- Impact: medium
- Difficulty: medium
- Risk: low
- Recommended trigger for doing it: when runtime sanity repeatedly shows queue symptoms without enough context to act.

### Automation debt detection inside repo hygiene

- Why it matters: the repo has already had drift between workflow headers, docs, aliases, and live behavior.
- Impact: medium
- Difficulty: medium
- Risk: low
- Recommended trigger for doing it: if weekly repo hygiene keeps finding the same kinds of workflow-policy or doc drift.

## 3. Later / Optional

### Question-generation backpressure controls

- Why it matters: generation-heavy surfaces should not expand blindly if reservoir demand, review queues, or content QA cannot absorb them.
- Impact: medium
- Difficulty: high
- Risk: medium
- Recommended trigger for doing it: if question generation or variant generation is reintroduced into semi-automated operation.

### Content freshness and media backlog trend reporting

- Why it matters: monthly and content-audit packets surface findings, but not a strong trend line for whether the backlog is improving.
- Impact: medium
- Difficulty: medium
- Risk: low
- Recommended trigger for doing it: once operators want trend views rather than one-off audit packets.

### Cloud-agent governance metrics

- Why it matters: `cloud-agents.yml` is intentionally event-driven/manual-only, but the repo still lacks a simple view of which agent jobs are useful versus noisy.
- Impact: medium
- Difficulty: medium
- Risk: low
- Recommended trigger for doing it: if agent jobs multiply or if operators cannot tell whether a job still has practical value.

### Runtime-health checks outside GitHub Actions

- Why it matters: GitHub cron is acceptable for bounded observability, but it is not a full incident-monitoring system.
- Impact: high
- Difficulty: high
- Risk: medium
- Recommended trigger for doing it: if hourly runtime sanity becomes a primary health signal rather than a secondary one.

### Automation review dashboard outside docs

- Why it matters: the current operator dashboard is documentation-only and depends on manual reading of artifacts.
- Impact: medium
- Difficulty: medium
- Risk: low
- Recommended trigger for doing it: if operators want a persistent weekly/monthly view without opening multiple Actions runs.
