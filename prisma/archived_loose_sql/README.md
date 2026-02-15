# Archived Loose SQL Files

These SQL files were **not** part of Prisma migration history. Their DDL has been consolidated into the official migration:

- **20260204120002_baseline_loose_sql** — applies the same changes idempotently (IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT DO NOTHING).

Do **not** run these archived files manually; use `npx prisma migrate deploy` so the consolidated migration is applied once and recorded in history.

| File                        | Content                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| add_fulltext_search.sql     | Full-text search on MedicalContent (search_vector, trigger, search_medical_content function) |
| add_guideline_table.sql     | Guideline table and seed rows                                                                |
| add_platform_statistics.sql | PlatformStatistics, ContentStatistics, UserStatisticsSnapshot                                |
| add_user_statistics.sql     | UserStatistics table, StudySession columns                                                   |
