import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || "test";
const client = new GoogleGenAI({ apiKey });

console.log("Default apiVersion:", client.apiVersion);
