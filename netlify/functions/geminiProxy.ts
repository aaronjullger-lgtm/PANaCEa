// netlify/functions/geminiProxy.ts

import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Clean up Gemini text so the frontend always gets plain JSON-as-string.
 * - Trims whitespace
 * - Removes ```json ... ``` or ``` ... ``` fences if present
 */
function stripCodeFences(text: string): string {
  if (!text) return "";

  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    // Drop the first line (``` or ```json)
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    }

    // Remove trailing ```
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }

    cleaned = cleaned.trim();
  }

  return cleaned;
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const { modelName, prompt, temperature } = JSON.parse(event.body || "{}");

    if (!modelName || !prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "modelName and prompt are required" }),
      };
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:
          typeof temperature === "number" ? temperature : 0.8,
      },
    });

    const rawText = result.response.text() || "";
    const text = stripCodeFences(rawText);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (error) {
    console.error("Error in geminiProxy:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gemini proxy error" }),
    };
  }
};

export { handler };
