# n8n Content Pipeline — Design Document

> **Status:** n8n MCP verified working (search + node lookup confirmed).
> Gemini AI nodes, Postgres nodes, and HTTP webhook triggers all available.

## Architecture

```
[Trigger: Cron / Webhook / Manual]
  → [HTTP Request: Fetch NCCPA blueprint topics]
  → [Google Gemini: Generate PANCE question from topic]
  → [Code Node: Parse + validate JSON output]
  → [Postgres: INSERT into staging table]
  → [Slack/Email: Notify admin for review]
  → [Wait for approval webhook]
  → [Postgres: Move from staging → published]
```

## n8n Nodes (all confirmed available)

| Step | Node | Type |
|------|------|------|
| Trigger | Schedule Trigger / Webhook | `nodes-base.scheduleTrigger` |
| Fetch topics | HTTP Request | `nodes-base.httpRequest` |
| AI generation | Google Gemini | `nodes-langchain.googleGemini` |
| Parse output | Code | `nodes-base.code` |
| DB write | Postgres | `nodes-base.postgres` |
| Notify | Slack / Email | `nodes-base.slack` / `nodes-base.emailSend` |
| Approval wait | Wait / Webhook | `nodes-base.wait` |

## Workflow Definition

### 1. Trigger
- **Schedule:** Every 6 hours, generate 10 questions per run
- **Webhook:** Manual trigger from admin panel (`POST /api/admin/generation/trigger`)

### 2. Topic Selection
- HTTP Request to PANaCEa API: `GET /api/admin/blueprint/gaps`
- Returns organ systems with lowest question coverage
- Loop node iterates over returned topics

### 3. Question Generation (per topic)
- **Google Gemini** node with clinical prompt:
  - Model: `gemini-2.5-flash` (cost-optimized)
  - System prompt: PANCE/PANRE question writer
  - Output: JSON with question stem, 5 options, answer, explanation, blueprint tags
- **Code** node validates:
  - Exactly 5 options
  - Valid Bloom's taxonomy level
  - Correct organ system + task category
  - No duplicate questions (check staging table)

### 4. Staging Insert
- **Postgres** node: `INSERT INTO QuestionStaging (...)`
- Connection string from vault: `DIRECT_DATABASE_URL`
- Schema matches Prisma `QuestionStaging` model

### 5. Review Notification
- **Slack** node posts to `#content-review` channel
- Message includes: topic, question count, staging link
- Admin reviews via PANaCEa admin panel (`/admin/refinery`)

### 6. Publication (on approval)
- **Webhook** receives approval from admin panel
- **Postgres** moves row from `QuestionStaging` to `Question`
- Assigns `conditionId` based on topic mapping

## Configuration Values (from vault)

| Env Var | Used For |
|---------|----------|
| `GEMINI_API_KEY` | Gemini AI node authentication |
| `DIRECT_DATABASE_URL` | Postgres node connection |
| `N8N_API_KEY` | MCP authentication |
| `N8N_API_URL` | n8n instance base URL |

## Next Steps
1. Set `N8N_API_URL` to actual n8n cloud URL (currently placeholder)
2. Import workflow JSON into n8n
3. Configure Postgres credential in n8n UI
4. Configure Gemini API key in n8n UI
5. Test with manual trigger first
