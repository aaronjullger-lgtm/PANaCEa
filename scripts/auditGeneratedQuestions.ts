import fs from 'fs';
import path from 'path';
import { generateQuestionsFromCondition } from '../lib/questionGenerator';
import { validateQuestion } from '../lib/questionValidator';
import { ConditionData } from '../types/question';

// Mock Data for Audit
const mockCondition: ConditionData = {
  condition: "Acute Otitis Media",
  sections: {
    overview: "Infection of the middle ear.",
    etiology: "Common pathogens include S. pneumoniae, H. influenzae, M. catarrhalis.",
    clinicalPresentation: "Ear pain, fever, irritability. Bulging tympanic membrane on exam.",
    treatment: "First line is Amoxicillin 90mg/kg/day."
  }
};

async function runAudit() {
  console.log("Starting Question Generation Audit...");
  
  // Ensure output dir exists
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const questions = await generateQuestionsFromCondition(mockCondition, 5);
  
  const auditResults = questions.map(q => {
    const validation = validateQuestion(q, mockCondition);
    return {
      questionId: q.id,
      type: q.type,
      text: q.question,
      isValid: validation.isValid,
      score: validation.score,
      violations: validation.errors,
      rawQuestion: q
    };
  });

  const reportPath = path.join(outputDir, 'question_generation_audit.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
  
  console.log(`Audit complete. Generated ${questions.length} questions.`);
  console.log(`Report saved to ${reportPath}`);
  
  // Exit code based on failures
  const failures = auditResults.filter(r => !r.isValid).length;
  if (failures > 0) {
    console.error(`WARNING: ${failures} questions failed validation.`);
    process.exit(1);
  }
}

runAudit().catch(e => {
  console.error(e);
  process.exit(1);
});
