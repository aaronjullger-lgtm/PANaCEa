// functions/geminiProxy.ts
// Cloudflare Pages Function for Gemini API proxy

import { GoogleGenerativeAI } from "@google/generative-ai";

// Cloudflare Pages Function context type
interface CloudflareContext {
  request: Request;
  env: {
    GEMINI_API_KEY?: string;
  };
}

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

// Cloudflare Pages Functions use a different interface than Netlify
export async function onRequestPost(context: CloudflareContext) {
  const { request, env } = context;

  try {
    // Get API key from environment
    const apiKey = env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY environment variable is not set" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Parse the request body
    const body = await request.json();
    const { modelName, prompt, temperature } = body;

    if (!modelName || !prompt) {
      return new Response(
        JSON.stringify({ error: "modelName and prompt are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: typeof temperature === "number" ? temperature : 0.8,
      },
    });

    const rawText = result.response.text() || "";
    const text = stripCodeFences(rawText);

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in geminiProxy:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ 
        error: "Gemini proxy error",
        details: errorMessage 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
