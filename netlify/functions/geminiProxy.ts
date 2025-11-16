// netlify/functions/geminiProxy.ts
import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in Netlify environment");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const handler: Handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    if (!genAI || !apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "GEMINI_API_KEY is not configured on the server",
        }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const modelName = body.modelName as string | undefined;
    const prompt = body.prompt as string | undefined;
    const temperature = (body.temperature as number | undefined) ?? 0.8;

    if (!modelName || !prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "modelName and prompt are required",
        }),
      };
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    console.log("Gemini raw text:", text);

    if (!text || !text.trim()) {
      // This is what was causing your "Empty response from Gemini" error
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Empty response from Gemini" }),
      };
    }

    // IMPORTANT: this shape is what your frontend expects
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    console.error("Error in geminiProxy:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server error talking to Gemini",
      }),
    };
  }
};
