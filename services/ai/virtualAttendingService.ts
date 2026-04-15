import { callGeminiText } from './geminiService';
import { GEMINI_FLASH_MODEL } from "@/config/topic-map";

/**
 * Virtual Attending Personas Service
 * Provides different feedback styles from virtual attending personas
 * Phase 17: Requirement 66
 */

export type AttendingPersona = 'nurturer' | 'surgeon' | 'professor' | 'comedian' | 'drill-sergeant';

export interface PersonaProfile {
  id: AttendingPersona;
  name: string;
  description: string;
  icon: string;
  correctFeedbackStyle: string;
  incorrectFeedbackStyle: string;
}

export const ATTENDING_PERSONAS: Record<AttendingPersona, PersonaProfile> = {
  nurturer: {
    id: 'nurturer',
    name: 'The Nurturer',
    description: 'Supportive and encouraging, focuses on growth and learning',
    icon: '🤗',
    correctFeedbackStyle: 'encouraging',
    incorrectFeedbackStyle: 'supportive',
  },
  surgeon: {
    id: 'surgeon',
    name: 'The Surgeon',
    description: 'Direct and intense, emphasizes high stakes and consequences',
    icon: '🔪',
    correctFeedbackStyle: 'brief',
    incorrectFeedbackStyle: 'harsh',
  },
  professor: {
    id: 'professor',
    name: 'The Professor',
    description: 'Educational and thorough, provides detailed explanations',
    icon: '👨‍🏫',
    correctFeedbackStyle: 'educational',
    incorrectFeedbackStyle: 'teaching',
  },
  comedian: {
    id: 'comedian',
    name: 'The Comedian',
    description: 'Light-hearted and funny, makes learning enjoyable',
    icon: '😄',
    correctFeedbackStyle: 'humorous',
    incorrectFeedbackStyle: 'playful',
  },
  'drill-sergeant': {
    id: 'drill-sergeant',
    name: 'The Drill Sergeant',
    description: 'Tough and motivating, pushes you to excellence',
    icon: '🎖️',
    correctFeedbackStyle: 'military',
    incorrectFeedbackStyle: 'demanding',
  },
};

interface FeedbackParams {
  isCorrect: boolean;
  topic: string;
  condition?: string;
  keyLearning?: string;
}

/**
 * Generate personalized feedback based on attending persona
 */
export async function generatePersonalizedFeedback(
  persona: AttendingPersona,
  params: FeedbackParams
): Promise<string> {
  const { isCorrect, topic, condition, keyLearning } = params;
  const personaProfile = ATTENDING_PERSONAS[persona];

  // Fallback to static templates if API fails or for immediate response
  const fallback = isCorrect
    ? generateCorrectFeedback(persona, topic, condition)
    : generateIncorrectFeedback(persona, topic, condition, keyLearning);

  try {
    const prompt = `
      You are acting as a virtual medical attending with a specific persona.
      
      Persona Name: ${personaProfile.name}
      Persona Description: ${personaProfile.description}
      Feedback Style: ${isCorrect ? personaProfile.correctFeedbackStyle : personaProfile.incorrectFeedbackStyle}
      
      Task: Generate a short (1-2 sentences) feedback message for a medical student.
      
      Context:
      - The student answered ${isCorrect ? 'CORRECTLY' : 'INCORRECTLY'}.
      - Topic: ${topic}
      - Specific Condition: ${condition || 'N/A'}
      - Key Learning Point: ${keyLearning || 'N/A'}
      
      Requirements:
      - Stay strictly in character.
      - Be concise.
      - If incorrect, mention the key learning point in character.
      - If correct, reinforce the knowledge.
      - Use emojis appropriate for the persona if applicable.
    `;

    const response = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.7);
    return response.trim();
  } catch (error) {
    console.error('Error generating persona feedback:', error);
    return fallback;
  }
}

/**
 * Generate feedback for correct answers
 */
function generateCorrectFeedback(
  persona: AttendingPersona,
  topic: string,
  condition?: string
): string {
  const templates = {
    nurturer: [
      `Excellent work! 🌟 You're really mastering ${topic}.`,
      `That's right! I'm so proud of your progress with ${condition || topic}.`,
      `Perfect! You've got this down. Keep up the amazing work!`,
      `Yes! Your understanding of ${topic} is growing beautifully.`,
    ],
    surgeon: [
      `Correct. Patient lives.`,
      `Right. You didn't kill anyone this time.`,
      `Good. That's the standard. Don't celebrate mediocrity.`,
      `Acceptable. Move to the next case.`,
    ],
    professor: [
      `Correct! This demonstrates your understanding of the pathophysiology of ${condition || topic}.`,
      `Excellent! Let me expand on why this is the right answer...`,
      `Precisely! Note how this fits into the broader clinical picture of ${topic}.`,
      `Well done! This shows mastery of the key concepts in ${topic}.`,
    ],
    comedian: [
      `Ding ding ding! Someone's been studying!`,
      `Look at you, Dr. Smartypants! That's correct!`,
      `Nailed it! Your brain is on fire today (in a good way, not meningitis).`,
      `Boom! Correct! High five! (Don't leave me hanging)`,
    ],
    'drill-sergeant': [
      `CORRECT! But don't get cocky, soldier!`,
      `AFFIRMATIVE! That's what I expect from my unit!`,
      `ROGER THAT! Now lock it in and move forward!`,
      `HOORAH! You're battle-ready on ${topic}!`,
    ],
  };

  const options = templates[persona];
  return options[Math.floor(Math.random() * options.length)] ?? options[0]!;
}

/**
 * Generate feedback for incorrect answers
 */
function generateIncorrectFeedback(
  persona: AttendingPersona,
  topic: string,
  condition?: string,
  keyLearning?: string
): string {
  const templates = {
    nurturer: [
      `Good try! ${keyLearning || `Remember to think about ${topic} next time.`} You're learning and that's what matters.`,
      `Not quite, but you're on the right track. ${keyLearning || `Let's review ${condition || topic} together.`}`,
      `It's okay to make mistakes - that's how we learn! ${keyLearning || `Focus on understanding ${topic}.`}`,
      `Close! ${keyLearning || `Think about the key features of ${condition || topic}.`} You'll get it next time!`,
    ],
    surgeon: [
      `WRONG. Patient died. ${keyLearning || `You missed the diagnosis.`} Never forget this.`,
      `Incorrect. That decision cost a life. ${keyLearning || `Always check the H&H in ${topic}.`}`,
      `NO. ${keyLearning || `You failed to recognize ${condition}.`} This is unacceptable.`,
      `Negative. Patient coded. ${keyLearning || `Review ${topic} immediately.`} Lives depend on you.`,
    ],
    professor: [
      `Not quite. Let's break this down systematically. ${keyLearning || `The key to ${topic} is understanding the underlying mechanism.`}`,
      `Incorrect. Here's what you need to know: ${keyLearning || `In ${condition || topic}, we must consider...`}`,
      `That's not right. Consider the differential diagnosis: ${keyLearning || `${topic} presents with...`}`,
      `Let me clarify. ${keyLearning || `The pathophysiology of ${condition || topic} explains why...`}`,
    ],
    comedian: [
      `Oopsie daisy! ${keyLearning || `Remember: ${topic} is like... well, not that!`}`,
      `Nope! But hey, we all have off days. ${keyLearning || `Just remember ${topic} for next time.`}`,
      `Wrong answer, right spirit! ${keyLearning || `${condition || topic} is tricky, but you'll nail it.`}`,
      `Swing and a miss! ${keyLearning || `Think of ${topic} like... the opposite of what you picked.`}`,
    ],
    'drill-sergeant': [
      `NEGATIVE! ${keyLearning || `You failed to secure ${topic}!`} Drop and give me 10 more questions!`,
      `UNSAT! ${keyLearning || `Review ${condition || topic} ASAP!`} We don't quit in my unit!`,
      `INCORRECT! ${keyLearning || `Master ${topic} or fall behind!`} Excellence is the only option!`,
      `NO GO! ${keyLearning || `Lock in ${condition || topic} before advancing!`} Failure is not an option!`,
    ],
  };

  const options = templates[persona];
  return options[Math.floor(Math.random() * options.length)] ?? options[0]!;
}

/**
 * Get persona by ID
 */
export function getPersona(personaId: AttendingPersona): PersonaProfile {
  return ATTENDING_PERSONAS[personaId];
}

/**
 * Get all available personas
 */
export function getAllPersonas(): PersonaProfile[] {
  return Object.values(ATTENDING_PERSONAS);
}

/**
 * Save user's preferred persona
 */
export function savePreferredPersona(personaId: AttendingPersona): void {
  try {
    localStorage.setItem('panceai_attending_persona', personaId);
  } catch (error) {
    console.error('Failed to save persona preference:', error);
  }
}

/**
 * Load user's preferred persona
 */
export function loadPreferredPersona(): AttendingPersona {
  try {
    const stored = localStorage.getItem('panceai_attending_persona');
    if (stored && stored in ATTENDING_PERSONAS) {
      return stored as AttendingPersona;
    }
  } catch (error) {
    console.error('Failed to load persona preference:', error);
  }
  return 'professor'; // Default persona
}

/**
 * Generate a motivational message from the persona
 */
export function getMotivationalMessage(persona: AttendingPersona): string {
  const messages = {
    nurturer:
      "Remember, you're doing great! Every question is a step forward in your journey. I believe in you! 💙",
    surgeon: 'Stay sharp. Stay focused. Lives are on the line. No room for error.',
    professor:
      "Education is a marathon, not a sprint. Take time to understand the 'why' behind each answer.",
    comedian: "Keep that smile on! Medicine is serious, but learning doesn't have to be boring! 😄",
    'drill-sergeant': "STAY FOCUSED! DISCIPLINE EQUALS FREEDOM! YOU'VE GOT THIS, SOLDIER!",
  };

  return messages[persona];
}
