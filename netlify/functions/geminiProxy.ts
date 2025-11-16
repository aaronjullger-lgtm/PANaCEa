// netlify/functions/geminiProxy.ts
import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in Netlify environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey);

export const handler: Handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { modelName, prompt, temperature } = JSON.parse(event.body || "{}");

    if (!modelName || !prompt) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "modelName and prompt are required" }),
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
  } catch (err) {
    console.error("Error in geminiProxy:", err);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to call Gemini" }),
    };
  }
};
