/**
 * Quick test for Gemini 2.0 Flash vision capabilities
 */
import { config } from 'dotenv';
import * as fs from 'fs';

config();

const key = process.env.GEMINI_API_KEY;

async function testGemini() {
  const testImage =
    '/Users/aaronullger/PANaCEa/DATA/DATA/curated_images/ECG/Atrial_Fibrillation_3890.jpg';

  if (!fs.existsSync(testImage)) {
    console.log('Test image not found at:', testImage);
    process.exit(1);
  }

  console.log('Testing Gemini 2.0 Flash with ECG image...');

  const imageBuffer = fs.readFileSync(testImage);
  const base64Image = imageBuffer.toString('base64');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: 'What medical condition does this ECG show? Be brief.' },
              { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
            ],
          },
        ],
      }),
    }
  );

  console.log('Status:', response.status);
  const data = await response.json();

  if (response.ok) {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('✅ Analysis:', text);
  } else {
    console.log('❌ Error:', JSON.stringify(data, null, 2));
  }
}

testGemini().catch(console.error);
