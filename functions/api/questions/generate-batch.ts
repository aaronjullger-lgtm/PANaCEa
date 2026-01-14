/**
 * API Endpoint: /api/questions/generate-batch
 * 
 * Background generation of questions to seed the pre-generated pool
 * Uses Gemini API to generate questions and stores them in PreGeneratedQuestion table
 * 
 * PUBLIC endpoint - generates questions for a shared pool, no user data involved
 */

import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { CloudflareContext } from '../_shared/types';

interface Env {
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
  CLERK_SECRET_KEY: string;
  CRON_SECRET?: string; // Optional: for cron job access
}

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;

// Systems for question generation
const SYSTEMS = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'];

// Handle CORS preflight
export function onRequestOptions() {
  return handleCorsOptions();
}

export const onRequestPost = async (context: CloudflareContext<Env>) => {
  const { request, env } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Allow cron jobs with CRON_SECRET or authenticated users
  const authHeader = request.headers.get('Authorization');
  const isCronJob = authHeader === `Bearer ${env.CRON_SECRET}` && env.CRON_SECRET;
  
  if (!isCronJob) {
    const clerkId = await verifyAuthToken(request, env);
    if (!clerkId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }
  }
  
  try {

    // Parse request body
    const body = await context.request.json() as {
      system?: string;
      category?: string;
      difficulty?: string;
      count?: number;
    };

    const system = body.system || SYSTEMS[Math.floor(Math.random() * SYSTEMS.length)];
    const category = body.category || 'general';
    const difficulty = body.difficulty || 'medium';
    const count = Math.min(body.count || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

    // Check API key
    if (!context.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Generate questions using Gemini
    const generatedQuestions = await generateQuestionsWithGemini(
      context.env.GEMINI_API_KEY,
      system,
      category,
      difficulty,
      count
    );

    if (generatedQuestions.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No questions generated',
        generated: 0 
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Seed questions into PreGeneratedQuestion table
    const records = generatedQuestions.map((q, idx) => ({
      id: `pregen-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      questionType: category,
      system: system,
      difficulty: difficulty,
      questionData: q,
      generatedAt: new Date(),
    }));

    const result = await prisma.preGeneratedQuestion.createMany({
      data: records,
      skipDuplicates: true,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      generated: result.count,
      system,
      category,
      difficulty,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Error generating batch questions:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Generate questions using Gemini API
 */
async function generateQuestionsWithGemini(
  apiKey: string,
  system: string,
  category: string,
  difficulty: string,
  count: number
): Promise<Array<{
  question: string;
  vignette?: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  tags?: string[];
}>> {
  const systemDescriptions: Record<string, string> = {
    CV: 'Cardiovascular system - heart, blood vessels, circulation',
    PULM: 'Pulmonary/Respiratory system - lungs, airways, breathing',
    GI: 'Gastrointestinal system - digestive tract, liver, pancreas',
    NEURO: 'Neurological system - brain, spinal cord, peripheral nerves',
    MSK: 'Musculoskeletal system - bones, joints, muscles',
    DERM: 'Dermatology - skin, hair, nails',
    HEME: 'Hematology/Oncology - blood, lymph, malignancies',
    ENDO: 'Endocrine system - hormones, thyroid, adrenal, diabetes',
    HEENT: 'Head, Eyes, Ears, Nose, Throat',
    RENAL: 'Renal/Genitourinary - kidneys, bladder, electrolytes',
    REPRO: 'Reproductive system - male and female reproductive health',
    PSYCH: 'Psychiatry - mental health, behavioral conditions',
    ID: 'Infectious Disease - bacterial, viral, fungal, parasitic',
    GU: 'Genitourinary - urinary tract, reproductive system',
  };

  const difficultyDescriptions: Record<string, string> = {
    easy: 'straightforward concepts, clear presentations, common conditions',
    medium: 'moderate complexity, some nuance required, typical PANCE-style',
    hard: 'complex cases, atypical presentations, differential diagnosis challenges',
  };

  const prompt = `Generate ${count} unique PANCE-style medical multiple choice questions for the ${system} (${systemDescriptions[system] || system}) system.

Category: ${category}
Difficulty: ${difficulty} - ${difficultyDescriptions[difficulty] || difficulty}

Requirements:
1. Each question should have a brief clinical vignette (2-4 sentences) presenting a realistic patient scenario
2. The question stem should be clear and test clinical decision-making
3. Provide exactly 4 answer options (A, B, C, D)
4. Include one correct answer and three plausible distractors
5. The explanation should be educational and explain why the correct answer is right and why others are wrong
6. Questions should be appropriate for PA certification exam preparation

Return ONLY a JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "vignette": "Brief clinical scenario...",
    "question": "What is the most appropriate next step?",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "A",
    "explanation": "Detailed explanation...",
    "tags": ["${system}", "${category}"]
  }
]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('No text in Gemini response');
      return [];
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const questions = JSON.parse(jsonText);
    
    if (!Array.isArray(questions)) {
      console.error('Invalid questions format - not an array');
      return [];
    }

    // Validate structure
    return questions.filter(q => 
      q.question && 
      Array.isArray(q.options) && 
      q.options.length === 4 &&
      q.correctAnswer &&
      q.explanation
    );
  } catch (error) {
    console.error('Error generating questions with Gemini:', error);
    return [];
  }
}
