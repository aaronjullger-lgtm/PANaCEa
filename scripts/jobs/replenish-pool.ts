import { createEdgePrismaClient } from '../../functions/api/_shared/prisma-edge';
import { QuestionGenerationService } from '../../lib/services/question/generationService';
import { ContentService } from '../../lib/services/content/contentService';
import { type MedicalContentData } from '../../lib/services/content/types';

// NOTE: This script is intended to be run manually or by a scheduler.
// It requires DATABASE_URL and GEMINI_API_KEY environment variables.

async function replenishPool() {
  const databaseUrl = process.env.DATABASE_URL;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!databaseUrl || !geminiApiKey) {
    console.error('Missing DATABASE_URL or GEMINI_API_KEY');
    process.exit(1);
  }

  const prisma = createEdgePrismaClient(databaseUrl);
  const contentService = new ContentService(databaseUrl);
  const generationService = new QuestionGenerationService(geminiApiKey);

  try {
    console.log('Starting question pool replenishment...');

    // 1. Identify conditions with low question count in the pool
    // We want at least 5 questions per condition in the pool
    const targetCount = 5;

    // Get all conditions that have content
    const allConditions = await contentService.getAllConditions({ includeContent: true });

    console.log(`Found ${allConditions.length} conditions.`);

    let generatedCount = 0;
    const maxGenerationPerRun = 20; // Limit to avoid rate limits/timeouts

    for (const conditionMeta of allConditions) {
      if (generatedCount >= maxGenerationPerRun) break;

      // Count existing pool questions for this condition
      const poolCount = await prisma.preGeneratedQuestion.count({
        where: { conditionId: conditionMeta.id },
      });

      if (poolCount < targetCount) {
        console.log(
          `Condition ${conditionMeta.name} has ${poolCount} questions. Generating more...`
        );

        // Get content
        const content = await contentService.getConditionContent(conditionMeta.id);
        if (!content) {
          console.warn(`No content found for ${conditionMeta.name}, skipping.`);
          continue;
        }

        // Generate questions
        const needed = targetCount - poolCount;
        for (let i = 0; i < needed; i++) {
          if (generatedCount >= maxGenerationPerRun) break;

          const generated = await generationService.generateReviewQuestion(content);

          if (generated) {
            // Save to pool
            const id = `gen-pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            await prisma.preGeneratedQuestion.create({
              data: {
                id,
                conditionId: conditionMeta.id,
                system: conditionMeta.system,
                difficulty: generated.difficulty || 'medium',
                questionData: {
                  vignette: generated.vignette,
                  question: generated.question,
                  options: generated.options,
                  correctAnswerIndex:
                    ['A', 'B', 'C', 'D'].indexOf(generated.correctAnswer?.charAt(0)) !== -1
                      ? ['A', 'B', 'C', 'D'].indexOf(generated.correctAnswer?.charAt(0))
                      : 0,
                  explanation: generated.explanation,
                  condition: content.condition,
                },
                generatedAt: new Date(),
                source: 'replenish-job',
              },
            });
            console.log(`Saved question for ${conditionMeta.name}`);
            generatedCount++;

            // Rate limiting pause
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    console.log(`Job complete. Generated ${generatedCount} questions.`);
  } catch (error) {
    console.error('Error replenishing pool:', error);
  } finally {
    await prisma.$disconnect();
    await contentService.disconnect();
  }
}

replenishPool();
