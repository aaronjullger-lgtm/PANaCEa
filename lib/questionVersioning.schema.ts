/**
 * Question Versioning Schema Addition
 * 
 * Sprint C - Step 8: Track question edit history and enable rollback
 * 
 * Add to prisma/schema.prisma:
 */

// Copy this into prisma/schema.prisma

model QuestionVersion {
  id              String   @id @default(cuid())
  questionId      String   // References PreGeneratedQuestion or Question
  questionType    String   // 'pre_generated' | 'question' | 'staging'
  version         Int      // Version number (1, 2, 3, ...)
  
  // Snapshot of question data at this version
  questionData    Json     // Full question snapshot
  
  // Change tracking
  changedFields   String[] // Array of field names that changed
  changeReason    String?  // Why was this edit made?
  changeSummary   String?  // Brief description of changes
  
  // Editor info
  editedBy        String   // User ID who made the edit
  editedByEmail   String?  // User email for audit trail
  
  // Validation scores
  distractorScore Int?     // Score from distractor validation (0-100)
  qualityScore    Int?     // Overall quality score (0-100)
  
  // Timestamps
  createdAt       DateTime @default(now())
  
  @@index([questionId, version])
  @@index([questionId, questionType])
  @@index([editedBy])
  @@index([createdAt])
  @@unique([questionId, questionType, version])
}

/**
 * Migration script:
 * 
 * 1. Add above model to prisma/schema.prisma
 * 2. Run: npx prisma migrate dev --name add-question-versioning
 * 3. Run: npx prisma generate
 */
