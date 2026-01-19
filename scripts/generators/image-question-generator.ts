import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const imageDirectory = path.join(__dirname, '..', '..', 'public', 'assets', 'clinical-images');

async function generateQuestionFromImage(filePath: string) {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
  const fileName = path.basename(filePath);

  const imageBuffer = await fs.readFile(filePath);
  const imageBase64 = imageBuffer.toString('base64');

  const prompt = `
    You are a medical education expert creating PANCE-style questions.
    Analyze the following clinical image (${fileName}) and generate a single, high-quality multiple-choice question.
    The question must be in the following JSON format:
    {
      "question": "A 65-year-old male presents with...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 2,
      "rationale": "The image shows classic signs of...",
      "pearls": ["A key takeaway is...", "Another important point is..."],
      "topic": "Cardiology",
      "system": "Cardiovascular",
      "condition": "Myocardial Infarction"
    }
    - The 'condition' should be the specific diagnosis shown in the image.
    - The 'topic' and 'system' should correspond to the PANCE blueprint.
    - Ensure the rationale clearly explains why the correct answer is right and the others are wrong, referencing the image.
  `;

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: 'image/jpeg', // Assuming jpeg, adjust if other types are used
    },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error(`Error generating question for ${fileName}:`, error);
    return null;
  }
}

async function main() {
  console.log('Starting image-based question generation...');
  const files = await fs.readdir(imageDirectory);
  const imageFiles = files.filter((file) => /\.(jpg|jpeg|png)$/i.test(file));

  for (const file of imageFiles) {
    const filePath = path.join(imageDirectory, file);
    console.log(`Processing ${file}...`);
    const questionData = await generateQuestionFromImage(filePath);

    if (questionData) {
      try {
        // First, find the corresponding MedicalContent entry by conditionId
        const medicalContent = await prisma.medicalContent.findFirst({
          where: {
            conditionId: questionData.condition,
          },
        });

        if (!medicalContent) {
          console.warn(
            `Could not find MedicalContent for condition: "${questionData.condition}". Skipping question save.`
          );
          continue;
        }

        await prisma.preGeneratedQuestion.create({
          data: {


            id: uuidv4(),
            questionType: 'image',
            system: questionData.system,
            conditionId: questionData.condition,
            medicalContentId: medicalContent.id,
            difficulty: 'medium',
            questionData: {
              question: questionData.question,
              options: questionData.options,
              correctAnswerIndex: questionData.correctAnswerIndex,
              rationale: questionData.rationale,
              pearls: questionData.pearls,
              topic: questionData.topic,
              condition: questionData.condition,
              source: 'IMAGE_GEN_V1',
              imageUrl: `/assets/clinical-images/${file}`,
            },
          },
        });
        console.log(`Successfully saved question for ${questionData.condition}`);
      } catch (dbError) {
        console.error(`Error saving question for ${questionData.condition} to database:`, dbError);
      }
    }
  }

  console.log('Image-based question generation complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
