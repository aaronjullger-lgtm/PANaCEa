/**
 * Gemini Service - Wrapper for Google Generative AI API
 * 
 * Database-First Architecture: This service provides AI text generation
 * capabilities for dynamic content generation.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Call Gemini API for text generation
 * 
 * @param model - The Gemini model to use (e.g., 'gemini-1.5-flash')
 * @param prompt - The prompt to send to the model
 * @param temperature - Temperature for response randomness (0.0-1.0)
 * @returns The generated text response
 */
export async function callGeminiText(
  model: string,
  prompt: string,
  temperature: number = 0.7
): Promise<string> {
  try {
    const generativeModel = genAI.getGenerativeModel({ 
      model,
      generationConfig: {
        temperature,
      }
    });

    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Call Gemini API with streaming support
 * 
 * @param model - The Gemini model to use
 * @param prompt - The prompt to send to the model
 * @param temperature - Temperature for response randomness
 * @returns Async iterable of text chunks
 */
export async function* callGeminiStream(
  model: string,
  prompt: string,
  temperature: number = 0.7
): AsyncGenerator<string, void, unknown> {
  try {
    const generativeModel = genAI.getGenerativeModel({ 
      model,
      generationConfig: {
        temperature,
      }
    });

    const result = await generativeModel.generateContentStream(prompt);
    
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  } catch (error) {
    console.error('Gemini streaming error:', error);
    throw new Error(`Failed to stream content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Call Gemini API with image input
 * 
 * @param model - The Gemini model to use (must support vision)
 * @param prompt - The text prompt
 * @param imageData - Base64 encoded image data
 * @param mimeType - MIME type of the image
 * @returns The generated text response
 */
export async function callGeminiVision(
  model: string,
  prompt: string,
  imageData: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  try {
    const generativeModel = genAI.getGenerativeModel({ model });

    const imagePart = {
      inlineData: {
        data: imageData,
        mimeType,
      },
    };

    const result = await generativeModel.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini vision error:', error);
    throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Call Gemini API with structured JSON output
 * 
 * @param model - The Gemini model to use
 * @param prompt - The prompt (should request JSON output)
 * @param temperature - Temperature for response randomness
 * @returns Parsed JSON object
 */
export async function callGeminiJSON<T = any>(
  model: string,
  prompt: string,
  temperature: number = 0.7
): Promise<T> {
  try {
    const text = await callGeminiText(model, prompt, temperature);
    
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    const cleanedText = jsonMatch ? jsonMatch[1].trim() : text.trim();
    
    return JSON.parse(cleanedText) as T;
  } catch (error) {
    console.error('Gemini JSON parsing error:', error);
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
