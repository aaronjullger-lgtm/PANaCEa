---
name: post-launch-monitoring-and-response
description: Use to set up post-launch monitoring, define critical metrics, create incident triage playbooks, and perform postmortems. Trigger when the user asks to monitor after a release, investigate production behavior, handle incidents, or create runbooks.
---

1. Define critical metrics for the release or system: error rates, login failures, API latency, database latency, queue failures, readiness score updates, daily active users, payment events, AI-agent failures, and support volume.
2. Inspect current observability tools, logs, analytics, uptime checks, alerting, dashboards, and deployment events. Identify blind spots before adding new instrumentation.
3. Configure structured logging and monitoring with sensitive-data redaction. Do not log tokens, secrets, health data, student records, payment data, private prompts, or personally identifying content unless explicitly allowed and protected.
4. Create incident severity levels with user impact, response targets, escalation paths, owner roles, communication channels, and decision criteria for hotfix versus rollback.
5. Draft runbooks for database incidents, API outages, authentication failures, AI-agent misbehavior, payment issues, slow dashboards, and broken review queues.
6. Provide communication templates for user-facing status updates and internal incident updates. Use `scripts/create-incident-template.sh` as a starting stub if the repo needs generated incident notes.
7. During an active incident, preserve evidence, identify the fastest safe mitigation, avoid speculative rewrites, and communicate status based on verified facts.
8. After mitigation, create a postmortem covering timeline, impact, root cause, contributing factors, detection gaps, response gaps, and concrete prevention tasks.
9. Add follow-up tasks for improved tests, alerts, dashboards, runbooks, feature flags, rollback automation, and user communication.
10. Acceptance criteria: critical metrics are defined, alerts are actionable, sensitive data is redacted, incident ownership is clear, runbooks exist, and postmortem actions are trackable.
11. Finish with monitoring added, dashboards or alerts changed, runbooks created, incident status, unresolved risks, and follow-up tasks.
