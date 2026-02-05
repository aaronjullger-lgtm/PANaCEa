-- Corrective migration: QuestionFlag table uses column "userId" (schema and init migration), not "reportedBy".
-- RLS policies were created with "reportedBy"; replace with "userId".

DROP POLICY IF EXISTS "question_flag_insert_own" ON "QuestionFlag";
DROP POLICY IF EXISTS "question_flag_select_own" ON "QuestionFlag";
DROP POLICY IF EXISTS "question_flag_admin" ON "QuestionFlag";

CREATE POLICY "question_flag_insert_own" ON "QuestionFlag"
  FOR INSERT
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "question_flag_select_own" ON "QuestionFlag"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "question_flag_admin" ON "QuestionFlag"
  FOR ALL
  USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));
