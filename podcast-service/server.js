/**
 * Lecture-to-Podcast Node service.
 * POST /generate: body multipart (file = PDF) or { pdfUrl }.
 * Pipeline: PDF text → Gemini 1.5 Pro (script) → Google Cloud TTS → concatenated audio.
 * Returns { script, audioBase64? } or { jobId, status } for async.
 */

import express from 'express';
import multer from 'multer';
import pdf from 'pdf-parse';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const PORT = process.env.PORT || 3001;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
const SCRIPT_SYSTEM = `You are producing a medical education podcast. Convert the following lecture content into a script between 'Dr. Smith' (Expert) and 'Sarah' (Student). Sarah should ask clarifying questions. Output ONLY a JSON array of objects with keys "speaker" and "text". Example: [{"speaker":"Dr. Smith","text":"..."},{"speaker":"Sarah","text":"..."}]. No other text.`;

app.use(express.json({ limit: '10mb' }));

async function extractTextFromPdf(buffer) {
  const data = await pdf(buffer);
  return { text: data.text, pages: data.numpages };
}

async function generateScript(text, apiKey) {
  const truncated = text.slice(0, 900000);
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `System: ${SCRIPT_SYSTEM}\n\nLecture:\n${truncated}` }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${res.status} ${err}`);
  }
  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  return JSON.parse(raw);
}

async function synthesizeSegment(text, voice, client) {
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode: 'en-US', name: voice },
    audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 24000 },
  });
  return response.audioContent;
}

app.post('/generate', upload.single('file'), async (req, res) => {
  try {
    let pdfBuffer = req.file?.buffer;
    if (!pdfBuffer && req.body?.pdfUrl) {
      const r = await fetch(req.body.pdfUrl);
      if (!r.ok) throw new Error('Failed to fetch PDF URL');
      pdfBuffer = Buffer.from(await r.arrayBuffer());
    }
    if (!pdfBuffer) {
      return res.status(400).json({ error: 'Provide multipart file or body.pdfUrl' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

    const { text } = await extractTextFromPdf(pdfBuffer);
    if (!text?.trim()) return res.status(400).json({ error: 'No text extracted from PDF' });

    const script = await generateScript(text, apiKey);
    if (!Array.isArray(script) || script.length === 0) {
      return res.status(502).json({ error: 'Invalid script from Gemini', script });
    }

    const ttsClient = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? new TextToSpeechClient()
      : null;
    let audioBase64 = null;
    if (ttsClient) {
      const voiceA = 'en-US-Journey-D';
      const voiceB = 'en-US-Journey-F';
      const chunks = [];
      for (let i = 0; i < script.length; i++) {
        const seg = script[i];
        const voice = seg.speaker === 'Dr. Smith' ? voiceA : voiceB;
        const audio = await synthesizeSegment(seg.text || '', voice, ttsClient);
        if (audio) chunks.push(audio);
      }
      if (chunks.length > 0) {
        audioBase64 = Buffer.concat(chunks).toString('base64');
      }
    }

    return res.json({
      script,
      audioBase64: audioBase64 ?? undefined,
      message: audioBase64 ? undefined : 'TTS skipped (set GOOGLE_APPLICATION_CREDENTIALS for audio)',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Podcast service listening on port ${PORT}`);
});
