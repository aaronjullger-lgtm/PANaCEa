/**
 * Exam Start API - POST /api/exam/start
 * Sprint 5: Start a new PANCE/PANRE-LA exam attempt
 */

import { authenticateRequest, handleCorsOptions } from "../_shared/auth";
import { createEdgePrismaClient } from "../_shared/prisma-edge";
import { ExamService } from "../../../services/examService";

interface StartExamRequest {
  configId: string; // "pance-2024" or "panre-la-2024"
  resumeAttemptId?: string; // Resume existing attempt
}

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

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const body: StartExamRequest = await request.json();
    const { configId, resumeAttemptId } = body;

    // Check for resume
    if (resumeAttemptId) {
      const existingAttempt = await prisma.examAttempt.findFirst({
        where: {
          id: resumeAttemptId,
          userId: auth.userId,
          status: { in: ["in_progress", "paused"] },
        },
        include: {
          config: true,
        },
      });

      if (existingAttempt && ExamService.canResumeExam(existingAttempt as any)) {
        // Get existing answers
        const answers = await prisma.examAnswer.findMany({
          where: { attemptId: existingAttempt.id },
          orderBy: [{ blockNumber: "asc" }, { questionNumber: "asc" }],
        });

        // Update last active time
        await prisma.examAttempt.update({
          where: { id: existingAttempt.id },
          data: {
            lastActiveAt: new Date(),
            status: "in_progress",
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            isResume: true,
            attempt: existingAttempt,
            answers,
            config: existingAttempt.config,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get exam config
    const config = await prisma.examConfig.findUnique({
      where: { id: configId },
    });

    if (!config || !config.isActive) {
      return new Response(
        JSON.stringify({ error: "Invalid exam configuration" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check for existing in-progress exam
    const inProgressExam = await prisma.examAttempt.findFirst({
      where: {
        userId: auth.userId,
        status: { in: ["in_progress", "paused"] },
      },
    });

    if (inProgressExam) {
      return new Response(
        JSON.stringify({
          error: "You have an exam in progress",
          existingAttemptId: inProgressExam.id,
          canResume: ExamService.canResumeExam(inProgressExam as any),
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Calculate blueprint distribution
    const distribution = ExamService.calculateSystemDistribution(config.totalQuestions);

    // Get available questions from pool
    const availableQuestions = await prisma.question.findMany({
      where: {
        isActive: true,
        approvalStatus: "approved",
      },
      select: {
        id: true,
        stem: true,
        options: true,
        correctAnswer: true,
        organSystem: true,
        difficulty: true,
        conditionId: true,
      },
    });

    if (availableQuestions.length < config.totalQuestions) {
      return new Response(
        JSON.stringify({
          error: "Insufficient questions in pool",
          available: availableQuestions.length,
          required: config.totalQuestions,
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Select questions matching blueprint
    const selectedQuestions = await ExamService.selectExamQuestions(
      availableQuestions as any,
      config.totalQuestions,
      distribution
    );

    // Create exam attempt
    const attemptId = `exam-${auth.userId.slice(0, 8)}-${Date.now()}`;
    const now = new Date();

    const attempt = await prisma.examAttempt.create({
      data: {
        id: attemptId,
        userId: auth.userId,
        configId: config.id,
        startedAt: now,
        lastActiveAt: now,
        currentBlock: 1,
        currentQuestionInBlock: 1,
        blockTimes: [{ block: 1, startedAt: now.toISOString(), timeUsedSeconds: 0 }],
        status: "in_progress",
        totalTimeUsedSeconds: 0,
      },
    });

    // Create exam answers (pre-populate for all questions)
    const answerRecords = selectedQuestions.map((q, idx) => {
      const blockNumber = Math.floor(idx / config.questionsPerBlock) + 1;
      const questionNumber = (idx % config.questionsPerBlock) + 1;

      return {
        id: `answer-${attemptId}-${idx}`,
        attemptId: attempt.id,
        questionId: q.id,
        blockNumber,
        questionNumber,
        isFlagged: false,
        timeSpentSeconds: 0,
        organSystem: (q as any).organSystem || "other",
      };
    });

    await prisma.examAnswer.createMany({
      data: answerRecords,
    });

    // Organize questions into blocks (for response)
    const blocks = ExamService.organizeIntoBlocks(
      selectedQuestions,
      config.blocks,
      config.questionsPerBlock
    );

    return new Response(
      JSON.stringify({
        success: true,
        isResume: false,
        attempt,
        config,
        blocks,
        totalQuestions: config.totalQuestions,
        timeMinutes: config.timeMinutes,
        distribution,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error starting exam:", error);
    return new Response(
      JSON.stringify({ error: "Failed to start exam", details: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
