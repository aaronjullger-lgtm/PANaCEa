import { GoogleGenAI, Type } from "@google/genai";
import { PANCE_TOPICS, TOPIC_MAP, ABBREVIATION_TO_TOPIC_MAP, PANCE_DECK, TASK_DECK } from '../constants';
import type { Question, SessionSettings } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const questionSchema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING, description: "The PANCE-style question text. It should always contain a clinical vignette or scenario followed by a clear, single-sentence question." },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of exactly 4 string options for the multiple-choice question."
    },
    correctAnswerIndex: { type: Type.INTEGER, description: "The 0-based index of the correct answer in the 'options' array." },
    rationale: { type: Type.STRING, description: "A brief but comprehensive explanation for why the correct answer is right. This string MUST use simple HTML tags like <b> and <i> for formatting, not markdown." },
    topic: { type: Type.STRING, description: `The specific topic of the question, which must be one of: ${PANCE_TOPICS.join(', ')}.` },
    condition: { type: Type.STRING, description: "The name of the primary medical condition being tested (e.g., 'Myocardial Infarction')." },
    pearls: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "An array of 3-4 single, high-yield sentences about the condition. Each pearl must be a complete sentence and clinically relevant (e.g., 'First-line Abortive Tx: Triptans and NSAIDs.'). Each pearl string MUST use simple HTML tags like <b> and <i> for formatting, not markdown." 
    }
  },
  required: ['question', 'options', 'correctAnswerIndex', 'rationale', 'topic', 'condition', 'pearls']
};

let shuffledContentQueue: string[] = [];
let shuffledTaskQueue: string[] = [];
let recentQuestionHistory: string[] = [];
const RECENT_HISTORY_COUNT = 10; // Increased to avoid repetition in larger decks

export function refillShuffledContentQueue() {
  const deck = [...PANCE_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  shuffledContentQueue = deck;
}

export function refillShuffledTaskQueue() {
  const deck = [...TASK_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  shuffledTaskQueue = deck;
}

export async function fetchNewQuestion(settings: SessionSettings, growthAreas: string[]): Promise<Question> {
  const { focus, difficulty } = settings;

  let detailedDifficultyInstruction = '';
  switch (difficulty) {
    case 'easier':
      detailedDifficultyInstruction = "Generate an 'Easier' question. This question should be easier than a standard PANCE question and must test the foundational characteristics of a common, core topic. Focus on 'classic' textbook presentations and first-order knowledge to help me build competence.";
      break;
    case 'same':
      detailedDifficultyInstruction = "Generate a 'PANCE-level' question. This question must be on-par with the difficulty of a real PANCE question. It should be a clinical vignette with plausible distractors that tests second-order thinking (e.g., diagnosis, management, or next diagnostic step).";
      break;
    case 'harder':
      detailedDifficultyInstruction = "Generate a 'Harder' question that is more difficult than a standard PANCE question. You can do this by using a complex patient (multiple comorbidities), testing a less common 'zebra' condition, or asking a multi-step reasoning question (e.g., 'What is the mechanism of action of the second-line treatment for this complex patient?').";
      break;
  }

  const uniquenessInstruction = recentQuestionHistory.length > 0
    ? `Critically, avoid generating a question that is substantively or thematically similar to any of these recently generated questions: \n- "${recentQuestionHistory.join('"\n- "')}"`
    : "Avoid generating questions that are substantively identical or too similar to common practice questions. The goal is to provide a fresh challenge.";

  let prompt = '';
  
  if (focus === 'all') {
    if (shuffledContentQueue.length === 0) {
      refillShuffledContentQueue();
    }
    const contentTopicAbbr = shuffledContentQueue.pop()!;
    const fullContentTopicName = ABBREVIATION_TO_TOPIC_MAP[contentTopicAbbr];

    if (contentTopicAbbr === 'PRO') {
       prompt = `Generate one new, unique, PANCE-style multiple-choice question on the topic of "Professional Practice".

        **Difficulty:**
        ${detailedDifficultyInstruction}

        **Core Instructions:**
        1.  **Scenario-Based:** The question must present a realistic scenario involving professional practice issues relevant to PAs, such as medical ethics, legal responsibilities, patient safety, or public health principles.
        2.  **Plausible Options:** The options must represent plausible courses of action or interpretations of the scenario, with one clear best answer according to current professional standards.
        3.  **HTML Formatting:** The 'rationale' string and all strings in the 'pearls' array MUST use simple HTML tags (<b>, <i>) for formatting, NOT markdown symbols like ** or _. This is a strict requirement for rendering.
        4.  **Key Pearls Formatting:** The 'pearls' array MUST contain 3-4 single, high-yield sentences related to the core principle being tested. Each sentence must be concise and a complete thought. For example: "Informed consent requires discussing risks, benefits, and alternatives with a patient who has decision-making capacity.". Do NOT use short keywords or long paragraphs.
        5.  **Uniqueness:** ${uniquenessInstruction}
        6.  **Topic:** The topic in the JSON output MUST be "Professional Practice".
        
        **Output Format:**
        Return this as a single JSON object that adheres to the provided schema.`;
    } else {
        if (shuffledTaskQueue.length === 0) {
            refillShuffledTaskQueue();
        }
        const taskTopic = shuffledTaskQueue.pop()!;

        prompt = `Generate one new, unique, PANCE-style multiple-choice question for the topic "${fullContentTopicName}" that specifically tests the task of "${taskTopic}".

        **Difficulty:**
        ${detailedDifficultyInstruction}

        **Core Instructions:**
        1.  **Vignette with Subtle Red Herring:** The question must contain a patient case/vignette. Crucially, the vignette MUST include one subtle, not immediately obvious, 'red herring' detail—an unrelated lab finding, a minor symptom, or a well-controlled comorbidity not relevant to the final diagnosis. This tests the ability to identify critical information.
        2.  **Task-Focused Question:** The vignette must conclude with a clear, single-sentence question that directly relates to the specified task ("${taskTopic}").
        3.  **Plausible, Crafted Distractors:** The three distractors MUST be highly plausible and carefully crafted. They should represent common misconceptions, correct treatments for a slightly different presentation, or common mistakes a student would make. Avoid throw-away options.
        4.  **Vignette Formatting:** When you generate the question string, you MUST format the main vignette text by inserting \\n (newline) characters to separate key paragraphs. Do not create a single 'wall of text'. This is a strict formatting requirement.
        5.  **Data Table Formatting:** If the vignette includes vitals or lab results, you MUST format them using a simple HTML <table>. The table must have a header row. Example: <table><thead><tr><th>Vitals</th><th>Value</th></tr></thead><tbody><tr><td>BP</td><td>170/95 mmHg</td></tr><tr><td>HR</td><td>98 bpm</td></tr></tbody></table>. This is a strict formatting requirement.
        6.  **HTML Formatting:** The 'rationale' string and all strings in the 'pearls' array MUST use simple HTML tags (<b>, <i>) for formatting, NOT markdown symbols like ** or _. This is a strict requirement for rendering.
        7.  **Key Pearls Formatting:** The 'pearls' array MUST contain 3-4 single, high-yield sentences. Each sentence must be concise, a complete thought, and clinically relevant. For example: "Classic Sx: Unilateral, pulsating headache, often accompanied by photophobia and phonophobia.". Do NOT use short keywords or long paragraphs.
        8.  **Uniqueness:** ${uniquenessInstruction}
        9.  **Topic:** The topic in the JSON output MUST be "${fullContentTopicName}".

        **Output Format:**
        Return this as a single JSON object that adheres to the provided schema. The question must be high-quality and suitable for a physician assistant student studying for their board exam.`;
    }
  } else {
    // This logic is preserved for specialized session types like 'Growth' or single-topic review.
    let topicInstruction = '';
    if (focus === 'topic' && settings.topic) {
        const fullTopicName = ABBREVIATION_TO_TOPIC_MAP[settings.topic] || settings.topic;
        topicInstruction = `The topic for this question MUST be exactly: "${fullTopicName}". Do not choose any other topic.`;
    } else if (focus === 'growth' && growthAreas.length > 0) {
        const fullGrowthAreas = growthAreas.map(abbr => ABBREVIATION_TO_TOPIC_MAP[abbr] || abbr).join(', ');
        topicInstruction = `First, you must pick one (and only one) topic from this list of the user's growth areas: [${fullGrowthAreas}].`;
    } else { // Fallback case
        topicInstruction = `First, you must pick one (and only one) topic from this exact list: [${PANCE_TOPICS.join(', ')}].`;
    }
        
    prompt = `Generate one new, unique, PANCE-style multiple-choice question.

    **Core Instructions:**
    1.  **Vignette with Subtle Red Herring:** The question must contain a patient case/vignette with a subtle 'red herring' detail.
    2.  **Second-Order Questions:** Generate a mix of 'second-order' questions (e.g., 'most appropriate initial diagnostic test?', 'mechanism of action?').
    3.  **Plausible, Crafted Distractors:** The three distractors MUST be highly plausible.
    4.  **Vignette Formatting:** When you generate the question string, you MUST format the main vignette text by inserting \\n (newline) characters to separate key paragraphs. Do not create a single 'wall of text'.
    5.  **Data Table Formatting:** If the vignette includes vitals or lab results, you MUST format them using a simple HTML <table>. The table must have a header row. Example: <table><thead><tr><th>Vitals</th><th>Value</th></tr></thead><tbody><tr><td>BP</td><td>170/95 mmHg</td></tr><tr><td>HR</td><td>98 bpm</td></tr></tbody></table>. This is a strict formatting requirement.
    6.  **HTML Formatting:** The 'rationale' string and all strings in the 'pearls' array MUST use simple HTML tags (<b>, <i>) for formatting, NOT markdown symbols like ** or _. This is a strict requirement for rendering.
    7.  **Key Pearls Formatting:** The 'pearls' array MUST contain 3-4 single, high-yield sentences. Each sentence must be concise, a complete thought, and clinically relevant. For example: "Classic Sx: Unilateral, pulsating headache, often accompanied by photophobia and phonophobia.". Do NOT use short keywords or long paragraphs.
    8.  **Uniqueness:** ${uniquenessInstruction}

    **Topic and Difficulty:**
    *   ${topicInstruction}
    *   ${detailedDifficultyInstruction}

    **Output Format:**
    Return this as a single JSON object that adheres to the provided schema.`;
  }
  
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: questionSchema,
            temperature: 0.8
        },
    });

    const jsonString = response.text;
    
    try {
        const parsed = JSON.parse(jsonString);

        if (
          !parsed.question ||
          !parsed.question.includes('?') ||
          !Array.isArray(parsed.options) ||
          parsed.options.length !== 4 ||
          typeof parsed.correctAnswerIndex !== 'number' ||
          !parsed.rationale ||
          !parsed.topic ||
          !parsed.condition ||
          !Array.isArray(parsed.pearls)
        ) {
          console.warn("Received malformed JSON data from API, retrying once...", parsed);
          return fetchNewQuestion(settings, growthAreas);
        }

        if (recentQuestionHistory.length >= RECENT_HISTORY_COUNT) {
            recentQuestionHistory.shift();
        }
        recentQuestionHistory.push(parsed.question);

        const topicAbbreviation = TOPIC_MAP[parsed.topic] || parsed.topic;
         if (!TOPIC_MAP[parsed.topic]) {
          console.warn(`API returned an unknown topic "${parsed.topic}". Storing it as-is.`);
        }
        
        return { ...parsed, topic: topicAbbreviation } as Question;

    } catch (parseError) {
        console.error("Failed to parse the JSON extracted from the API response. String that failed:", jsonString);
        console.error("Original parsing error:", parseError);
        throw new Error("The API returned a malformed JSON response. Please try again.");
    }

  } catch (error) {
    console.error("Error during fetchNewQuestion:", error);
    if (error instanceof Error && (error.message.startsWith("The API returned an invalid response") || error.message.startsWith("The API returned a malformed JSON"))) {
        throw error;
    }
    throw new Error("Failed to generate a new question. Please check your Gemini API key and network connection.");
  }
}

export async function prefetchQuestions(count: number, settings: SessionSettings, growthAreas: string[]): Promise<Question[]> {
  const questions: Question[] = [];
  for (let i = 0; i < count; i++) {
    const question = await fetchNewQuestion(settings, growthAreas);
    questions.push(question);
  }
  return questions;
}

export async function generateContent(type: 'study-guide' | 'flashcards', topic: string, useProModel: boolean): Promise<string> {
  let prompt: string;
  const fullTopicName = ABBREVIATION_TO_TOPIC_MAP[topic] || topic;

  if (type === 'study-guide') {
    prompt = `Generate a concise, high-yield study guide for a PA student on the PANCE topic: "${fullTopicName}". Focus on pathophysiology, clinical presentation, diagnosis, and treatment. Format it clearly with headings and bullet points.`;
  } else {
    prompt = `Generate 10 high-yield PANCE flashcards for the topic "${fullTopicName}". Format them clearly and consistently as "Q: [Question]\\nA: [Answer]\\n\\n".`;
  }
  
  const model = useProModel ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
  const config = useProModel 
    ? { thinkingConfig: { thinkingBudget: 32768 }, temperature: 0.5 }
    : { temperature: 0.7 };

  try {
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config
    });
    return response.text;
  } catch (error) {
    console.error("Error generating content:", error);
    throw new Error("Failed to generate content. The API may be busy or an error occurred.");
  }
}

export async function generateAlternateRationale(question: Question, userAnswer: string, correctAnswer: string): Promise<string> {
    const prompt = `You are an expert medical tutor for a Physician Assistant student. The student answered a practice question incorrectly. Your task is to provide a new, comparative explanation.

**The Question:**
${question.question}

**The Correct Answer:**
"${correctAnswer}"

**The Student's Incorrect Answer:**
"${userAnswer}"

**Original Rationale (for your context only):**
${question.rationale}

**Your Task:**
Explain this differently.
1.  Directly address why the student's choice ("${userAnswer}") is incorrect for this specific patient.
2.  Then, explain why "${correctAnswer}" is the best choice, highlighting the key details from the question that support it.
3.  Maintain a supportive, educational tone. Do not just repeat the original rationale; provide a fresh perspective.
4.  Format your response clearly. Use paragraphs and bullet points for readability.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.6
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error generating alternate rationale:", error);
        throw new Error("Failed to generate an explanation. The API may be busy or an error occurred.");
    }
}