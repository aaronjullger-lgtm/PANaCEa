/**
 * AI Routes
 * 
 * Handles AI-related API endpoints, specifically the Gemini proxy.
 * Extracted from server.ts for modularity.
 */

import { Router, Request, Response } from 'express';
import { validateMedicalPrompt } from '../lib/middleware/promptValidation';
import { validateRequired } from '../lib/middleware/validation';

const router = Router();

interface GeminiApiResponse {
    candidates?: {
        content?: {
            parts?: {
                text?: string;
            }[];
        };
    }[];
}

// Gemini proxy endpoint
router.post('/geminiProxy',
    validateRequired(['prompt']),
    async (req: Request, res: Response) => {
        try {
            // Security: Only use server-side environment variables
            const apiKey = process.env.GEMINI_API_KEY;

            if (!apiKey) {
                return res.status(500).json({
                    error: 'Missing API Key configuration on Server'
                });
            }

            // Input validation
            const { modelName = 'gemini-1.5-flash', prompt, temperature = 0.8 } = req.body;

            const { isValid, reason } = validateMedicalPrompt(prompt);
            if (!isValid) {
                console.warn('Blocked prompt injection attempt:', {
                    ip: req.ip,
                    reason,
                });
                return res.status(400).json({
                    error: 'Request rejected by security policy',
                    reason,
                });
            }

            // Call Gemini API
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: "You are a strict medical education assistant. You must only answer questions related to medicine, clinical practice, anatomy, physiology, or the PANaCEa application. If the user asks about anything else (like creative writing, coding, general knowledge, etc.), you must refuse. Do not generate creative content like poems or stories unless they are specifically medical mnemonics requested by the user." }]
                    },
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: temperature },
                }),
            });

            if (!geminiResponse.ok) {
                const errorText = await geminiResponse.text();
                console.error(`Gemini API Error (${geminiResponse.status}):`, errorText);
                return res.status(geminiResponse.status).json({
                    error: 'Gemini Upstream Error',
                    details: errorText
                });
            }

            const geminiData: GeminiApiResponse = await geminiResponse.json();

            let rawText = '';
            if (geminiData.candidates && geminiData.candidates[0]?.content?.parts?.[0]?.text) {
                rawText = geminiData.candidates[0].content.parts[0].text;
            }

            // Strip code fences if present
            let text = rawText.trim();
            if (text.startsWith('```')) {
                const firstNewline = text.indexOf('\n');
                if (firstNewline !== -1) {
                    text = text.substring(firstNewline + 1);
                    if (text.endsWith('```')) {
                        text = text.substring(0, text.length - 3);
                    }
                }
            }

            res.json({ text: text.trim() });
        } catch (error) {
            console.error('Gemini Proxy Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

export default router;
