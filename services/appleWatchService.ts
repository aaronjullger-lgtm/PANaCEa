/**
 * Apple Watch Micro-Dosing Service
 * Provides hourly flashcard notifications for Apple Watch
 * Phase 15: Requirement 60
 */

import type { Question } from '../types';

export interface WatchFlashcard {
  id: string;
  question: string;
  answer: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timestamp: number;
}

interface WatchNotificationSchedule {
  nextNotificationTime: number;
  lastNotificationTime: number;
  hourlyInterval: number; // in milliseconds
}

const STORAGE_KEY_SCHEDULE = 'panceai_watch_schedule_v1';
const STORAGE_KEY_FLASHCARDS = 'panceai_watch_flashcards_v1';
const HOURLY_INTERVAL = 60 * 60 * 1000; // 1 hour

// ID generation counter for unique flashcard IDs
let flashcardIdCounter = 0;

/**
 * Generate a unique flashcard ID
 */
function generateFlashcardId(): string {
  const timestamp = Date.now();
  const counter = ++flashcardIdCounter;
  return `watch_${timestamp}_${counter}`;
}

/**
 * Generate a micro-flashcard from a question
 */
export function generateMicroFlashcard(question: Question): WatchFlashcard {
  // Extract key fact or create a simplified version
  const flashcard: WatchFlashcard = {
    id: generateFlashcardId(),
    question: simplifyForWatch(question.question),
    answer: extractKeyAnswer(question),
    category: question.topic,
    difficulty: 'medium',
    timestamp: Date.now()
  };
  
  return flashcard;
}

/**
 * Simplify question text for watch display (keep it under 50 words)
 */
function simplifyForWatch(text: string): string {
  // Remove excessive detail, keep the core question
  const sentences = text.split(/[.!?]+/);
  const keyQuestion = sentences.find(s => s.includes('?')) || sentences[0];
  
  // Truncate if too long
  const words = keyQuestion.trim().split(/\s+/);
  if (words.length > 20) {
    return words.slice(0, 20).join(' ') + '...?';
  }
  
  return keyQuestion.trim();
}

/**
 * Extract key answer from question
 */
function extractKeyAnswer(question: Question): string {
  const correctOption = question.options[question.correctAnswerIndex];
  
  // If rationale has key info, include it
  if (question.rationale) {
    const sentences = question.rationale.split(/[.!]+/);
    const keyPoint = sentences[0]?.trim();
    if (keyPoint && keyPoint.length < 100) {
      return `${correctOption}\n\n${keyPoint}`;
    }
  }
  
  return correctOption;
}

/**
 * Generate high-yield flashcards from question bank
 */
export function generateHighYieldFlashcards(
  questions: Question[],
  count: number = 24
): WatchFlashcard[] {
  // Prioritize high-value questions
  const prioritized = [...questions]
    .sort((a, b) => {
      // Prioritize commonly missed or bookmarked questions
      const aScore = (a.isBookmarked ? 2 : 0);
      const bScore = (b.isBookmarked ? 2 : 0);
      return bScore - aScore;
    })
    .slice(0, count);
  
  return prioritized.map(q => generateMicroFlashcard(q));
}

/**
 * Get next flashcard for notification
 */
export function getNextFlashcard(): WatchFlashcard | null {
  try {
    const flashcards = getStoredFlashcards();
    if (flashcards.length === 0) {
      return null;
    }
    
    // Get random flashcard from pool
    const randomIndex = Math.floor(Math.random() * flashcards.length);
    return flashcards[randomIndex];
  } catch (error) {
    console.error('Failed to get next flashcard:', error);
    return null;
  }
}

/**
 * Schedule next watch notification
 */
export function scheduleNextNotification(): void {
  const schedule = getNotificationSchedule();
  const now = Date.now();
  
  // Calculate next hour boundary
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  
  schedule.nextNotificationTime = nextHour.getTime();
  schedule.lastNotificationTime = now;
  
  saveNotificationSchedule(schedule);
  
  // In a real implementation, this would integrate with Apple Watch push notifications
  console.log(`Next watch notification scheduled for: ${nextHour.toLocaleString()}`);
}

/**
 * Check if it's time for a notification
 */
export function shouldShowNotification(): boolean {
  const schedule = getNotificationSchedule();
  const now = Date.now();
  
  return now >= schedule.nextNotificationTime;
}

/**
 * Get notification schedule from storage
 */
function getNotificationSchedule(): WatchNotificationSchedule {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SCHEDULE);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load notification schedule:', error);
  }
  
  // Default schedule
  return {
    nextNotificationTime: Date.now() + HOURLY_INTERVAL,
    lastNotificationTime: 0,
    hourlyInterval: HOURLY_INTERVAL
  };
}

/**
 * Save notification schedule to storage
 */
function saveNotificationSchedule(schedule: WatchNotificationSchedule): void {
  try {
    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(schedule));
  } catch (error) {
    console.error('Failed to save notification schedule:', error);
  }
}

/**
 * Store flashcards for watch notifications
 */
export function storeFlashcards(flashcards: WatchFlashcard[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_FLASHCARDS, JSON.stringify(flashcards));
  } catch (error) {
    console.error('Failed to store flashcards:', error);
  }
}

/**
 * Get stored flashcards
 */
function getStoredFlashcards(): WatchFlashcard[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_FLASHCARDS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load flashcards:', error);
  }
  return [];
}

/**
 * Generate a simple antidote flashcard (example from requirements)
 */
export function generateAntidoteFlashcard(): WatchFlashcard {
  return {
    id: generateFlashcardId(),
    question: 'Quick: What is the antidote for Tylenol?',
    answer: 'N-acetylcysteine (NAC) - Give within 8 hours for best results',
    category: 'Toxicology',
    difficulty: 'hard',
    timestamp: Date.now()
  };
}

/**
 * Initialize watch service with sample flashcards
 */
export function initializeWatchService(questions: Question[]): void {
  const flashcards = generateHighYieldFlashcards(questions);
  storeFlashcards(flashcards);
  scheduleNextNotification();
  console.log(`Watch service initialized with ${flashcards.length} flashcards`);
}
