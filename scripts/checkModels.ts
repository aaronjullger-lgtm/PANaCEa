import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' });

async function listModels() {
  try {
    const response = await client.models.list();
    console.log('Response:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();