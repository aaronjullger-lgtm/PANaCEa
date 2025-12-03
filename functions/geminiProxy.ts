// functions/geminiProxy.ts
// Cloudflare Pages Function for Gemini API proxy

// 1. Define Types
interface Env {
  GEMINI_API_KEY?: string;
  VITE_GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

interface RequestBody {
  modelName: string;
  prompt: string;
  temperature?: number;
}

interface GeminiAPIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

// 2. Helper Functions
function stripCodeFences(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();
  }
  return cleaned;
}

// 3. Handle OPTIONS requests (CORS Preflight)
// This fixes CORS errors when calling from the frontend
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// 4. Handle GET requests (Crucial for Debugging)
// Allows you to visit /geminiProxy in the browser to confirm it exists
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { env } = context;
  const hasKey = !!(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.GOOGLE_API_KEY);
  
  return new Response(
    JSON.stringify({ 
      status: "Alive", 
      message: "Gemini Proxy is running!", 
      hasApiKey: hasKey 
    }),
    {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
    }
  );
}

// 5. Handle POST requests (The Main Logic)
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  
  try {
    // Get API key from environment (try multiple names)
    const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      console.error("Missing API Key on Server");
      return new Response(
        JSON.stringify({ error: "Missing API Key configuration on Server" }),
        {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
          },
        }
      );
    }

    // Parse Body
    let body: RequestBody;
    try {
      body = await request.json() as RequestBody;
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }
    
    const { modelName = "gemini-1.5-flash", prompt, temperature = 0.8 } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: temperature },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`Gemini API Error (${geminiResponse.status}):`, errorText);
      return new Response(
        JSON.stringify({ error: "Gemini Upstream Error", details: errorText }),
        { 
          status: geminiResponse.status, 
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        }
      );
    }

    const geminiData = await geminiResponse.json() as GeminiAPIResponse;
    
    let rawText = "";
    if (geminiData.candidates && geminiData.candidates[0]?.content?.parts?.[0]?.text) {
      rawText = geminiData.candidates[0].content.parts[0].text;
    }

    const text = stripCodeFences(rawText);

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
    });

  } catch (error) {
    console.error("Critical Error in geminiProxy:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: errorMessage }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      }
    );
  }
}
