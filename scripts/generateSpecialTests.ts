
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function generateSpecialTests() {
  console.log('🩺 Generating Special Tests Content...');

  const conditions = await prisma.condition.findMany({
    // Process all conditions
    include: {
      specialTests: true,
    },
  });

  console.log(`Found ${conditions.length} conditions to process.`);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  let processedCount = 0;
  for (const condition of conditions) {
    processedCount++;
    if (condition.specialTests.length > 0) {
      console.log(`Skipping ${condition.name} (already has special tests)`);
      continue;
    }

    console.log(`[${processedCount}/${conditions.length}] Processing ${condition.name}...`);

    const prompt = `
      For the medical condition "${condition.name}" (System: ${condition.system}), 
      identify the most relevant physical exam "Special Test" used for diagnosis.
      If there are no specific named special tests (e.g. for a general infection), return null.
      
      Return a JSON object with:
      {
        "name": "Name of the test (e.g. Lachman Test)",
        "description": "Brief description of what the test assesses.",
        "technique": "Step-by-step instructions on how to perform the test.",
        "sensitivity": 85, // Estimated sensitivity as a number 0-100
        "specificity": 90, // Estimated specificity as a number 0-100
        "imagePrompt": "A detailed prompt to generate a medical illustration showing the test being performed."
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      if (text.includes('null')) {
        console.log(`No special test for ${condition.name}`);
        continue;
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`Failed to parse JSON for ${condition.name}`);
        continue;
      }
      
      const data = JSON.parse(jsonMatch[0]);

      const specialTest = await prisma.specialTest.upsert({
        where: { name: data.name },
        update: {
          conditions: {
            connect: { id: condition.id }
          }
        },
        create: {
          name: data.name,
          description: data.description,
          technique: data.technique,
          sensitivity: data.sensitivity,
          specificity: data.specificity,
          conditions: {
            connect: { id: condition.id }
          }
        }
      });

      console.log(`✅ Linked ${specialTest.name} to ${condition.name}`);

      // Rate limiting delay (1s)
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`Error processing ${condition.name}:`, error);
    }
  }
}

generateSpecialTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
