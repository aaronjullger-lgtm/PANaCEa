// functions/geminiProxy.ts
// Cloudflare Pages Function for Gemini API proxy
// Uses direct Fetch API to work in Cloudflare Workers environment

// Cloudflare Pages Function context type
interface Env {
  GEMINI_API_KEY?: string;
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

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // 1. Get the API Key from Cloudflare Environment Variables
  const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing API Key on Server" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // 2. Get the data your website sent
    const requestBody = await request.json();

    // 3. Forward the request to Google Gemini
    // Note: We default to gemini-1.5-flash. If your app expects gemini-pro, change the model name below.
    const model = "gemini-2.5-pro"; 
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const googleResponse = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await googleResponse.json();

    // 4. Send the answer back to your website
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

    // Parse the request body
    let body: RequestBody;
    try {
      body = await request.json() as RequestBody;
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        }
      );
    }
    
    const { modelName, prompt, temperature = 0.8 } = body;

    if (!modelName || !prompt) {
      return new Response(
        JSON.stringify({ error: "modelName and prompt are required" }),
        {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        }
      );
    }

    // Call Gemini API directly using Fetch
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: temperature,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      return new Response(
        JSON.stringify({ 
          error: "Gemini API error",
          details: `Status ${geminiResponse.status}: ${errorText}` 
        }),
        {
          status: geminiResponse.status,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        }
      );
    }

    const geminiData = await geminiResponse.json() as GeminiAPIResponse;
    
    // Extract text from Gemini response
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
    console.error("Error in geminiProxy:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ 
        error: "Gemini proxy error",
        details: errorMessage 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
