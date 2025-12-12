/**
 * OSCE Service
 * 
 * Manages OSCE (Objective Structured Clinical Examination) patient encounters:
 * - Chat history storage during encounter
 * - Conversation context management
 * - Automatic cleanup after encounter completion
 */

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'patient';
  message: string;
  timestamp: Date;
  phase?: string;
  isRelevant: boolean;
}

/**
 * Save a chat message to the encounter history
 */
export async function saveChatMessage(
  sessionId: string,
  userId: string,
  role: 'user' | 'patient',
  message: string,
  phase?: string,
  isRelevant: boolean = true
): Promise<ChatMessage> {
  try {
    const response = await fetch('/api/osce/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        userId,
        role,
        message,
        phase,
        isRelevant
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save chat message');
    }

    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
}

/**
 * Get chat history for an encounter session
 */
export async function getChatHistory(
  sessionId: string,
  limit: number = 100
): Promise<ChatMessage[]> {
  try {
    const response = await fetch(
      `/api/osce/history?sessionId=${sessionId}&limit=${limit}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch chat history');
    }

    const data = await response.json();
    return data.history;
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
}

/**
 * Delete chat history for a session (called after encounter completion)
 */
export async function cleanupChatHistory(sessionId: string): Promise<number> {
  try {
    const response = await fetch(`/api/osce/history?sessionId=${sessionId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to delete chat history');
    }

    const data = await response.json();
    return data.deleted;
  } catch (error) {
    console.error('Error deleting chat history:', error);
    throw error;
  }
}

/**
 * Build conversation context from chat history for AI
 * Returns formatted string suitable for AI prompt
 */
export function buildConversationContext(history: ChatMessage[]): string {
  return history
    .map(msg => {
      const speaker = msg.role === 'user' ? 'Provider' : 'Patient';
      return `${speaker}: ${msg.message}`;
    })
    .join('\n');
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `osce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
