/**
 * Exam Complete API - POST /api/exam/complete
 * Sprint 5: Complete an exam and generate score report
 */

import { authenticateRequest, handleCorsOptions } from "../_shared/auth";
import { createEdgePrismaClient } from "../_shared/prisma-edge";
import { validateRequest, CompleteExamSchema } from "../_shared/schemas";
import { ExamService } from "../../../services/examService";

export async function onRequestOptions(context: any) {
  return handleCorsOptions();
}

export async function onRequestPost(context: any) {
  const { request, env } = context;

  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate request body with Zod schema
  const validation = await validateRequest(request, CompleteExamSchema);
  if (!validation.success) {
    return (validation as { success: false; response: Response }).response;
  }

  const { attemptId } = validation.data;

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {

    // Get the attempt
    const attempt = await prisma.examAttempt.findFirst({
      where: {
        id: attemptId,
        userId: auth.userId,
      },
      include: {
        config: true,
      },
    });

    if (!attempt) {
      return new Response(
        JSON.stringify({ error: "Exam attempt not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (attempt.status === "completed") {
      // Already completed - return existing score report
      const answers = await prisma.examAnswer.findMany({
        where: { attemptId },
      });

      const scoreReport = ExamService.generateScoreReport(
        answers as any,
        attempt.config as any,
        attempt.totalTimeUsedSeconds || 0
      );

      return new Response(
        JSON.stringify({
          success: true,
          alreadyCompleted: true,
          attempt,
          scoreReport,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get all answers and grade them
    const answers = await prisma.examAnswer.findMany({
      where: { attemptId },
      include: {
        question: {
          select: {
            correctAnswer: true,
          },
        },
      },
    });

    // Update correctness for each answer
    const updatePromises = answers.map(async (answer) => {
      const isCorrect = answer.selectedAnswer === answer.question?.correctAnswer;
      return prisma.examAnswer.update({
        where: { id: answer.id },
        data: { isCorrect },
      });
    });

    await Promise.all(updatePromises);

    // Fetch updated answers
    const gradedAnswers = await prisma.examAnswer.findMany({
      where: { attemptId },
    });

    // Calculate total time
    const startTime = new Date(attempt.startedAt).getTime();
    const endTime = Date.now();
    const totalTimeSeconds = Math.floor((endTime - startTime) / 1000);

    // Generate score report
    const scoreReport = ExamService.generateScoreReport(
      gradedAnswers as any,
      attempt.config as any,
      totalTimeSeconds
    );

    // Calculate system scores for storage
    const systemScores: Record<string, number> = {};
    for (const system of scoreReport.systemBreakdown) {
      systemScores[system.system] = system.percentCorrect;
    }

    // Update attempt as completed
    const completedAttempt = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: "completed",
        completedAt: new Date(),
        totalTimeUsedSeconds: totalTimeSeconds,
        score: scoreReport.overallScore,
        percentCorrect: scoreReport.percentCorrect,
        systemScores,
        passStatus: scoreReport.passStatus,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        alreadyCompleted: false,
        attempt: completedAttempt,
        scoreReport,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error completing exam:", error);
    return new Response(
      JSON.stringify({ error: "Failed to complete exam", details: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
