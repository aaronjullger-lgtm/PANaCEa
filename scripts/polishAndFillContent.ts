import { PrismaClient, Prisma } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '', apiVersion: 'v1beta' });

const sectionPrompts: Record<string, string> = {
  overview: 'Define the medical condition clearly. Provide a high-yield summary.',
  etiology:
    'Describe the causes (e.g., infectious agents, genetic mutations, environmental exposures).',
  pathophysiology:
    "Explain the underlying biological mechanism of disease. Describe the 'how' and 'why'. Include key inflammatory mediators, genetic defects, or physiological disruptions.",
  epidemiology: 'Describe who gets this condition (age, sex, demographics, incidence/prevalence).',
  symptoms:
    "List the hallmark symptoms and patient complaints. Highlight classic presentations (e.g., 'worst headache of life').",
  physicalExam:
    "List the key physical exam findings. Include vital signs, inspection, palpation, auscultation, and any named signs (e.g., McBurney's point).",
  diagnostics:
    'Outline the diagnostic approach. Include initial tests (labs, imaging) and the gold standard for diagnosis.',
  treatment:
    'Outline the management strategy. Structure strictly into: \n1. **Acute/Emergency Management** (if applicable)\n2. **Pharmacotherapy** (First-line, Alternatives)\n3. **Non-pharmacologic/Surgical interventions**.\nMention specific drug classes and names.',
  prognosis: 'Describe the expected course of the disease and potential outcomes.',
  differentialDiagnosis: 'List the key differential diagnoses to consider.',
  riskFactors: 'List the key risk factors (demographic, lifestyle, genetic, comorbid conditions).',
  complications: 'List the potential sequelae or complications if left untreated.',
  buzzwords: "List high-yield 'buzzwords' or classic associations often seen on board exams.",
};

async function generateOrPolishContent(
  condition: string,
  section: string,
  currentContent: string | string[] | object | null
): Promise<string | string[] | object | null> {
  const isPolish =
    currentContent !== null &&
    currentContent !== 'Content pending generation.' &&
    (Array.isArray(currentContent) ? currentContent.length > 0 : true);
  const action = isPolish ? 'Rewrite and Improve' : 'Generate';
  const isListSection = [
    'symptoms',
    'riskFactors',
    'complications',
    'physicalExam',
    'differentialDiagnosis',
    'buzzwords',
  ].includes(section);
  // const isJsonSection = ['diagnostics', 'treatment'].includes(section); // Removed: Treat as text

  console.log(`${action} ${section} for ${condition}...`);

  const specificInstruction = sectionPrompts[section] || 'Be concise, high-yield, and accurate.';

  let prompt = `
    You are a medical education expert creating content for PA students preparing for the PANCE.
    
    Target Audience: Physician Assistant students.
    Tone: Professional, academic, high-yield, concise.
    
    Task: ${action} the "${section}" section for the medical condition: "${condition}".
    
    DEFINITION OF "${section}":
    ${specificInstruction}
    
    General Requirements:
    - Be concise, high-yield, and accurate.
    - Use Markdown formatting (bolding key terms).
    - Do NOT include the section title in the output.
    - Do NOT include "Here is the content..." or similar conversational filler.
  `;

  if (isListSection) {
    prompt += `\n- Return the output strictly as a JSON array of strings. Example: ["Symptom 1", "Symptom 2"]`;
  } else {
    prompt += `\n- Return the output as a well-formatted Markdown string.`;
  }

  if (isPolish) {
    let contentStr = '';
    if (Array.isArray(currentContent)) {
      contentStr = currentContent.join('\n');
    } else if (typeof currentContent === 'object' && currentContent !== null) {
      // If it was previously stored as { content: "..." }, extract the content
      if ('content' in currentContent) {
        contentStr = (currentContent as any).content;
      } else {
        contentStr = JSON.stringify(currentContent);
      }
    } else {
      contentStr = String(currentContent);
    }

    prompt += `\n\nSOURCE MATERIAL (Current Content):
    ${contentStr}
    
    INSTRUCTION FOR SOURCE MATERIAL:
    - Use the Source Material as a reference for facts, BUT...
    - IF the Source Material discusses topics OUTSIDE the "DEFINITION OF ${section}" (e.g., diagnostic steps in an Overview), YOU MUST DISCARD THAT INFORMATION.
    - Do not simply copy the Source Material. Rewrite it to match the Definition and Tone.
    `;
  }

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: isListSection ? { responseMimeType: 'application/json' } : undefined,
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (isListSection) {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.warn(`Failed to parse JSON for ${section}, falling back to text split`, e);
        return text
          .split('\n')
          .map((line) => line.replace(/^[\*\-•]\s*/, '').trim())
          .filter((line) => line.length > 0);
      }
    }

    // Removed isJsonSection logic; return text directly
    return text.trim();
  } catch (error) {
    console.error(`Error processing ${condition} (${section}):`, error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting content polish and fill...');

  const START_AFTER_ID = 'dc720be4-4a36-4807-96e5-501fa11e3208';

  // Fetch all conditions (just IDs and names to avoid size limits)
  let conditions = await prisma.medicalContent.findMany({
    orderBy: { condition: 'asc' },
    select: { id: true, condition: true },
  });

  if (START_AFTER_ID) {
    const startIndex = conditions.findIndex((c) => c.id === START_AFTER_ID);
    if (startIndex !== -1) {
      console.log(`Skipping to start at: ${START_AFTER_ID}`);
      // Start AT the found ID (include it)
      conditions = conditions.slice(startIndex);
    } else {
      console.log(`Start ID ${START_AFTER_ID} not found, starting from beginning.`);
    }
  }

  console.log(`Found ${conditions.length} conditions to process. Processing with concurrency...`);

  const CONCURRENCY = 3;

  for (let i = 0; i < conditions.length; i += CONCURRENCY) {
    const batch = conditions.slice(i, i + CONCURRENCY);
    console.log(
      `\n--- Processing Batch ${Math.floor(i / CONCURRENCY) + 1} of ${Math.ceil(conditions.length / CONCURRENCY)} ---`
    );

    await Promise.all(
      batch.map(async (item) => {
        console.log(`Starting ${item.condition}...`);

        // Fetch full record for processing
        const record = await prisma.medicalContent.findUnique({
          where: { id: item.id },
        });

        if (!record) return;

        const updates: any = {};

        // Fields to process
        const fields = [
          'overview',
          'etiology',
          'pathophysiology',
          'epidemiology',
          'symptoms',
          'physicalExam',
          'diagnostics',
          'treatment',
          'prognosis',
          'differentialDiagnosis',
          'riskFactors',
          'complications',
          'buzzwords',
        ];

        for (const field of fields) {
          const currentVal = (record as any)[field];
          // Generate or polish
          const result = await generateOrPolishContent(record.condition, field, currentVal);

          if (result) {
            updates[field] = result;
          }

          // Rate limit per field to avoid hitting TPM limits too fast
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (Object.keys(updates).length > 0) {
          await prisma.medicalContent.update({
            where: { id: record.id },
            data: updates,
          });
          console.log(`✅ Updated ${record.condition}`);
        }
      })
    );
  }

  console.log('✨ Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
