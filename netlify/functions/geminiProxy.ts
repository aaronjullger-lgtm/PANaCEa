// netlify/functions/geminiProxy.ts
import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  // This only runs in the Netlify function environment, not in the browser
  console.error("GEMINI_API_KEY is not set in environment variables");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const handler: Handler = async (event) => {
  try {
    // Only allow POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    if (!apiKey || !genAI) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Server is missing GEMINI_API_KEY",
        }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing request body" }),
      };
    }

    const parsedBody = JSON.parse(event.body);
    const modelName = typeof parsedBody.modelName === "string"
      ? parsedBody.modelName
      : "gemini-2.5-flash";
    const prompt = parsedBody.prompt as string;
    const temperature =
      typeof parsedBody.temperature === "number"
        ? parsedBody.temperature
        : 0.8;

    if (!prompt || typeof prompt !== "string") {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid or missing prompt" }),
      };
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature,
        // Keep this modest to avoid long responses / timeouts
        maxOutputTokens: 768,
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
    console.error("Gemini proxy error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Gemini proxy error",
      }),
    };
  }
};
