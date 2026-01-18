import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function generateAnatomyContent() {
  console.log('🧠 Generating Anatomy Content...');

  const conditions = await prisma.condition.findMany({
    // Process all conditions
    include: {
      AnatomyStructure: true,
    },
  });

  console.log(`Found ${conditions.length} conditions to process.`);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  let processedCount = 0;
  for (const condition of conditions) {
    processedCount++;
    if (condition.AnatomyStructure.length > 0) {
      console.log(`Skipping ${condition.name} (already has anatomy)`);
      continue;
    }

    console.log(`[${processedCount}/${conditions.length}] Processing ${condition.name}...`);

    const prompt = `
      For the medical condition "${condition.name}" (System: ${condition.system}), 
      identify the single most relevant anatomical structure that is affected or involved.
      
      Return a JSON object with:
      {
        "name": "Name of the structure (e.g. Anterior Cruciate Ligament)",
        "system": "Organ system (e.g. MSK)",
        "region": "Body region (e.g. Knee)",
        "description": "Brief description of the structure's normal function and how it relates to the condition.",
        "imagePrompt": "A detailed prompt to generate a medical illustration of this structure, highlighting the pathology."
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`Failed to parse JSON for ${condition.name}`);
        continue;
      }

      const data = JSON.parse(jsonMatch[0]);

      // Upsert AnatomyStructure
      const anatomy = await prisma.anatomyStructure.upsert({
        where: { name: data.name },
        update: {
          Condition: {
            connect: { id: condition.id },
          },
        },
        create: {
          name: data.name,
          system: data.system,
          region: data.region,
          description: data.description,
          // We store the prompt in description or a separate field?
          // For now, let's append it to description or just log it.
          // The schema has imageUrl, but we don't have an image yet.
          Condition: {
            connect: { id: condition.id },
          },
        },
      });

      console.log(`✅ Linked ${anatomy.name} to ${condition.name}`);

      // Rate limiting delay (1s)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing ${condition.name}:`, error);
    }
  }
}

generateAnatomyContent()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
