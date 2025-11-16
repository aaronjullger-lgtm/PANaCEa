// netlify/functions/geminiProxy.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  // This will appear in Netlify function logs if the env var is missing
  console.error("GEMINI_API_KEY is not set in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Netlify Function handler
export const handler = async (event: any) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // Parse request body
    const { modelName, prompt, temperature } = JSON.parse(event.body || "{}");

    if (!prompt || !modelName) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "modelName and prompt are required" }),
      };
    }

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Server is missing GEMINI_API_KEY" }),
      };
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: typeof temperature === "number" ? temperature : 0.8,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (err: any) {
    console.error("Error in geminiProxy:", err);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to call Gemini",
        details: err?.message || "Unknown error",
      }),
    };
  }
};
