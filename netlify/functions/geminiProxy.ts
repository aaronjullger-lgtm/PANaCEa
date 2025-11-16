import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing from Netlify Environment Variables.");
}

const genAI = new GoogleGenerativeAI(apiKey);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { prompt, model = 'gemini-2.5-flash', temperature = 0.8 } = payload;

    if (!prompt || typeof prompt !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing or invalid "prompt" field.' }),
      };
    }

    const modelClient = genAI.getGenerativeModel({ model });

    const result = await modelClient.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
      },
    });

    const text = result.response.text();

    // Try to parse JSON server-side so the client gets a clean object
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // If it isn't JSON, return the raw text so the client can decide
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (error: any) {
    console.error('Gemini Proxy Function Runtime Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `The question generation failed. Details: ${error.message || 'Unknown error'}`,
      }),
    };
  }
};
