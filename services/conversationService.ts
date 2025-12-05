// services/conversationService.ts

/**
 * Service for generating dynamic, AI-powered group chat conversations
 * between virtual study group members to make the app feel more "alive"
 */

export interface ChatMessage {
  id: string;
  author: string;
  message: string;
  timestamp: number;
  avatar: string;
  mood: 'excited' | 'focused' | 'encouraging' | 'curious' | 'celebrating';
}

export interface GroupMember {
  name: string;
  avatar: string;
  personality: string;
  studyFocus: string;
}

// Virtual study group members with distinct personalities
const GROUP_MEMBERS: GroupMember[] = [
  {
    name: "Alex",
    avatar: "👨‍⚕️",
    personality: "enthusiastic and supportive",
    studyFocus: "cardiology"
  },
  {
    name: "Sarah",
    avatar: "👩‍⚕️",
    personality: "detail-oriented and analytical",
    studyFocus: "neurology"
  },
  {
    name: "Marcus",
    avatar: "👨‍🔬",
    personality: "encouraging and motivational",
    studyFocus: "pharmacology"
  },
  {
    name: "Priya",
    avatar: "👩‍🔬",
    personality: "curious and inquisitive",
    studyFocus: "pediatrics"
  },
  {
    name: "Jordan",
    avatar: "🧑‍⚕️",
    personality: "competitive and driven",
    studyFocus: "surgery"
  }
];

// Conversation templates based on context
const CONVERSATION_TEMPLATES = {
  welcome: [
    "Hey everyone! Ready for another great study session? 💪",
    "Morning team! Let's crush these practice questions today!",
    "Who's up for some focused studying? I need to review {{topic}}.",
    "Just finished a set on {{topic}} - feeling confident! Anyone else working on that?",
    "Quick question - anyone else find {{topic}} challenging? Want to review together?"
  ],
  encouragement: [
    "You've got this! That streak is looking amazing! 🔥",
    "Great progress on {{topic}}! Keep it up!",
    "Remember, every question is a learning opportunity!",
    "Your consistency is really paying off - nice work!",
    "That's the spirit! We're all improving together!"
  ],
  celebration: [
    "Wow! {{count}} questions in a row - that's incredible! 🎉",
    "Just hit a new personal best! Who else is on fire today?",
    "Passed {{count}} questions this week - we're getting ready!",
    "Love seeing everyone's progress! This group is motivating!",
    "{{topic}} mastery unlocked! Time to celebrate and move forward!"
  ],
  studyTips: [
    "Pro tip: I always review the rationales, even for correct answers!",
    "Found a great mnemonic for {{topic}} - anyone want to hear it?",
    "Quick study break tip: spaced repetition is your friend!",
    "Remember to focus on your weak areas - that's where the growth happens!",
    "Just scheduled my exam! How's everyone else feeling about their prep?"
  ],
  discussion: [
    "What's the best way to remember the {{topic}} criteria?",
    "Anyone have tips for {{topic}}? I keep missing those questions.",
    "I used to struggle with {{topic}}, but this approach really helped...",
    "Fun fact about {{topic}} - did you know...",
    "Let's discuss: what's your strategy for {{topic}} questions?"
  ]
};

/**
 * Generate a dynamic conversation based on user's activity
 */
export async function generateContextualConversation(
  userStats: {
    currentStreak: number;
    recentTopic?: string;
    questionsToday: number;
    weakAreas?: string[];
  }
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];
  const now = Date.now();
  
  // Generate 3-5 messages based on context
  const messageCount = 3 + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < messageCount; i++) {
    const member = GROUP_MEMBERS[Math.floor(Math.random() * GROUP_MEMBERS.length)];
    const timeOffset = (messageCount - i) * 2 * 60 * 1000; // Messages spread over last few minutes
    
    let template: string;
    let mood: ChatMessage['mood'] = 'focused';
    
    // Choose message type based on context and position
    if (i === 0 && userStats.currentStreak > 5) {
      // First message celebrates streak
      template = CONVERSATION_TEMPLATES.celebration[
        Math.floor(Math.random() * CONVERSATION_TEMPLATES.celebration.length)
      ];
      mood = 'celebrating';
    } else if (i === 1 && userStats.questionsToday > 20) {
      // Second message encourages
      template = CONVERSATION_TEMPLATES.encouragement[
        Math.floor(Math.random() * CONVERSATION_TEMPLATES.encouragement.length)
      ];
      mood = 'encouraging';
    } else if (i === messageCount - 1) {
      // Last message starts discussion
      template = CONVERSATION_TEMPLATES.discussion[
        Math.floor(Math.random() * CONVERSATION_TEMPLATES.discussion.length)
      ];
      mood = 'curious';
    } else if (Math.random() > 0.5) {
      // Study tips
      template = CONVERSATION_TEMPLATES.studyTips[
        Math.floor(Math.random() * CONVERSATION_TEMPLATES.studyTips.length)
      ];
      mood = 'focused';
    } else {
      // Welcome messages
      template = CONVERSATION_TEMPLATES.welcome[
        Math.floor(Math.random() * CONVERSATION_TEMPLATES.welcome.length)
      ];
      mood = 'excited';
    }
    
    // Replace template variables
    let message = template
      .replace('{{count}}', userStats.questionsToday.toString())
      .replace('{{topic}}', userStats.recentTopic || (userStats.weakAreas?.[0] || 'cardiology'));
    
    messages.push({
      id: `msg-${now}-${i}`,
      author: member.name,
      message,
      timestamp: now - timeOffset,
      avatar: member.avatar,
      mood
    });
  }
  
  // Sort by timestamp (oldest first)
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

interface AIMessageSchema {
  author: string;
  message: string;
  mood: 'excited' | 'focused' | 'encouraging' | 'curious' | 'celebrating';
}

/**
 * Generate AI-powered conversation using Gemini (if available)
 */
export async function generateAIConversation(
  context: {
    userActivity: string;
    recentTopics: string[];
    timeOfDay: string;
  }
): Promise<ChatMessage[]> {
  try {
    // Call Gemini API through our proxy with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const prompt = `Generate 3-4 realistic, encouraging messages for a medical study group chat.
    
Context:
- User just ${context.userActivity}
- Recent study topics: ${context.recentTopics.join(', ')}
- Time of day: ${context.timeOfDay}

Requirements:
- Messages should be from different members: Alex (enthusiastic), Sarah (analytical), Marcus (encouraging), Priya (curious), Jordan (competitive)
- Keep messages natural, supportive, and study-focused
- Include relevant emojis sparingly
- Make it feel like real students supporting each other
- Each message should be 1-2 sentences max

Return as JSON array with format: [{"author": "Name", "message": "text", "mood": "excited|focused|encouraging|curious|celebrating"}]`;

    const response = await fetch('/geminiProxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelName: 'gemini-1.5-flash',
        prompt,
        temperature: 0.9
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to generate AI conversation: HTTP ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const text = typeof data === 'string' ? data : data.text;
    
    // Parse the JSON response with error handling
    let aiMessages: AIMessageSchema[];
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
      aiMessages = JSON.parse(cleanedText);
      
      // Validate array format
      if (!Array.isArray(aiMessages)) {
        throw new Error('AI response is not an array');
      }
    } catch (parseError) {
      console.error('Failed to parse AI conversation response:', parseError);
      throw new Error(`Invalid AI response format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    // Convert to our ChatMessage format
    const now = Date.now();
    return aiMessages.map((msg, i) => {
      const member = GROUP_MEMBERS.find(m => m.name === msg.author) || GROUP_MEMBERS[0];
      return {
        id: `ai-msg-${now}-${i}`,
        author: msg.author,
        message: msg.message,
        timestamp: now - (aiMessages.length - i) * 3 * 60 * 1000,
        avatar: member.avatar,
        mood: msg.mood || 'focused'
      };
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('AI conversation generation timed out');
    } else {
      console.error('Error generating AI conversation:', error);
    }
    // Fallback to template-based generation
    return generateContextualConversation({
      currentStreak: 0,
      questionsToday: 0
    });
  }
}

/**
 * Get a motivational message based on time of day
 */
export function getTimeBasedMotivation(): string {
  const hour = new Date().getHours();
  
  if (hour < 6) {
    return "Wow, early bird! Your dedication is impressive! 🌅";
  } else if (hour < 12) {
    return "Morning study session - great way to start the day! ☀️";
  } else if (hour < 17) {
    return "Afternoon grind - keep that momentum going! 📚";
  } else if (hour < 21) {
    return "Evening review - perfect time to consolidate! 🌙";
  } else {
    return "Late night warrior! Don't forget to rest too! 🌟";
  }
}

/**
 * Generate a random encouraging message
 */
export function getRandomEncouragement(): string {
  const encouragements = [
    "Every question is one step closer to your goal! 🎯",
    "Your future patients will thank you for this dedication! 💙",
    "Consistency beats intensity - you're doing great! 🌟",
    "Learning from mistakes is how experts are made! 📈",
    "This community believes in you! We're in this together! 🤝",
    "Progress over perfection - keep going! 💪",
    "Your hard work today = confidence on exam day! 🏆"
  ];
  
  return encouragements[Math.floor(Math.random() * encouragements.length)];
}
